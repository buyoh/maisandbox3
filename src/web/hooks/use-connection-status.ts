import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { ConnectionEventSource } from '../services/client-socket';
import { wsStatusAtom, launcherStatusAtom } from '../stores/connection-atoms';

/**
 * Socket.IO の接続ライフサイクルイベントを購読し、
 * 接続状態 atoms を更新するカスタムフック。
 * pages/index.tsx レベルで1度だけ呼び出す。
 */
export function useConnectionStatus(
  events: ConnectionEventSource | null
): void {
  const setWsStatus = useSetAtom(wsStatusAtom);
  const setLauncherStatus = useSetAtom(launcherStatusAtom);

  useEffect(() => {
    if (!events) return;

    const handleConnect = () => setWsStatus('connected');
    const handleDisconnect = () => setWsStatus('disconnected');
    const handleLauncherStatus = (data: {
      status: 'connected' | 'disconnected';
    }) => {
      setLauncherStatus(data.status);
    };

    events.onConnect(handleConnect);
    events.onDisconnect(handleDisconnect);
    events.onLauncherStatus(handleLauncherStatus);

    return () => {
      events.offAll();
    };
  }, [events, setWsStatus, setLauncherStatus]);
}
