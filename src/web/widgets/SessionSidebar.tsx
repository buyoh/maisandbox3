import React, { useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { currentSessionIdAtom, sessionListAtom, sidebarOpenAtom } from '../stores/session-atoms';
import { codeAtom, langAtom } from '../stores/code-editor-atoms';
import {
  deleteSession,
  readSessionIndex,
  saveSession,
  SessionData,
} from '../services/session-storage';
import { restoreSession } from '../hooks/use-session-backup';
import SessionListItem from '../components/SessionListItem';

type SessionSidebarProps = {
  /** テスト用に差し替え可能な Storage */
  localStorage_?: Storage;
  /**
   * 復元前の確認ダイアログ。true を返した場合のみ復元実行する。
   * 未指定の場合は window.confirm を使用する。
   */
  confirmRestore?: (message: string) => boolean;
  /**
   * 削除不可時のアラート。
   * 未指定の場合は window.alert を使用する。
   */
  alertMessage?: (message: string) => void;
};

/**
 * セッション一覧を表示するサイドバーウィジェット。
 * sidebarOpenAtom が true のときに表示される。
 */
export default function SessionSidebar({
  localStorage_,
  confirmRestore,
  alertMessage,
}: SessionSidebarProps): JSX.Element {
  const ls = localStorage_ ?? window.localStorage;
  const doConfirm = confirmRestore ?? ((msg) => window.confirm(msg));
  const doAlert = alertMessage ?? ((msg) => window.alert(msg));

  const [open, setOpen] = useAtom(sidebarOpenAtom);
  const [sessionList, setSessionList] = useAtom(sessionListAtom);
  const currentSessionId = useAtomValue(currentSessionIdAtom);
  const [code, setCode] = useAtom(codeAtom);
  const [lang, setLang] = useAtom(langAtom);

  const handleRestore = useCallback(
    (id: string) => {
      if (id === currentSessionId) return;

      const confirmed = doConfirm(
        'このセッションを復元しますか？現在の状態を先に保存します。'
      );
      if (!confirmed) return;

      // 現在のセッションを保存してから復元
      if (currentSessionId) {
        const data: SessionData = {
          codeEditorShell: { code, lang },
        };
        saveSession(ls, currentSessionId, data, Date.now());
      }

      restoreSession(ls, id, setCode, setLang);

      // セッション一覧の updatedAt を反映
      const updated = readSessionIndex(ls);
      setSessionList(updated.sessions);
    },
    [currentSessionId, code, lang, ls, setCode, setLang, doConfirm, setSessionList]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (id === currentSessionId) {
        doAlert('現在のセッションは削除できません。');
        return;
      }
      deleteSession(ls, id);
      const updated = readSessionIndex(ls);
      setSessionList(updated.sessions);
    },
    [currentSessionId, ls, setSessionList, doAlert]
  );

  if (!open) return <></>;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '280px',
        height: '100vh',
        background: '#1e1e1e',
        borderLeft: '1px solid #444',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
      }}
      data-testid="session-sidebar"
    >
      <div
        style={{
          padding: '12px 8px',
          borderBottom: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: '0.9em' }}>
          セッション一覧
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#aaa',
            fontSize: '1.2em',
          }}
          aria-label="サイドバーを閉じる"
          data-testid="sidebar-close"
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessionList.length === 0 && (
          <div style={{ padding: '16px', color: '#888', fontSize: '0.85em' }}>
            セッションがありません
          </div>
        )}
        {[...sessionList]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((session) => (
            <SessionListItem
              key={session.id}
              id={session.id}
              label={session.label}
              updatedAt={session.updatedAt}
              isCurrent={session.id === currentSessionId}
              onRestore={handleRestore}
              onDelete={handleDelete}
            />
          ))}
      </div>
    </div>
  );
}
