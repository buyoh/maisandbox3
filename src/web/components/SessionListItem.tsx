import React from 'react';

type SessionListItemProps = {
  id: string;
  label: string;
  /** 最終保存時刻（Date.now() の number 値） */
  updatedAt: number;
  /** 現在のセッションかどうか */
  isCurrent: boolean;
  /** 現在時刻（Date.now()）。テスト用に注入可能 */
  now?: number;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * 経過時間を人間が読みやすい文字列に変換する。
 * 「○秒前」「○分前」「○時間前」「○日前」
 */
export function formatRelativeTime(updatedAt: number, now: number): string {
  const diffMs = now - updatedAt;
  if (diffMs < 0) return 'たった今';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

/**
 * セッション一覧の各行コンポーネント。
 */
export default function SessionListItem({
  id,
  label,
  updatedAt,
  isCurrent,
  now,
  onRestore,
  onDelete,
}: SessionListItemProps): JSX.Element {
  const currentNow = now ?? Date.now();
  const relative = formatRelativeTime(updatedAt, currentNow);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid #333',
        gap: '8px',
      }}
    >
      <button
        style={{
          flex: 1,
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'none',
          border: 'none',
          color: 'inherit',
          textAlign: 'left',
          padding: 0,
        }}
        onClick={() => onRestore(id)}
        data-testid={`session-item-${id}`}
      >
        <div
          style={{
            fontSize: '0.85em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
          {isCurrent && (
            <span
              style={{
                marginLeft: '6px',
                fontSize: '0.75em',
                background: '#4a8',
                color: '#fff',
                borderRadius: '3px',
                padding: '1px 4px',
              }}
            >
              現在
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75em', color: '#888' }}>{relative}</div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#888',
          fontSize: '1em',
          padding: '2px 4px',
          flexShrink: 0,
        }}
        title="削除"
        data-testid={`session-delete-${id}`}
        aria-label="セッションを削除"
      >
        🗑
      </button>
    </div>
  );
}
