import { StaticIOActionTypes, StaticIOState } from './types';
import * as Types from './types';

const initialState: StaticIOState = {
  stdin: '', stdout: '',
  results: [],
  activatedResultIndex: null
};

export function staticIOReducer(
  state = initialState,
  action: StaticIOActionTypes): StaticIOState {
  switch (action.type) {
  case Types.K_A_UPDATE_STDIN:
    return {
      ...state,
      stdin: action.stdin
    };
  case Types.K_A_UPDATE_STDOUT:
    return {
      ...state,
      stdout: action.stdout
    };
  case Types.K_A_ACTIVATE_STATUS:
    return {
      ...state,
      activatedResultIndex: action.index
    };
  case Types.K_A_ADD_RESULT:
    return {
      ...state,
      activatedResultIndex: state.results.length,
      results: [...state.results, action.result]
    };
  case Types.K_A_REMOVEALL_RESULTS:
    return {
      ...state,
      activatedResultIndex: null,
      results: []
    };
  default:
    return state;
  }
}
