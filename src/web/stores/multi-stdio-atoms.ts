import { atom } from 'jotai';
import type {
  BuildPhaseResult,
  MultiRunResult,
} from '../../interfaces/multi-stdio-types';

/** 複数の stdin テキスト */
export const stdinListAtom = atom<string[]>(['']);

/** 選択中の stdin インデックス */
export const selectedStdinIndexAtom = atom(0);

/** ビルド結果 */
export const multiBuildResultAtom = atom<BuildPhaseResult | null>(null);

/** 各 stdin の実行結果 */
export const multiRunResultsAtom = atom<MultiRunResult[]>([]);

/** 実行中フラグ */
export const multiRunningAtom = atom(false);

/** stdin を追加する write-only atom。上限100件。 */
export const addStdinAtom = atom(null, (get, set) => {
  const list = get(stdinListAtom);
  if (list.length >= 100) return;
  set(stdinListAtom, [...list, '']);
  set(selectedStdinIndexAtom, list.length);
});

/** stdin を削除する write-only atom。最低1件は維持。 */
export const removeStdinAtom = atom(null, (get, set, index: number) => {
  const list = get(stdinListAtom);
  if (list.length <= 1) return;
  const newList = list.filter((_, i) => i !== index);
  set(stdinListAtom, newList);
  const selected = get(selectedStdinIndexAtom);
  if (selected >= newList.length) {
    set(selectedStdinIndexAtom, newList.length - 1);
  }
});
