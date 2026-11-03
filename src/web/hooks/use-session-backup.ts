import { useEffect, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { codeAtom, langAtom } from '../stores/code-editor-atoms';
import { currentSessionIdAtom, sessionListAtom } from '../stores/session-atoms';
import {
  generateUUID,
  registerSession,
  saveSession,
  readSessionData,
  readSessionIndex,
  cleanupOrphanedSessions,
  migrateOldBackup,
  SessionData,
} from '../services/session-storage';

/** セッション ID を sessionStorage から取得または新規生成する */
function getOrCreateSessionId(sessionStorage: Storage): string {
  const key = 'msb3-session-id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = generateUUID();
  sessionStorage.setItem(key, id);
  return id;
}

/** セッションラベルを生成する（言語名 + 日時） */
function buildLabel(lang: string, now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${lang} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * マルチセッション対応バックアップフック。
 * セッション開始時にセッション ID を確定し、過去セッションを復元する。
 * 定期保存（60秒）・beforeunload・クリーンアップ時に localStorage へ保存する。
 *
 * @param localStorage_ テスト用に差し替え可能な Storage オブジェクト（デフォルト: window.localStorage）
 * @param sessionStorage_ テスト用に差し替え可能な Storage オブジェクト（デフォルト: window.sessionStorage）
 */
export function useSessionBackup(
  localStorage_?: Storage,
  sessionStorage_?: Storage
): void {
  const ls = localStorage_ ?? window.localStorage;
  const ss = sessionStorage_ ?? window.sessionStorage;

  const [code, setCode] = useAtom(codeAtom);
  const [lang, setLang] = useAtom(langAtom);
  const setCurrentSessionId = useSetAtom(currentSessionIdAtom);
  const setSessionList = useSetAtom(sessionListAtom);

  // stale closure 対策: ref で最新値を保持
  const codeRef = useRef(code);
  codeRef.current = code;
  const langRef = useRef(lang);
  langRef.current = lang;

  // 初期化・復元（マウント時に一度だけ実行）
  // ls / ss はマウント後に変わらない前提のため deps に含めない
  useEffect(() => {
    const now = Date.now();

    // 孤立データクリーンアップ
    cleanupOrphanedSessions(ls);

    // 旧データのマイグレーション
    migrateOldBackup(ls, now);

    // セッション ID を確定
    const sessionId = getOrCreateSessionId(ss);
    setCurrentSessionId(sessionId);

    // セッションをインデックスに登録（既存セッションの updatedAt 更新 or 新規追加）
    const label = buildLabel(langRef.current, now);
    registerSession(ls, sessionId, label, now);

    // セッション一覧を更新
    const index = readSessionIndex(ls);
    setSessionList(index.sessions);

    // 既存セッションのデータを復元
    const saved = readSessionData(ls, sessionId);
    if (saved) {
      const { codeEditorShell } = saved;
      if (typeof codeEditorShell.code === 'string') {
        setCode(codeEditorShell.code);
        codeRef.current = codeEditorShell.code;
      }
      if (typeof codeEditorShell.lang === 'string') {
        setLang(codeEditorShell.lang);
        langRef.current = codeEditorShell.lang;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 定期保存・beforeunload・クリーンアップ
  // NOTE: 復元 effect の後に宣言し、cleanup 内で正しい値を参照できるようにする
  // ls / ss はマウント後に変わらない前提のため deps に含めない
  useEffect(() => {
    const storeBackup = () => {
      const sessionId = ss.getItem('msb3-session-id');
      if (!sessionId) return;

      const data: SessionData = {
        codeEditorShell: {
          code: codeRef.current,
          lang: langRef.current,
        },
      };
      const now = Date.now();
      saveSession(ls, sessionId, data, now);

      // セッション一覧を更新（atom 経由の更新はフックの外からは行わないため
      // ここでは localStorage から再読み込みして更新する）
      const index = readSessionIndex(ls);
      setSessionList(index.sessions);
    };

    window.addEventListener('beforeunload', storeBackup);
    const backupIntervalMs = 60 * 1000;
    const timerId = window.setInterval(storeBackup, backupIntervalMs);

    return () => {
      window.removeEventListener('beforeunload', storeBackup);
      storeBackup();
      clearInterval(timerId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * 指定セッションのデータを読み込み、現在のエディタ状態に反映するユーティリティ。
 * SessionSidebar から手動復元時に使用する。
 *
 * @param localStorage_ テスト用に差し替え可能
 * @param sessionId 復元するセッション ID
 * @param setCode codeAtom の setter
 * @param setLang langAtom の setter
 * @returns 復元成功時 true、データなし時 false
 */
export function restoreSession(
  localStorage_: Storage,
  sessionId: string,
  setCode: (code: string) => void,
  setLang: (lang: string) => void
): boolean {
  const data = readSessionData(localStorage_, sessionId);
  if (!data) return false;

  const { codeEditorShell } = data;
  if (typeof codeEditorShell.code === 'string') {
    setCode(codeEditorShell.code);
  }
  if (typeof codeEditorShell.lang === 'string') {
    setLang(codeEditorShell.lang);
  }
  return true;
}
