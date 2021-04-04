import { Annotation } from '../../../lib/ResultTypes';

export interface CodeEditorState {
  code: string;
  lang: string;
  annotations: Annotation[];
}

export const K_A_UPDATE_CODE = 'codeeditor/code/update';

interface ActionUpdateCode {
  type: typeof K_A_UPDATE_CODE;
  code: string;
}

export const K_A_UPDATE_LANG = 'codeeditor/lang/update';

interface ActionUpdateLang {
  type: typeof K_A_UPDATE_LANG;
  lang: string;
}

export const K_A_ADDLIST_ANNOTATIONS = 'codeeditor/annotation/addlist';

interface ActionAddAnnotations {
  type: typeof K_A_ADDLIST_ANNOTATIONS;
  annotations: Annotation[];
}

export const K_A_REMOVEALL_ANNOTATIONS = 'codeeditor/annotation/removeAll';

interface ActionRemoveAllAnnotations {
  type: typeof K_A_REMOVEALL_ANNOTATIONS;
}

export type CodeEditorActionTypes =
  | ActionUpdateCode
  | ActionUpdateLang
  | ActionAddAnnotations
  | ActionRemoveAllAnnotations;
