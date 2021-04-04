import { ClientJobID } from './IDTypes';

export type Annotation = {
  row?: number;
  column?: number;
  text: string;
  type: string;
};

export interface ReportOutputItem {
  type: 'out';
  text: string;
}

export interface ReportErrorItem {
  type: 'log';
  text: string;
}

export interface ReportStatusItem {
  type: 'status';
  status: 'info' | 'success' | 'error' | 'warning';
}

export interface ReportDetailTextItem {
  type: 'text';
  title: string;
  text: string;
}

export interface ReportDetailParamItem {
  type: 'param';
  key: string;
  value: any;
}

export interface ReportAnnotationsItem {
  type: 'annotation';
  annotations: Annotation[];
}

export type ReportItem =
  | ReportOutputItem
  | ReportErrorItem
  | ReportStatusItem
  | ReportDetailTextItem
  | ReportDetailParamItem
  | ReportAnnotationsItem;

export interface Result {
  id?: ClientJobID; // Queryに対応するid
  success: boolean; // 内部エラーが発生していないかどうか
  summary: string;
  continue?: boolean; // 次に結果が返るかどうか
  running?: boolean; // 実行が完了していない場合はtrue
  details?: ReportItem[];
}
