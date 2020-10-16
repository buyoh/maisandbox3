import { CodeEditorActionTypes, CodeEditorState, UPDATE_KEYWORD } from './types';

const initialState: CodeEditorState = {
  code: ''
};

export function codeEditorReducer(
  state = initialState,
  action: CodeEditorActionTypes): CodeEditorState {
  switch (action.type) {
  case UPDATE_KEYWORD:
    return {
      code: action.code
    };
  default:
    return state;
  }
}
