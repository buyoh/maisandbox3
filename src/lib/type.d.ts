export type Annotation = {
  row?: number;
  column?: number;
  text: string;
  type: string;
};

// clientがserverとのcallbackを識別するためのID
export interface ClientJobID {
  clicmid?: number; // client callback manager id
}

// serverがlauncherとのcallbackを識別するためのID
export interface LauncherQueryID {
  request_id?: string; // launcher callback manager id
  // user_id? : string; // equal to socketid
}

export type QueryActions = 'run' | 'kill';

// export interface QueryData {
//   code: string;
//   lang: string;
//   stdin: string;
// }

export interface QueryInitInfoFileStdin {
  type: 'filestdin';
  code: string;
  stdin: string;
}

export type QueryInitInfo = QueryInitInfoFileStdin;

interface QueryAbstruct {
  id?: ClientJobID;
}

export interface QueryInit extends QueryAbstruct {
  action: 'init';
  lang: string;
  info: QueryInitInfo;
}

export interface QueryKill extends QueryAbstruct {
  action: 'kill';
}

export type Query = QueryInit | QueryKill;

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

// TODO: ファイル名をQueryResultTypes.tsか何かに変更
