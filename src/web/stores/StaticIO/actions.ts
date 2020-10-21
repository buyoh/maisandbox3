import { StaticIOActionTypes } from './types';
import * as Types from './types';
import { ExecResult } from '../../containers/StaticIOShell';

export function updateStdin(stdin: string): StaticIOActionTypes {
  return {
    type: Types.K_A_UPDATE_STDIN,
    stdin,
  };
}

export function updateStdout(stdout: string): StaticIOActionTypes {
  return {
    type: Types.K_A_UPDATE_STDOUT,
    stdout,
  };
}

export function activateResult(index: number): StaticIOActionTypes {
  return {
    type: Types.K_A_ACTIVATE_STATUS,
    index,
  };
}

export function addResult(result: ExecResult): StaticIOActionTypes {
  return {
    type: Types.K_A_ADD_RESULT,
    result,
  };
}

export function removeAllResults(): StaticIOActionTypes {
  return {
    type: Types.K_A_REMOVEALL_RESULTS,
  };
}
