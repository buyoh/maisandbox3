import { atom } from 'jotai';
import type { SessionMeta } from '../services/session-storage';

/**
 * 現在のブラウザウィンドウのセッション ID。
 * sessionStorage から取得または新規生成される。
 * undefined の間は初期化未完了を示す。
 */
export const currentSessionIdAtom = atom<string | undefined>(undefined);

/**
 * セッション一覧メタ情報。
 * use-session-backup フックが起動時に読み込み、保存時に更新する。
 */
export const sessionListAtom = atom<SessionMeta[]>([]);

/**
 * サイドバーの開閉状態。
 * true = 開いている。localStorage には保存しない（常に閉じた状態で起動）。
 */
export const sidebarOpenAtom = atom<boolean>(false);
