import { StaticIOActionTypes, StaticIOState } from './types';
import * as Types from './types';

const initialState: StaticIOState = {
  stdin: '',
  stdout: '',
};

export function staticIOReducer(
  state = initialState,
  action: StaticIOActionTypes
): StaticIOState {
  switch (action.type) {
    case Types.K_A_UPDATE_STDIN:
      return {
        ...state,
        stdin: action.stdin,
      };
    case Types.K_A_UPDATE_STDOUT:
      return {
        ...state,
        stdout: action.stdout,
      };
    default:
      return state;
  }
}
