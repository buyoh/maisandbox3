import { createStore } from 'jotai';
import {
  trackedTasksAtom,
  taskResultsAtom,
  activeTaskIndexAtom,
  activeBadgeIndexAtom,
  registerTaskAtom,
  addPhaseBadgeAtom,
  updateTaskPhaseAtom,
  clearTaskResultsAtom,
  activeTaskErrlogAtom,
  activateTaskAtom,
  phaseStatusToColor,
  latestTaskIdByTypeAtom,
} from '../../../web/stores/status-atoms';
import { PhaseBadge } from '../../../web/stores/status/types';

const buildSuccessBadge: PhaseBadge = {
  phase: 'build',
  status: 'success',
  label: 'Build',
  details: null,
};

const buildErrorBadge: PhaseBadge = {
  phase: 'build',
  status: 'error',
  label: 'Build (exit=1)',
  details: [{ type: 'text', title: 'stderr', text: 'error: compile failed' }],
};

describe('status-atoms (new task status)', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  describe('registerTaskAtom', () => {
    it('タスクを登録し、一意な taskId を返す', () => {
      const id1 = store.set(registerTaskAtom, { clicmid: 10, type: 'single' });
      const id2 = store.set(registerTaskAtom, { clicmid: 20, type: 'single' });

      expect(id1).not.toBe(id2);
    });

    it('trackedTasksAtom にエントリを追加する', () => {
      store.set(registerTaskAtom, { clicmid: 5, type: 'single' });

      const tracked = store.get(trackedTasksAtom);
      expect(tracked).toHaveLength(1);
      expect(tracked[0].clicmid).toBe(5);
      expect(tracked[0].type).toBe('single');
    });

    it('taskResultsAtom に初期状態の badges=[] エントリを追加する', () => {
      store.set(registerTaskAtom, { clicmid: null, type: 'multi' });

      const results = store.get(taskResultsAtom);
      expect(results).toHaveLength(1);
      expect(results[0].phase).toBe('running');
      expect(results[0].badges).toHaveLength(0);
      expect(results[0].type).toBe('multi');
    });

    it('interactive タイプのタスクを登録できる', () => {
      store.set(registerTaskAtom, { clicmid: null, type: 'interactive' });

      const tracked = store.get(trackedTasksAtom);
      expect(tracked[0].type).toBe('interactive');
    });

    it('activeTaskIndexAtom を新しいタスクのインデックスに更新する', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      expect(store.get(activeTaskIndexAtom)).toBe(0);

      store.set(registerTaskAtom, { clicmid: 2, type: 'single' });
      expect(store.get(activeTaskIndexAtom)).toBe(1);
    });

    it('新しいタスク登録時に activeBadgeIndexAtom がリセットされる', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(activeBadgeIndexAtom, 2);

      store.set(registerTaskAtom, { clicmid: 2, type: 'single' });
      expect(store.get(activeBadgeIndexAtom)).toBeNull();
    });
  });

  describe('addPhaseBadgeAtom', () => {
    it('タスクのバッジリストにバッジを追加する', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

      store.set(addPhaseBadgeAtom, { taskId: id, badge: buildSuccessBadge });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(1);
      expect(results[0].badges[0]).toEqual(buildSuccessBadge);
    });

    it('複数バッジを時系列順に追加できる', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const runBadge: PhaseBadge = {
        phase: 'run',
        status: 'success',
        label: 'Run',
        details: null,
      };

      store.set(addPhaseBadgeAtom, { taskId: id, badge: buildSuccessBadge });
      store.set(addPhaseBadgeAtom, { taskId: id, badge: runBadge });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(2);
      expect(results[0].badges[0].phase).toBe('build');
      expect(results[0].badges[1].phase).toBe('run');
    });

    it('存在しない taskId への追加は何もしない', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

      store.set(addPhaseBadgeAtom, { taskId: 999, badge: buildSuccessBadge });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(0);
    });

    it('複数タスクが登録されている場合、正しいタスクのみ更新する', () => {
      const id1 = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const id2 = store.set(registerTaskAtom, { clicmid: 2, type: 'single' });

      store.set(addPhaseBadgeAtom, { taskId: id2, badge: buildSuccessBadge });

      const results = store.get(taskResultsAtom);
      expect(results[0].badges).toHaveLength(0); // task1 変更なし
      expect(results[1].badges).toHaveLength(1); // task2 更新
    });
  });

  describe('updateTaskPhaseAtom', () => {
    it('タスクの phase を更新する', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

      store.set(updateTaskPhaseAtom, { taskId: id, phase: 'completed' });

      const results = store.get(taskResultsAtom);
      expect(results[0].phase).toBe('completed');
    });

    it('failed フェーズに更新できる', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

      store.set(updateTaskPhaseAtom, { taskId: id, phase: 'failed' });

      const results = store.get(taskResultsAtom);
      expect(results[0].phase).toBe('failed');
    });

    it('存在しない taskId への更新は何もしない', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });

      store.set(updateTaskPhaseAtom, { taskId: 999, phase: 'completed' });

      const results = store.get(taskResultsAtom);
      expect(results[0].phase).toBe('running'); // 変更なし
    });
  });

  describe('clearTaskResultsAtom', () => {
    it('全タスク結果をクリアする', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(registerTaskAtom, { clicmid: 2, type: 'multi' });

      store.set(clearTaskResultsAtom);

      expect(store.get(trackedTasksAtom)).toHaveLength(0);
      expect(store.get(taskResultsAtom)).toHaveLength(0);
      expect(store.get(activeTaskIndexAtom)).toBeNull();
      expect(store.get(activeBadgeIndexAtom)).toBeNull();
    });

    it('latestTaskIdByTypeAtom を全 null にリセットする', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(registerTaskAtom, { clicmid: null, type: 'multi' });
      store.set(registerTaskAtom, { clicmid: null, type: 'interactive' });

      store.set(clearTaskResultsAtom);

      const latest = store.get(latestTaskIdByTypeAtom);
      expect(latest.single).toBeNull();
      expect(latest.multi).toBeNull();
      expect(latest.interactive).toBeNull();
    });
  });

  describe('activateTaskAtom', () => {
    it('activeTaskIndexAtom を設定する', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(registerTaskAtom, { clicmid: 2, type: 'single' });

      store.set(activateTaskAtom, 0);
      expect(store.get(activeTaskIndexAtom)).toBe(0);

      store.set(activateTaskAtom, 1);
      expect(store.get(activeTaskIndexAtom)).toBe(1);
    });
  });

  describe('phaseStatusToColor', () => {
    it('success → success', () => expect(phaseStatusToColor('success')).toBe('success'));
    it('error → red', () => expect(phaseStatusToColor('error')).toBe('red'));
    it('warning → warning', () => expect(phaseStatusToColor('warning')).toBe('warning'));
    it('started → light', () => expect(phaseStatusToColor('started')).toBe('light'));
  });

  describe('latestTaskIdByTypeAtom', () => {
    it('single タイプ登録時に latestTaskIdByTypeAtom.single が更新される', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const latest = store.get(latestTaskIdByTypeAtom);
      expect(latest.single).toBe(id);
      expect(latest.multi).toBeNull();
      expect(latest.interactive).toBeNull();
    });

    it('multi タイプ登録時に latestTaskIdByTypeAtom.multi が更新される', () => {
      const id = store.set(registerTaskAtom, { clicmid: null, type: 'multi' });
      expect(store.get(latestTaskIdByTypeAtom).multi).toBe(id);
    });

    it('interactive タイプ登録時に latestTaskIdByTypeAtom.interactive が更新される', () => {
      const id = store.set(registerTaskAtom, { clicmid: null, type: 'interactive' });
      expect(store.get(latestTaskIdByTypeAtom).interactive).toBe(id);
    });

    it('同一タイプを 2 回登録すると最新の taskId のみ保持される', () => {
      store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const id2 = store.set(registerTaskAtom, { clicmid: 2, type: 'single' });
      expect(store.get(latestTaskIdByTypeAtom).single).toBe(id2);
    });
  });

  describe('activeTaskErrlogAtom (最新 single タイプベース)', () => {
    it('最新の single タスクの errlog を返す', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const badge: PhaseBadge = {
        phase: 'build',
        status: 'error',
        label: 'Build',
        details: [{ type: 'text', title: 'stderr', text: 'compile error' }],
      };
      store.set(addPhaseBadgeAtom, { taskId: id, badge });
      expect(store.get(activeTaskErrlogAtom)).toBe('compile error');
    });

    it('single タスクが未登録の場合は空文字を返す', () => {
      store.set(registerTaskAtom, { clicmid: null, type: 'multi' }); // single は登録しない
      expect(store.get(activeTaskErrlogAtom)).toBe('');
    });

    it('clearTaskResultsAtom 後に空文字を返す', () => {
      const id = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      const badge: PhaseBadge = {
        phase: 'build',
        status: 'error',
        label: 'Build',
        details: [{ type: 'text', title: 'stderr', text: 'error' }],
      };
      store.set(addPhaseBadgeAtom, { taskId: id, badge });

      store.set(clearTaskResultsAtom);

      expect(store.get(activeTaskErrlogAtom)).toBe('');
    });

    it('single タイプタスクを 2 回登録したとき、最新の errlog を返す', () => {
      const id1 = store.set(registerTaskAtom, { clicmid: 1, type: 'single' });
      store.set(addPhaseBadgeAtom, {
        taskId: id1,
        badge: {
          phase: 'build',
          status: 'error',
          label: 'Build',
          details: [{ type: 'text', title: 'stderr', text: 'old error' }],
        },
      });

      const id2 = store.set(registerTaskAtom, { clicmid: 2, type: 'single' });
      store.set(addPhaseBadgeAtom, {
        taskId: id2,
        badge: {
          phase: 'build',
          status: 'error',
          label: 'Build',
          details: [{ type: 'text', title: 'stderr', text: 'new error' }],
        },
      });

      expect(store.get(activeTaskErrlogAtom)).toBe('new error');
    });
  });
});
