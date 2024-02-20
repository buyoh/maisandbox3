import CallbackManager from '../lib/CallbackManager';
import { QueryParser } from './MainServer/QueryParser';
import TaskRunnerManager from './MainServer/TaskRunnerManager';
import { ConnectionHandler, ConnectionHandlerFactory } from './WebService';

// ----------------------------------------------------------------------------

export interface TaskManagerService {
  stop(): void;
  getConnectionHandlerFactory(): ConnectionHandlerFactory;
}

// ----------------------------------------------------------------------------

class ConnectionHandlerImpl implements ConnectionHandler {
  socketId: string;
  taskRunnerManager: TaskRunnerManager;
  queryParser: QueryParser;

  constructor(socketId: string, launcherCallbackManager: CallbackManager) {
    this.socketId = socketId;
    this.taskRunnerManager = new TaskRunnerManager();
    this.queryParser = new QueryParser(
      socketId,
      this.taskRunnerManager,
      launcherCallbackManager
    );
  }

  disconnect(): void {
    this.taskRunnerManager.cleanup();
    // console.log('ConnectionHandlerImpl disconnect', this.socketId);
  }

  queryExec(rawData: any, callback: (data: any) => void): void {
    this.queryParser.handle(rawData, (data) => {
      callback(data);
    });
  }
}

class ConnectionHandlerFactoryImpl implements ConnectionHandlerFactory {
  launcherCallbackManager: CallbackManager;
  constructor(launcherCallbackManager: CallbackManager) {
    this.launcherCallbackManager = launcherCallbackManager;
  }

  createConnectionHandler(socketId: string): ConnectionHandler {
    return new ConnectionHandlerImpl(socketId, this.launcherCallbackManager);
  }
}

class TaskManagerServiceImpl implements TaskManagerService {
  connectionHandlerFactory: ConnectionHandlerFactory;

  constructor(launcherCallbackManager: CallbackManager) {
    this.connectionHandlerFactory = new ConnectionHandlerFactoryImpl(
      launcherCallbackManager
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
