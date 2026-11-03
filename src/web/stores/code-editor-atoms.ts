import { atom } from 'jotai';
import type { Annotation } from '../../interfaces/result-types';

export const codeAtom = atom('');
export const langAtom = atom('ruby');
export const annotationsAtom = atom<Annotation[]>([]);

/** annotationsAtom に追記する write-only atom */
export const addAnnotationsAtom = atom(
  null,
  (get, set, annotations: Annotation[]) => {
    set(annotationsAtom, [...get(annotationsAtom), ...annotations]);
  }
);

/** annotationsAtom を全クリアする write-only atom */
export const clearAnnotationsAtom = atom(null, (_get, set) => {
  set(annotationsAtom, []);
});
