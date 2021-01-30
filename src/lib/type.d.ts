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

export interface SubResult {
  exited: boolean;
}

export interface SubResultBox {
  exited: boolean;
  box?: string | null;
}

export interface SubResultExec {
  exited: boolean;
  err: string;
  out: string;
  exitstatus: number;
  annotations?: Annotation[];
  time: number;
}

export interface SubResultAccepted {
  exited: boolean;
}

export interface Result {
  id?: ClientJobID;
  success: boolean;
  taskid?: string;
  continue?: boolean;
  result?: SubResult | SubResultBox | SubResultExec;
  error?: string;
  summary?: string;
}
