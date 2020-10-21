import { ExecResult } from '../../containers/StaticIOShell';

export interface StaticIOState {
  stdin: string;
  stdout: string;
  results: Array<ExecResult>;
  activatedResultIndex: number | null;
}

export const K_A_UPDATE_STDIN = 'staticio/stdin/update';

interface ActionUpdateStdin {
  type: typeof K_A_UPDATE_STDIN;
  stdin: string;
}

export const K_A_UPDATE_STDOUT = 'staticio/stdout/update';

interface ActionUpdateStdout {
  type: typeof K_A_UPDATE_STDOUT;
  stdout: string;
}

export const K_A_ACTIVATE_STATUS = 'staticio/activatedStatus/set';

interface ActionActivateStatus {
  type: typeof K_A_ACTIVATE_STATUS;
  index: number;
}

export const K_A_ADD_RESULT = 'staticio/result/add';

interface ActionAddStatus {
  type: typeof K_A_ADD_RESULT;
  result: ExecResult;
}

export const K_A_REMOVEALL_RESULTS = 'staticio/result/removeAll';

interface ActionRemoveAllStatuses {
  type: typeof K_A_REMOVEALL_RESULTS;
}

export type StaticIOActionTypes =
  | ActionUpdateStdin
  | ActionUpdateStdout
  | ActionActivateStatus
  | ActionAddStatus
  | ActionRemoveAllStatuses;
