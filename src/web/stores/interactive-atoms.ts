import { atom } from 'jotai';

/** 出力バッファ（チャンク配列） */
export const interactiveOutputAtom = atom<string[]>([]);

/** 入力テキスト */
export const interactiveInputAtom = atom('');

/** 実行状態 */
export const interactiveRunningAtom = atom(false);

/** stdin が閉じられたか */
export const interactiveStdinClosedAtom = atom(false);

/** 出力バッファの合計サイズ上限（1MB） */
const OUTPUT_BUFFER_LIMIT = 1024 * 1024;

/** 出力バッファに追記する write-only atom。上限超過時は先頭チャンクを破棄する */
export const appendInteractiveOutputAtom = atom(
  null,
  (get, set, chunk: string) => {
    let current = get(interactiveOutputAtom);
    current = [...current, chunk];
    let totalSize = current.reduce((sum, c) => sum + c.length, 0);
    while (totalSize > OUTPUT_BUFFER_LIMIT && current.length > 1) {
      totalSize -= current[0].length;
      current = current.slice(1);
    }
    set(interactiveOutputAtom, current);
  }
);

/** 出力バッファをクリアする write-only atom */
export const clearInteractiveOutputAtom = atom(null, (_get, set) => {
  set(interactiveOutputAtom, []);
});
