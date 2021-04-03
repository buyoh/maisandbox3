import { StatusActionTypes } from './types';
import * as Types from './types';
import { ExecResult } from '../../containers/StatusShell';

export function activateResult(index: number): StatusActionTypes {
  return {
    type: Types.K_A_ACTIVATE_STATUS,
    index,
  };
}

export function addResult(result: ExecResult): StatusActionTypes {
  return {
    type: Types.K_A_ADD_RESULT,
    result,
  };
}

export function removeAllResults(): StatusActionTypes {
  return {
    type: Types.K_A_REMOVEALL_RESULTS,
  };
}
