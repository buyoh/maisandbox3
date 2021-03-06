import { ClientJobID } from './IDTypes';

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
