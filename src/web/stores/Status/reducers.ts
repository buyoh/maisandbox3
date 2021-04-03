import { StatusActionTypes, StatusState } from './types';
import * as Types from './types';

const initialState: StatusState = {
  results: [],
  activatedResultIndex: null,
};

export function statusReducer(
  state = initialState,
  action: StatusActionTypes
): StatusState {
  switch (action.type) {
    case Types.K_A_ACTIVATE_STATUS:
      return {
        ...state,
        activatedResultIndex: action.index,
      };
    case Types.K_A_ADD_RESULT:
      return {
        ...state,
        activatedResultIndex: state.results.length,
        results: [...state.results, action.result],
      };
    case Types.K_A_REMOVEALL_RESULTS:
      return {
        ...state,
        activatedResultIndex: null,
        results: [],
      };
    default:
      return state;
  }
}
