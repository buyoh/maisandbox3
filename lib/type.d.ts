export type Annotation = {
  row?: number;
  column?: number;
  text: string;
  type: string;
};

export interface JobID {
  clicmid?: number,  // client callback manager id
}

export interface WorkID {
  jid?: JobID,
  sid?: string,  // socketio identifier
  lcmid?: string,  // launcher callback manager id
  // cbmid?: string
}

export type QueryActions = 'run' | 'kill';

export interface QueryData {
  action: QueryActions,
  code: string,
  lang: string,
  stdin: string
}

export interface Query {
  id?: JobID,
  data: QueryData,
}

export interface SubResult {
  exited: boolean
}

export interface SubResultBox {
  exited: boolean,
  box?: string | null
}

export interface SubResultExec {
  exited: boolean,
  err: string,
  out: string,
  exitstatus: number,
  annotations?: Annotation[],
  time: number,
}

export interface SubResultAccepted {
  exited: boolean
}

export interface Result {
  id?: JobID | WorkID,
  success: boolean,
  taskid?: number,  // << ???
  continue?: boolean,
  result?: SubResult | SubResultBox | SubResultExec
  error?: string,
  summary?: string,
}
