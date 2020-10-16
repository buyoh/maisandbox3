export interface CodeEditorState {
  code: string,
}

export const UPDATE_KEYWORD = 'codeeditor-update-keyword';

interface CodeEditorAction {
  type: typeof UPDATE_KEYWORD
  code: string
}

export type CodeEditorActionTypes = CodeEditorAction
