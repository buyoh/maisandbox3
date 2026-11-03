/** 複数 stdin 実行結果。stdinIndex で各 stdin を識別する。 */
export interface MultiRunResult {
  stdinIndex: number;
  exitStatus: number;
  timeMs: number;
  stdout: string;
  stderr: string;
}

/** ビルドフェーズ結果。multi-stdio 実行のビルドステップで使用。 */
export interface BuildPhaseResult {
  /** ビルドフェーズ名（例: "compile"） */
  phase: string;
  exitStatus: number;
  timeMs: number;
  stdout: string;
  stderr: string;
}
