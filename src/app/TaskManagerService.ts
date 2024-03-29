import CallbackManager from '../lib/CallbackManager';
import TaskRunnerManager from './TaskRunner/TaskRunnerManager';
import { ConnectionHandler, ConnectionHandlerFactory } from './Api';
import { Query } from '../interfaces/QueryTypes';
import TaskRunner from './TaskRunner/TaskRunner';
import { TaskFactory, TaskFactoryImpl } from './Task/TaskFactory';

// ----------------------------------------------------------------------------

export interface TaskManagerService {
  stop(): void;
  getConnectionHandlerFactory(): ConnectionHandlerFactory;
}

// ----------------------------------------------------------------------------

function validateQuery(rawData: any): Query {
  // TODO: validate rawData
  return rawData;
}

// ------------------------------------

class ConnectionHandlerImpl implements ConnectionHandler {
  socketId: string;
  taskRunnerManager: TaskRunnerManager;
  launcherCallbackManager: CallbackManager;
  taskFactory: TaskFactory;

  constructor(
    socketId: string,
    launcherCallbackManager: CallbackManager,
    taskFactory: TaskFactory
  ) {
    // NOTE: sockerId はユーザ識別の為いずれ必要になる
    this.socketId = socketId;
    this.taskRunnerManager = new TaskRunnerManager();
    this.launcherCallbackManager = launcherCallbackManager;
    this.taskFactory = taskFactory;
  }

  disconnect(): void {
    this.taskRunnerManager.cleanup();
    // console.log('ConnectionHandlerImpl disconnect', this.socketId);
  }

  queryExec(rawData: any, callback: (data: any) => void): void {
    const query = validateQuery(rawData);
    const clientJobId = query.id;
    // note: query.id は client に返す場合と、
    // QueryParser 内での Task 判定の場合のみに必要
    if (!clientJobId) {
      // can't report to client.
      callback({ success: false });
      return;
    }

    const taskRunner = this.taskRunnerManager.getTaskRunner(clientJobId);

    if (query.action == 'init') {
      const newTaskRunner = new TaskRunner(
        clientJobId,
        this.launcherCallbackManager,
        callback,
        () => {
          this.taskRunnerManager.unregister(clientJobId);
        }
      );
      // registration must be before execution.
      this.taskRunnerManager.register(clientJobId, newTaskRunner);
      newTaskRunner.start(this.taskFactory, query);
    } else if (query.action == 'kill') {
      if (!taskRunner) {
        callback({ id: query.id, success: false });
        return;
      }
      taskRunner.kill();
    }
    // TODO: 実行中に情報を送信する action == 'send'
  }
}

// ------------------------------------

class ConnectionHandlerFactoryImpl implements ConnectionHandlerFactory {
  launcherCallbackManager: CallbackManager;
  taskFactory: TaskFactory;
  constructor(
    launcherCallbackManager: CallbackManager,
    taskFactory: TaskFactory
  ) {
    this.launcherCallbackManager = launcherCallbackManager;
    this.taskFactory = taskFactory;
  }

  createConnectionHandler(socketId: string): ConnectionHandler {
    return new ConnectionHandlerImpl(
      socketId,
      this.launcherCallbackManager,
      this.taskFactory
    );
  }
}

// ------------------------------------

class TaskManagerServiceImpl implements TaskManagerService {
  connectionHandlerFactory: ConnectionHandlerFactory;

  constructor(launcherCallbackManager: CallbackManager) {
    const taskFactory = new TaskFactoryImpl();
    this.connectionHandlerFactory = new ConnectionHandlerFactoryImpl(
      launcherCallbackManager,
      taskFactory
    );
  }

  stop(): void {
    // console.log('TaskManagerService stop');
  }

  getConnectionHandlerFactory(): ConnectionHandlerFactory {
    return this.connectionHandlerFactory;
  }
}

// ----------------------------------------------------------------------------

export function createTaskManagerService(
  launcherCallbackManager: CallbackManager
): TaskManagerService {
  return new TaskManagerServiceImpl(launcherCallbackManager);
}
