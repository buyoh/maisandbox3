import { ExecResult } from '../../containers/StatusShell';

export interface StatusState {
  results: Array<ExecResult>; // TODO: detach from StatusState
  activatedResultIndex: number | null;
}

export const K_A_ACTIVATE_STATUS = 'Status/activatedStatus/set';

interface ActionActivateStatus {
  type: typeof K_A_ACTIVATE_STATUS;
  index: number;
}

export const K_A_ADD_RESULT = 'Status/result/add';

interface ActionAddStatus {
  type: typeof K_A_ADD_RESULT;
  result: ExecResult;
}

export const K_A_REMOVEALL_RESULTS = 'Status/result/removeAll';

interface ActionRemoveAllStatuses {
  type: typeof K_A_REMOVEALL_RESULTS;
}

export type StatusActionTypes =
  | ActionActivateStatus
  | ActionAddStatus
  | ActionRemoveAllStatuses;
