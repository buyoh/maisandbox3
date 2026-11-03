import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { useStatusBarListener } from '../../../web/hooks/use-status-bar-listener';
import { SocketInterface } from '../../../web/services/client-socket';
import {
  taskResultsAtom,
  registerTaskAtom,
} from '../../../web/stores/status-atoms';
import { TaskStatusEntry } from '../../../web/stores/status/types';
import { TaskResult } from '../../../interfaces/result-types';
import { createStore } from 'jotai';

class StubSocket implements SocketInterface {
  private handlers: Array<(data: TaskResult) => void> = [];

  emitRunSingleTask(): void {}
  emitKill(): void {}
  emitRunInteractiveTask(): void {}
  emitInteractiveStdin(): void {}
  emitInteractiveCloseStdin(): void {}
  onInteractiveOutput(): void {}
  disconnect(): void {}

  onTaskResult(handler: (data: TaskResult) => void): void {
    this.handlers.push(handler);
  }

  fireTaskResult(data: TaskResult): void {
    for (const h of this.handlers) {
      h(data);
    }
  }
}

describe('useStatusBarListener', () => {
  it('socket を attach してタスクイベントを taskResultsAtom に反映する', () => {
    const socket = new StubSocket();
    const store = createStore();

    // タスクを事前登録
    store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

    let results: TaskStatusEntry[] = [];

    function TestComponent() {
      useStatusBarListener(socket);
      results = useAtomValue(taskResultsAtom);
      return null;
    }

    render(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    );

    // イベント発火
    act(() => {
      socket.fireTaskResult({
        id: { clicmid: 1 },
        success: true,
        summary: 'completed',
        phase: 'completed',
        continue: false,
        details: [{ type: 'status', status: 'success' }],
      });
    });

    expect(results[0].badges).toHaveLength(1);
    expect(results[0].badges[0].label).toBe('Completed');
    expect(results[0].phase).toBe('completed');
  });

  it('socket が null の場合は attach しない', () => {
    const store = createStore();

    function TestComponent() {
      useStatusBarListener(null);
      return null;
    }

    // エラーなく render できることを確認
    const { unmount } = render(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    );

    unmount();
  });

  it('アンマウント時に detach される（detach 後のイベントは無視）', () => {
    const socket = new StubSocket();
    const store = createStore();

    store.set(registerTaskAtom, { clicmid: 2, type: 'single' });

    function TestComponent() {
      useStatusBarListener(socket);
      return null;
    }

    const { unmount } = render(
      <Provider store={store}>
        <TestComponent />
      </Provider>
    );

    unmount();

    // detach 後のイベントは処理されない
    act(() => {
      socket.fireTaskResult({
        id: { clicmid: 2 },
        success: true,
        summary: 'After unmount',
        continue: false,
      });
    });

    const results = store.get(taskResultsAtom);
    expect(results[0].badges).toHaveLength(0); // detach 後はバッジが追加されない
  });
});
