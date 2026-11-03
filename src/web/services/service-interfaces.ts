import type {
  InteractiveOutputChunk,
  InteractiveCompleteResult,
  InteractiveBuildResult,
} from '../../interfaces/interactive-types';
import type {
  BuildPhaseResult,
  MultiRunResult,
} from '../../interfaces/multi-stdio-types';
import type {
  LangInfo,
  LangVersionResult,
} from '../../interfaces/lang-info-types';

/** インタラクティブ実行サービス */
export interface InteractiveService {
  start(lang: string, code: string): InteractiveHandle;
}

/** インタラクティブ実行のハンドル。出力受信・入力送信・終了を管理する。 */
export interface InteractiveHandle {
  onOutput(handler: (data: InteractiveOutputChunk) => void): void;
  onBuildResult(handler: (result: InteractiveBuildResult) => void): void;
  onComplete(handler: (result: InteractiveCompleteResult) => void): void;
  writeStdin(data: string): void;
  closeStdin(): void;
  kill(): void;
  dispose(): void;
}

/** Multi-stdio 実行サービス */
export interface MultiStdioService {
  run(lang: string, code: string, stdinList: string[]): MultiStdioHandle;
}

/** Multi-stdio 実行のハンドル。ビルド結果・各 stdin の実行結果・完了を管理する。 */
export interface MultiStdioHandle {
  onBuildResult(handler: (result: BuildPhaseResult) => void): void;
  onRunResult(handler: (result: MultiRunResult) => void): void;
  onComplete(handler: () => void): void;
  kill(): void;
  dispose(): void;
}

/** 言語情報サービス */
export interface LangInfoService {
  fetchLangInfo(): Promise<LangInfo[]>;
  fetchLangVersion(lang: string): Promise<LangVersionResult>;
}
