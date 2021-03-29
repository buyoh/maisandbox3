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

export interface QueryData {
  action: QueryActions;
  code: string;
  lang: string;
  stdin: string;
}

export interface Query {
  id?: ClientJobID;
  data: QueryData;
}

export interface SubResultExec {
  // TODO: ResultDetailに変更
  exited: boolean; // TODO: 消す。実装が追従出来ていないC++の為に残している
  err: string; // 形式について要考察
  out: string;
  exitstatus: number;
  annotations?: Annotation[];
  time: number; // TODO: 実は使っていない UI上ではsummaryに埋め込んだ値を使っている err/outと同時に再考
}

export interface Result {
  id?: ClientJobID; // Queryに対応するid
  success: boolean; // 内部エラーが発生していないかどうか
  continue?: boolean; // 次に結果が返るかどうか
  running?: boolean; // 実行が完了していない場合はtrue note: SubResultExec.exitedの代替 しかし、実行結果の色変更・outの消去防止にしか使われていない
  result?: SubResultExec;
  error?: string;
  summary?: string; // TODO: labelにリネームする
}

// TODO: ファイル名をQueryResultTypes.tsか何かに変更
