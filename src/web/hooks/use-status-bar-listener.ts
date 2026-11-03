import { useEffect, useRef } from 'react';
import { useStore } from 'jotai';
import type { SocketInterface } from '../services/client-socket';
import { TaskStatusListener } from '../services/task-status-listener';

/**
 * ステータスバーのイベント購読を管理するフック。
 * StatusShell でこのフックを呼ぶことで、タスクイベントが自動的に
 * taskResultsAtom に反映される。
 */
export function useStatusBarListener(socket: SocketInterface | null): void {
  const store = useStore();
  const listenerRef = useRef<TaskStatusListener | null>(null);

  useEffect(() => {
    if (!socket) return;

    const listener = new TaskStatusListener(store);
    listener.attach(socket);
    listenerRef.current = listener;

    return () => {
      listener.detach();
      listenerRef.current = null;
    };
  }, [socket, store]);
}
