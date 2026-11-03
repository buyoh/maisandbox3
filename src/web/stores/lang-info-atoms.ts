import { atom } from 'jotai';
import type { LangInfo } from '../../interfaces/lang-info-types';

/** 全言語のメタ情報リスト（ページ読み込み時に一括取得、グローバルキャッシュ） */
export const langInfoListAtom = atom<LangInfo[]>([]);
