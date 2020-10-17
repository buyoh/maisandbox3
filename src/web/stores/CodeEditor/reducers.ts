import { CodeEditorActionTypes, CodeEditorState } from './types';
import * as Types from './types';

const initialState: CodeEditorState = {
  code: '',
  lang: 'ruby',
  annotations: [],
};

export function codeEditorReducer(
  state = initialState,
  action: CodeEditorActionTypes): CodeEditorState {
  switch (action.type) {
  case Types.K_A_UPDATE_CODE:
    return {
      ...state,
      code: action.code
    };
  case Types.K_A_UPDATE_LANG:
    return {
      ...state,
      lang: action.lang
    };
  case Types.K_A_ADDLIST_ANNOTATIONS:
    return {
      ...state,
      annotations: [...state.annotations, ...action.annotations]
    };
  case Types.K_A_REMOVEALL_ANNOTATIONS:
    return {
      ...state,
      annotations: []
    };
  default:
    return state;
  }
}
