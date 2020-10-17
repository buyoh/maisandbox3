import { CodeEditorActionTypes } from './types';
import * as Types from './types';
import { Annotation } from '../../../lib/type';

export function updateCode(code: string): CodeEditorActionTypes {
  return {
    type: Types.K_A_UPDATE_CODE,
    code
  };
}

export function updateLang(lang: string): CodeEditorActionTypes {
  return {
    type: Types.K_A_UPDATE_LANG,
    lang
  };
}

export function addAnnotations(annotations: Annotation[]): CodeEditorActionTypes {
  return {
    type: Types.K_A_ADDLIST_ANNOTATIONS,
    annotations
  };
}

export function removeAllAnnotations() : CodeEditorActionTypes {
  return {
    type: Types.K_A_REMOVEALL_ANNOTATIONS
  };
}
