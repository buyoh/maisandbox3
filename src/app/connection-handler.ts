import {
  RunSingleTaskRequest,
  KillRequest,
  RunInteractiveTaskRequest,
  InteractiveStdinRequest,
  InteractiveCloseStdinRequest,
} from '../interfaces/query-types';
import { TaskResult, InteractiveOutputData } from '../interfaces/result-types';

// ----------------------------------------------------------------------------

/** Socket.IO 接続ごとのタスク実行・制御を担うハンドラ */
export interface ConnectionHandler {
  /** 接続切断時にリソースを解放し、実行中タスクを停止する */
  disconnect(): void;
  /** タスク実行リクエストを処理し、結果を callback で返却する */
  runSingleTask(
    request: RunSingleTaskRequest,
    callback: (data: TaskResult) => void
  ): Promise<void>;
  /** 指定タスクを強制停止する */
  kill(request: KillRequest): void;
  /** インタラクティブ実行リクエストを処理する */
  runInteractiveTask(
    request: RunInteractiveTaskRequest,
    resultCallback: (data: TaskResult) => void,
    outputCallback: (data: InteractiveOutputData) => void
  ): Promise<void>;
  /** インタラクティブ stdin 送信 */
  interactiveStdin(request: InteractiveStdinRequest): void;
  /** インタラクティブ stdin 終了 */
  interactiveCloseStdin(request: InteractiveCloseStdinRequest): void;
}

/** ConnectionHandler のファクトリ。接続ごとにハンドラを生成する */
export interface ConnectionHandlerFactory {
  /** 指定の socketId に対応する ConnectionHandler を生成する */
  createConnectionHandler(socketId: string): ConnectionHandler;
}
