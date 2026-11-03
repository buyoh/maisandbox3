import type {
  RunSingleTaskRequest,
  KillRequest,
  RunInteractiveTaskRequest,
  InteractiveStdinRequest,
  InteractiveCloseStdinRequest,
} from '../../interfaces/query-types';
import type {
  TaskResult,
  InteractiveOutputData,
} from '../../interfaces/result-types';
import type { LauncherStatusPayload } from '../../interfaces/socket-events';

/** 実行中タスクへの操作ハンドル */
export interface TaskHandle {
  /** タスクに割り当てられた clicmid。タスク追跡用 ID として使用する */
  readonly clicmid: number;
  /** 実行中のタスクを強制停止する */
  kill(): void;
}

/** Socket.IO のイベント送受信インターフェース（タスク通信専用） */
export interface SocketInterface {
  /** runSingleTask イベントをサーバに送信する */
  emitRunSingleTask(data: RunSingleTaskRequest): void;
  /** kill イベントをサーバに送信する */
  emitKill(data: KillRequest): void;
  /** サーバからの taskResult イベントを購読する */
  onTaskResult(handler: (data: TaskResult) => void): void;
  /** runInteractiveTask イベントをサーバに送信する */
  emitRunInteractiveTask(data: RunInteractiveTaskRequest): void;
  /** interactiveStdin イベントをサーバに送信する */
  emitInteractiveStdin(data: InteractiveStdinRequest): void;
  /** interactiveCloseStdin イベントをサーバに送信する */
  emitInteractiveCloseStdin(data: InteractiveCloseStdinRequest): void;
  /** サーバからの interactiveOutput イベントを購読する */
  onInteractiveOutput(handler: (data: InteractiveOutputData) => void): void;
  /** サーバとの接続を切断する */
  disconnect(): void;
}

/** 接続ライフサイクルイベントを購読するインターフェース */
export interface ConnectionEventSource {
  onConnect(handler: () => void): void;
  onDisconnect(handler: () => void): void;
  onLauncherStatus(handler: (data: LauncherStatusPayload) => void): void;
  /** イベントリスナーを解除する */
  offAll(): void;
}

/** Socket.IO クライアントの通信管理 */
export class ClientSocket {
  private socket: SocketInterface;
  private counter: number;
  private callbacks: Map<number, (data: TaskResult) => void>;

  constructor(socket: SocketInterface) {
    this.socket = socket;
    this.counter = 1;
    this.callbacks = new Map();

    this.socket.onTaskResult((data: TaskResult) => {
      const id = data.id?.clicmid;
      if (id === undefined) return;
      const cb = this.callbacks.get(id);
      if (!cb) return;
      if (data.continue !== true) {
        this.callbacks.delete(id);
      }
      cb(data);
    });
  }

  /**
   * タスクを実行開始し、結果を受信するハンドルを返す。
   * onResult は continue=true の間繰り返し呼ばれる。
   */
  runSingleTask(
    request: Omit<RunSingleTaskRequest, 'id'>,
    onResult: (data: TaskResult) => void
  ): TaskHandle {
    const cbmid = this.counter++;
    this.callbacks.set(cbmid, onResult);
    this.socket.emitRunSingleTask({
      ...request,
      id: { clicmid: cbmid },
    });
    return {
      clicmid: cbmid,
      kill: () => {
        this.socket.emitKill({ id: { clicmid: cbmid } });
      },
    };
  }

  /** 接続を切断し、リソースを解放する */
  disconnect(): void {
    this.socket.disconnect();
    this.callbacks.clear();
  }
}
