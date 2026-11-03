import React from 'react';
import type { ConnectionStatus } from '../../interfaces/socket-events';
import styles from './ConnectionIndicator.module.css';

type ConnectionIndicatorProps = {
  status: ConnectionStatus;
  label: string;
};

/** 接続状態を丸アイコンで表示する純粋コンポーネント */
function ConnectionIndicator({
  status,
  label,
}: ConnectionIndicatorProps): JSX.Element {
  const statusClass =
    status === 'connected' ? styles.connected : styles.disconnected;
  return (
    <div
      className={`${styles.indicator} ${statusClass}`}
      title={`${label}: ${status}`}
    >
      <span className={styles.dot} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}

export default ConnectionIndicator;
