/** インタラクティブ実行の出力チャンク。 */
export interface InteractiveOutputChunk {
  stream: 'stdout' | 'stderr';
  data: string;
}

/** インタラクティブ実行の完了結果。 */
export interface InteractiveCompleteResult {
  exitStatus: number;
  timeMs: number;
  /** サーバから送られたフェーズ名。'killed' の場合はサーバ起因の強制終了 */
  phase?: string;
}

import type { ReportItem } from './result-types';

/** インタラクティブ実行のビルドフェーズ結果。 */
export interface InteractiveBuildResult {
  /** フェーズ名（例: "compile"） */
  phase: string;
  /** 終了コード。0 は成功 */
  exitStatus: number;
  /** 詳細情報。stdout ('out') を除いた items */
  details: ReportItem[] | null;
}
