import { ILauncherClient } from './launcher/launcher-client-interface';
import TaskRunnerManager from './task-runner/task-runner-manager';
import {
  ConnectionHandler,
  ConnectionHandlerFactory,
} from './connection-handler';
import {
  RunSingleTaskRequest,
  KillRequest,
  RunInteractiveTaskRequest,
  InteractiveStdinRequest,
  InteractiveCloseStdinRequest,
} from '../interfaces/query-types';
import { TaskResult, InteractiveOutputData } from '../interfaces/result-types';
import { ClientJobID } from '../interfaces/id-types';
import TaskRunner from './task-runner/task-runner';
import { TaskFactory, TaskFactoryRunTask } from './task/task-factory';
import { TaskInteractive } from './task/task-interactive';

// ----------------------------------------------------------------------------

/** タスク管理サービスのインターフェース。接続ハンドラファクトリの提供と停止を担う */
export interface TaskManagerService {
  /** Launcher 接続を閉じ、サービスを停止する */
  stop(): void;
  /** 接続ハンドラを生成するファクトリを取得する */
  getConnectionHandlerFactory(): ConnectionHandlerFactory;
}

// ----------------------------------------------------------------------------

export function validateRunSingleTask(
  rawData: unknown
): RunSingleTaskRequest | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const obj = rawData as Record<string, unknown>;
  if (typeof obj.lang !== 'string') return null;
  if (!obj.info || typeof obj.info !== 'object') return null;
  const info = obj.info as Record<string, unknown>;
  if (typeof info.type !== 'string') return null;
  if (typeof info.code !== 'string') return null;

  switch (info.type) {
    case 'filestdin':
      if (typeof info.stdin !== 'string') return null;
      break;
    case 'multistdin':
      if (!Array.isArray(info.stdinList)) return null;
      if (info.stdinList.length < 1 || info.stdinList.length > 100) return null;
      for (const item of info.stdinList) {
        if (typeof item !== 'string') return null;
      }
      break;
    default:
      return null;
  }

  return rawData as RunSingleTaskRequest;
}

export function validateKill(rawData: unknown): KillRequest | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const obj = rawData as Record<string, unknown>;
  // id フィールドが存在する場合、ClientJobID の形状を検証
  if ('id' in obj && obj.id != null) {
    if (typeof obj.id !== 'object' || Array.isArray(obj.id)) return null;
    const id = obj.id as Record<string, unknown>;
    if ('clicmid' in id && typeof id.clicmid !== 'number') return null;
  }
  return rawData as KillRequest;
}

/** バリデーション前に raw_data から id を安全に抽出する（エラーレスポンス用） */
export function extractId(rawData: unknown): ClientJobID | undefined {
  if (!rawData || typeof rawData !== 'object') return undefined;
  const obj = rawData as Record<string, unknown>;
  if (obj.id && typeof obj.id === 'object') return obj.id as ClientJobID;
  return undefined;
}

// ------------------------------------

/** 1つの Socket.IO 接続に対応する ConnectionHandler 実装。タスクの実行・kill・切断を処理する */
class ConnectionHandlerImpl implements ConnectionHandler {
  private socketId: string;
  private taskRunnerManager: TaskRunnerManager;
  private launcherClient: ILauncherClient;
  private taskFactory: TaskFactory;
  private onDisconnect: (handler: ConnectionHandler) => void;
  private interactiveTask: TaskInteractive | null = null;

  constructor(
    socketId: string,
    launcherClient: ILauncherClient,
    taskFactory: TaskFactory,
    onDisconnect: (handler: ConnectionHandler) => void
  ) {
    this.socketId = socketId;
    this.taskRunnerManager = new TaskRunnerManager();
    this.launcherClient = launcherClient;
    this.taskFactory = taskFactory;
    this.onDisconnect = onDisconnect;
  }

  disconnect(): void {
    this.taskRunnerManager.cleanup();
    this.interactiveTask?.kill();
    this.interactiveTask = null;
    this.onDisconnect(this);
  }

  async runSingleTask(
    request: RunSingleTaskRequest,
    callback: (data: TaskResult) => void
  ): Promise<void> {
    const clientJobId = request.id;
    if (!clientJobId) {
      callback({ success: false, summary: 'Missing job ID' });
      return;
    }

    const newTaskRunner = new TaskRunner(
      clientJobId,
      this.launcherClient,
      callback,
      () => {
        this.taskRunnerManager.unregister(clientJobId);
      }
    );
    this.taskRunnerManager.register(clientJobId, newTaskRunner);
    try {
      await newTaskRunner.start(this.taskFactory, request);
    } catch (e) {
      // BUG FIX: startAsync の Promise rejection が unhandled rejection になる問題の修正。
      // start() を async にし、呼び出し元で try-catch することで、
      // 予期しないエラーをキャッチしてクライアントにエラー結果を返す。
      // NOTE: start() 内の catch で finalizer (= unregister) が既に呼ばれている場合、
      // ここでの unregister は Map.delete の冪等性により二重実行でも安全。
      console.error('Unexpected error in TaskRunner.start:', e);
      callback({
        id: clientJobId,
        success: false,
        summary: 'Internal error',
      });
      this.taskRunnerManager.unregister(clientJobId);
    }
  }

  kill(request: KillRequest): void {
    const clientJobId = request.id;
    if (!clientJobId) return;
    const taskRunner = this.taskRunnerManager.getTaskRunner(clientJobId);
    if (taskRunner) {
      taskRunner.kill();
      return;
    }
    // インタラクティブタスクの kill
    this.interactiveTask?.kill();
  }

  async runInteractiveTask(
    request: RunInteractiveTaskRequest,
    resultCallback: (data: TaskResult) => void,
    outputCallback: (data: InteractiveOutputData) => void
  ): Promise<void> {
    const clientJobId = request.id;
    if (!clientJobId) {
      resultCallback({ success: false, summary: 'Missing job ID' });
      return;
    }
    if (!request.lang) {
      resultCallback({
        id: clientJobId,
        success: false,
        summary: 'Missing lang',
      });
      return;
    }

    // 既存のインタラクティブタスクがあれば kill
    this.interactiveTask?.kill();
    this.interactiveTask = null;

    const task = new TaskInteractive(
      this.launcherClient,
      (data) => resultCallback({ ...data, id: clientJobId }),
      (output) =>
        outputCallback({
          id: clientJobId,
          stream: output.stream,
          data: output.data,
        }),
      () => {
        this.interactiveTask = null;
      },
      request.lang,
      request.code ?? '',
      undefined,
      request.options
    );
    this.interactiveTask = task;
    await task.startAsync({
      type: 'filestdin',
      code: request.code ?? '',
      stdin: '',
    });
  }

  interactiveStdin(request: InteractiveStdinRequest): void {
    if (!request.data) return;
    this.interactiveTask?.writeStdin(request.data);
  }

  interactiveCloseStdin(_request: InteractiveCloseStdinRequest): void {
    this.interactiveTask?.closeStdin();
  }
}

// ------------------------------------

/** ConnectionHandler を生成し、アクティブな接続を追跡するファクトリ実装 */
class ConnectionHandlerFactoryImpl implements ConnectionHandlerFactory {
  private readonly launcherClient: ILauncherClient;
  private readonly taskFactory: TaskFactory;
  private readonly activeHandlers: Set<ConnectionHandler> = new Set();
  constructor(launcherClient: ILauncherClient, taskFactory: TaskFactory) {
    this.launcherClient = launcherClient;
    this.taskFactory = taskFactory;
  }

  createConnectionHandler(socketId: string): ConnectionHandler {
    const handler = new ConnectionHandlerImpl(
      socketId,
      this.launcherClient,
      this.taskFactory,
      (h) => {
        this.activeHandlers.delete(h);
      }
    );
    this.activeHandlers.add(handler);
    return handler;
  }

  /** 全アクティブ接続を切断し、実行中タスクを停止する */
  disconnectAll(): void {
    for (const handler of this.activeHandlers) {
      handler.disconnect();
    }
    // disconnect() 内の onDisconnect コールバックで個別削除されるが、
    // 安全のため明示的にクリア
    this.activeHandlers.clear();
  }
}

// ------------------------------------

/** TaskManagerService の実装。LauncherClient を保持し、接続管理と graceful shutdown を提供する */
class TaskManagerServiceImpl implements TaskManagerService {
  private readonly connectionHandlerFactory: ConnectionHandlerFactoryImpl;

  constructor(launcherClient: ILauncherClient) {
    const taskFactory: TaskFactory = new TaskFactoryRunTask();
    this.connectionHandlerFactory = new ConnectionHandlerFactoryImpl(
      launcherClient,
      taskFactory
    );
  }

  stop(): void {
    this.connectionHandlerFactory.disconnectAll();
  }

  getConnectionHandlerFactory(): ConnectionHandlerFactory {
    return this.connectionHandlerFactory;
  }
}

// ----------------------------------------------------------------------------

export function createTaskManagerService(
  launcherClient: ILauncherClient
): TaskManagerService {
  return new TaskManagerServiceImpl(launcherClient);
}
