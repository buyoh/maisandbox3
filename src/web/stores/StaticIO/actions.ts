import { StaticIOActionTypes } from './types';
import * as Types from './types';

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
