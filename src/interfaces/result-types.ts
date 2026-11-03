import { ClientJobID } from './id-types';

/** コードエディタ上のアノテーション（エラー・警告の位置情報） */
export type Annotation = {
  /** 行番号。0始まり。未指定の場合、特定の行に紐付かない */
  row?: number;
  /** 列番号。0始まり。未指定の場合、行全体を対象とする */
  column?: number;
  text: string;
  type: string;
};

/** 標準出力レポート項目 */
export interface ReportOutputItem {
  type: 'out';
  text: string;
}

/** エラーログレポート項目 */
export interface ReportErrorItem {
  type: 'log';
  text: string;
}

/** 実行ステータスレポート項目 */
export interface ReportStatusItem {
  type: 'status';
  status: 'info' | 'success' | 'error' | 'warning';
}

/** テキスト詳細レポート項目 */
export interface ReportDetailTextItem {
  type: 'text';
  title: string;
  text: string;
}

/** キーバリュー詳細レポート項目 */
export interface ReportDetailParamItem {
  type: 'param';
  key: string;
  value: unknown;
}

/** アノテーションレポート項目 */
export interface ReportAnnotationsItem {
  type: 'annotation';
  annotations: Annotation[];
}

/** タスク結果の各レポート項目の全バリエーション */
export type ReportItem =
  | ReportOutputItem
  | ReportErrorItem
  | ReportStatusItem
  | ReportDetailTextItem
  | ReportDetailParamItem
  | ReportAnnotationsItem;

/** タスク実行結果のデータ型 */
export interface TaskResult {
  /** コールバック紐付け用 ID。未指定の場合、ブロードキャスト的な通知として扱う */
  id?: ClientJobID;
  /** タスクの処理が正常に完了したかどうか */
  success: boolean;
  summary: string;
  /** 次に結果が返るかどうか。未指定の場合はこれが最後の結果 */
  continue?: boolean;
  /** タスクがまだ実行中であることを示す。完了判定は continue で行う */
  running?: boolean;
  /** 詳細レポート項目。未指定の場合は詳細情報なし */
  details?: ReportItem[];
  /** フェーズ名。サーバが各フェーズ結果に付与する（例: "build", "run", "completed"） */
  phase?: string;
}

/** インタラクティブ出力チャンク（Socket.IO イベントのペイロード） */
export interface InteractiveOutputData {
  id?: import('./id-types').ClientJobID;
  stream: 'stdout' | 'stderr';
  data: string;
}

/** @deprecated TaskResult を使用 */
export type Result = TaskResult;
