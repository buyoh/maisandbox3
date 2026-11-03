import { createStore } from 'jotai';
import { TaskStatusListener } from '../../../web/services/task-status-listener';
import { SocketInterface } from '../../../web/services/client-socket';
import {
  trackedTasksAtom,
  taskResultsAtom,
  registerTaskAtom,
} from '../../../web/stores/status-atoms';
import { TaskResult } from '../../../interfaces/result-types';

/** テスト用 SocketInterface スタブ */
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

  /** テスト用: taskResult イベントを発火 */
  fireTaskResult(data: TaskResult): void {
    for (const h of this.handlers) {
      h(data);
    }
  }
}

describe('TaskStatusListener', () => {
  let store: ReturnType<typeof createStore>;
  let socket: StubSocket;
  let listener: TaskStatusListener;

  beforeEach(() => {
    store = createStore();
    socket = new StubSocket();
    listener = new TaskStatusListener(store);
  });

  describe('バッジ追加（フェーズ別）', () => {
    it('build フェーズ結果でバッジが追加される', () => {
      store.set(registerTaskAtom, { clicmid: 5, type: 'single' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 5 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: true,
        running: true,
        details: [
          { type: 'status', status: 'success' },
          { type: 'param', key: 'exitstatus', value: 0 },
        ],
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0].phase).toBe('build');
      expect(results[0].badges[0].status).toBe('success');
      expect(results[0].badges[0].label).toBe('Build');
      expect(results[0].phase).toBe('running'); // まだ running
    });

    it('build → run → completed で 3 つのバッジが蓄積される', () => {
      store.set(registerTaskAtom, { clicmid: 10, type: 'single' });
      listener.attach(socket);

      // Build フェーズ
      socket.fireTaskResult({
        id: { clicmid: 10 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: true,
        running: true,
        details: [{ type: 'status', status: 'success' }],
      });

      // Run フェーズ
      socket.fireTaskResult({
        id: { clicmid: 10 },
        success: true,
        summary: 'result(run)',
        phase: 'run',
        continue: false,
        details: [{ type: 'status', status: 'success' }],
      });

      // Completed
      socket.fireTaskResult({
        id: { clicmid: 10 },
        success: true,
        summary: 'completed',
        phase: 'completed',
        continue: false,
        details: [{ type: 'param', key: 'total_time', value: 1.0 }],
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(3);
      expect(results[0].badges[0].phase).toBe('build');
      expect(results[0].badges[1].phase).toBe('run');
      expect(results[0].badges[2].phase).toBe('completed');
      expect(results[0].badges[2].label).toBe('Completed');
      expect(results[0].phase).toBe('completed');
    });

    it('ビルドエラー時にバッジ 1 つ + phase=failed', () => {
      store.set(registerTaskAtom, { clicmid: 11, type: 'single' });
      listener.attach(socket);

      // Build フェーズ失敗
      socket.fireTaskResult({
        id: { clicmid: 11 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: false,
        details: [
          { type: 'status', status: 'warning' },
          { type: 'param', key: 'exitstatus', value: 1 },
          { type: 'log', text: 'compile error' },
        ],
      });

      // Failed イベント（ビルドエラー後）
      socket.fireTaskResult({
        id: { clicmid: 11 },
        success: false,
        summary: 'build: BUILD_ERROR',
        phase: 'build',
        continue: false,
        details: [
          { type: 'status', status: 'error' },
          { type: 'text', title: 'reason', text: 'build failed' },
        ],
      });

      const results = store.get(taskResultsAtom);
      // バッジは build フェーズのもの 1 つのみ（failed イベントはバッジ追加しない）
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0].phase).toBe('build');
      expect(results[0].phase).toBe('failed');
    });

    it('タイムアウト時（バッジなしの状態で failed イベント）はバッジを追加する', () => {
      store.set(registerTaskAtom, { clicmid: 12, type: 'single' });
      listener.attach(socket);

      // 前フェーズなしで failed イベント
      socket.fireTaskResult({
        id: { clicmid: 12 },
        success: false,
        summary: 'timeout: TIMEOUT',
        phase: 'timeout',
        continue: false,
        details: [
          { type: 'status', status: 'error' },
          { type: 'text', title: 'reason', text: 'timed out' },
        ],
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0].phase).toBe('timeout');
      expect(results[0].badges[0].status).toBe('error');
      expect(results[0].phase).toBe('failed');
    });

    it('phase フィールドがない場合 summary からフェーズ名を抽出する（後方互換）', () => {
      store.set(registerTaskAtom, { clicmid: 13, type: 'single' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 13 },
        success: true,
        summary: 'result(transpile)',
        // phase フィールドなし
        continue: true,
        running: true,
        details: [{ type: 'status', status: 'success' }],
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0].phase).toBe('transpile');
    });
  });

  describe('未登録・複数タスクの処理', () => {
    it('未登録の clicmid のイベントは無視する', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 999 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: false,
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(0); // 変更なし
    });

    it('multi タイプのタスクには反応しない', () => {
      store.set(registerTaskAtom, { clicmid: null, type: 'multi' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 1 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: false,
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(0);
    });

    it('複数タスクが登録されている場合、正しいタスクのみ更新する', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(registerTaskAtom, { clicmid: 2, type: 'single' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 2 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: false,
        details: [{ type: 'status', status: 'success' }],
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(0); // task1 変更なし
      expect(results[1].badges).toHaveLength(1); // task2 更新
    });
  });

  describe('completed イベント', () => {
    it('summary が completed かつ continues=false で phase を completed に更新する', () => {
      store.set(registerTaskAtom, { clicmid: 3, type: 'single' });
      listener.attach(socket);

      socket.fireTaskResult({
        id: { clicmid: 3 },
        success: true,
        summary: 'completed',
        phase: 'completed',
        continue: false,
      });

      const results = store.get(taskResultsAtom);
      expect(results[0].phase).toBe('completed');
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0].label).toBe('Completed');
    });
  });

  describe('detach', () => {
    it('detach 後のイベントはバッジ追加・フェーズ更新に影響しない', () => {
      store.set(registerTaskAtom, { clicmid: 4, type: 'single' });
      listener.attach(socket);

      // attach 中のイベント → バッジ追加される
      socket.fireTaskResult({
        id: { clicmid: 4 },
        success: true,
        summary: 'result(build)',
        phase: 'build',
        continue: true,
        details: [{ type: 'status', status: 'success' }],
      });

      expect(store.get(taskResultsAtom)[0].badges).toHaveLength(1);

      // detach
      listener.detach();

      // detach 後のイベント → 無視される
      socket.fireTaskResult({
        id: { clicmid: 4 },
        success: true,
        summary: 'completed',
        phase: 'completed',
        continue: false,
      });

      const results = store.get(taskResultsAtom);
      // detach 後のバッジ追加なし
      expect(results[0].badges).toHaveLength(1);
      // phase も 'running' のまま
      expect(results[0].phase).toBe('running');
    });
  });
});
