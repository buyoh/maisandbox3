import {
  RunSingleTaskRequest,
  KillRequest,
  RunInteractiveTaskRequest,
  InteractiveStdinRequest,
  InteractiveCloseStdinRequest,
} from './query-types';
import { TaskResult, InteractiveOutputData } from './result-types';

/** 接続状態を表す型 */
export type ConnectionStatus = 'connected' | 'disconnected';

/** Launcher 接続状態イベントのペイロード */
export interface LauncherStatusPayload {
  status: ConnectionStatus;
}

/** クライアントからサーバへ送信するイベント */
export interface ClientToServerEvents {
  /** タスク実行リクエスト */
  runSingleTask: (data: RunSingleTaskRequest) => void;
  /** 実行中タスクの強制停止リクエスト */
  kill: (data: KillRequest) => void;
  /** インタラクティブ実行リクエスト */
  runInteractiveTask: (data: RunInteractiveTaskRequest) => void;
  /** インタラクティブ stdin 送信 */
  interactiveStdin: (data: InteractiveStdinRequest) => void;
  /** インタラクティブ stdin 終了 */
  interactiveCloseStdin: (data: InteractiveCloseStdinRequest) => void;
}

/** サーバからクライアントへ送信するイベント */
export interface ServerToClientEvents {
  /** タスク実行結果の通知 */
  taskResult: (data: TaskResult) => void;
  /** applauncher の接続状態通知 */
  launcherStatus: (data: LauncherStatusPayload) => void;
  /** インタラクティブ出力チャンク */
  interactiveOutput: (data: InteractiveOutputData) => void;
}
