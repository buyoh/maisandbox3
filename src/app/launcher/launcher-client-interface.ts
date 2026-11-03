/**
 * Launcher通信の抽象インターフェース。
 * Task層はこのインターフェースにのみ依存し、gRPC実装やFake実装を差し替え可能にする。
 */

/** Launcher通信エラーコード */
export type LauncherErrorCode =
  | 'INVALID_ARGUMENT'
  | 'FAILED_PRECONDITION'
  | 'UNAVAILABLE'
  | 'DEADLINE_EXCEEDED';

/** Launcher通信エラー */
export type LauncherError = {
  code: LauncherErrorCode;
  message: string;
};

/** 成功または失敗を表す型 */
export type LauncherResult<T> =
  { ok: true; value: T } | { ok: false; error: LauncherError };

/** ファイルエントリ（RunTask で使用） */
export interface FileEntry {
  path: string;
  data: string;
}

// --- RunTask ---

/** RunTask の実行パラメータ */
export interface RunTaskParams {
  lang: string;
  files: FileEntry[];
  /** 全体タイムアウト（ミリ秒）。0は無制限。 */
  totalTimeoutMs: number;
  /** 単一フェーズのタイムアウト（ミリ秒）。0は無制限。 */
  phaseTimeoutMs: number;
  /** 言語オプション。省略時は Go 側でデフォルト値が適用される。 */
  options?: Record<string, string>;
}

/** RunTask フェーズ結果イベント */
export interface RunTaskPhaseResultEvent {
  type: 'phase_result';
  phase: string;
  exitStatus: number;
  /** 実行時間（ミリ秒） */
  timeMs: number;
  stdout: string;
  stderr: string;
  hasNextPhase: boolean;
}

/** RunTask 完了イベント */
export interface RunTaskCompletedEvent {
  type: 'completed';
  /** 全フェーズ合計実行時間（ミリ秒） */
  totalTimeMs: number;
}

/** RunTask エラーコード */
export type RunTaskErrorCode =
  | 'INVALID_LANG'
  | 'SETUP_FAILED'
  | 'STORE_FAILED'
  | 'EXEC_FAILED'
  | 'TIMEOUT'
  | 'PHASE_TIMEOUT'
  | 'INVALID_OPTION'
  | 'INTERNAL';

/** RunTask 失敗イベント */
export interface RunTaskFailedEvent {
  type: 'failed';
  phase: string;
  errorCode: RunTaskErrorCode;
  reason: string;
}

/** RunTask のストリームイベント */
export type RunTaskEvent =
  RunTaskPhaseResultEvent | RunTaskCompletedEvent | RunTaskFailedEvent;

/** RunTask の実行ハンドル */
export interface RunTaskHandle {
  /** task_id（kill用） */
  taskId: string;
  /** イベントストリーム */
  events: AsyncIterable<RunTaskEvent>;
}

/** Launcher通信の抽象インターフェース */
export interface ILauncherClient {
  /** 実行中のタスクを強制停止する */
  kill(box: string, taskId: string): Promise<LauncherResult<void>>;
  /** 言語タスクを一括実行し、フェーズごとの結果をストリームで返す */
  runTask(params: RunTaskParams): Promise<LauncherResult<RunTaskHandle>>;
  /** 複数 stdin に対してビルド1回+実行N回を行い、結果をストリームで返す */
  runTaskMulti(
    params: RunTaskMultiParams
  ): Promise<LauncherResult<RunTaskMultiHandle>>;
  /** インタラクティブ実行（双方向ストリーミング）を開始する */
  execInteractive(
    params: ExecInteractiveParams
  ): Promise<LauncherResult<ExecInteractiveHandle>>;
}

// --- RunTaskMulti ---

/** RunTaskMulti の実行パラメータ */
export interface RunTaskMultiParams {
  lang: string;
  files: FileEntry[];
  totalTimeoutMs: number;
  phaseTimeoutMs: number;
  options?: Record<string, string>;
  /** 複数の標準入力データ */
  stdinList: { stdinIndex: number; data: string }[];
}

/** RunTaskMulti ビルドフェーズ結果イベント */
export interface RunTaskMultiBuildResultEvent {
  type: 'build_result';
  phase: string;
  exitStatus: number;
  timeMs: number;
  stdout: string;
  stderr: string;
  hasNextBuildPhase: boolean;
}

/** RunTaskMulti 個別 run 結果イベント */
export interface RunTaskMultiRunResultEvent {
  type: 'run_result';
  stdinIndex: number;
  exitStatus: number;
  timeMs: number;
  stdout: string;
  stderr: string;
  hasNextRun: boolean;
}

/** RunTaskMulti 完了イベント */
export interface RunTaskMultiCompletedEvent {
  type: 'completed';
  totalTimeMs: number;
}

/** RunTaskMulti 失敗イベント */
export interface RunTaskMultiFailedEvent {
  type: 'failed';
  phase: string;
  errorCode: RunTaskErrorCode;
  reason: string;
}

/** RunTaskMulti のストリームイベント */
export type RunTaskMultiEvent =
  | RunTaskMultiBuildResultEvent
  | RunTaskMultiRunResultEvent
  | RunTaskMultiCompletedEvent
  | RunTaskMultiFailedEvent;

/** RunTaskMulti の実行ハンドル */
export interface RunTaskMultiHandle {
  taskId: string;
  events: AsyncIterable<RunTaskMultiEvent>;
}

// --- ExecInteractive ---

/** ExecInteractive の開始パラメータ */
export interface ExecInteractiveParams {
  lang: string;
  files: FileEntry[];
  /** 全体タイムアウト（ミリ秒）。0は無制限。 */
  timeoutMs: number;
  /** 言語オプション。省略時は Go 側でデフォルト値が適用される。 */
  options?: Record<string, string>;
}

/** stdout/stderr のリアルタイム出力チャンク */
export interface ExecInteractiveOutputEvent {
  type: 'output';
  stream: 'stdout' | 'stderr';
  data: string;
}

/** コンパイルフェーズ結果（コンパイルが必要な言語のみ） */
export interface ExecInteractiveCompileResultEvent {
  type: 'compile_result';
  exitStatus: number;
  timeMs: number;
  stdout: string;
  stderr: string;
}

/** 正常完了 */
export interface ExecInteractiveCompletedEvent {
  type: 'completed';
  exitStatus: number;
  elapsedTimeMs: number;
}

/** 実行前エラー */
export interface ExecInteractiveFailedEvent {
  type: 'failed';
  phase: string;
  errorCode: RunTaskErrorCode;
  reason: string;
}

/** Kill 通知 */
export interface ExecInteractiveKilledEvent {
  type: 'killed';
  reason: string;
  elapsedTimeMs: number;
}

/** ExecInteractive のストリームイベント */
export type ExecInteractiveEvent =
  | ExecInteractiveOutputEvent
  | ExecInteractiveCompileResultEvent
  | ExecInteractiveCompletedEvent
  | ExecInteractiveFailedEvent
  | ExecInteractiveKilledEvent;

/** ExecInteractive の実行ハンドル */
export interface ExecInteractiveHandle {
  /** task_id（kill用） */
  taskId: string;
  /** サーバからのイベントストリーム */
  events: AsyncIterable<ExecInteractiveEvent>;
  /** stdin にデータを書き込む */
  writeStdin(data: string): void;
  /** stdin を閉じる（EOF） */
  closeStdin(): void;
  /** gRPC ストリームをキャンセルする */
  cancel(): void;
}
