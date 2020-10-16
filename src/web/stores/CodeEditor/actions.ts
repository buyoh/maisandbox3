import { CodeEditorActionTypes, UPDATE_KEYWORD } from './types';

export function updateKeyword(code: string): CodeEditorActionTypes {
  return {
    type: UPDATE_KEYWORD,
    code
  };
}