import { TaskRunnerManager } from '../../../app/task-runner/task-runner-manager';

class StubTaskRunner {
  killed = false;
  kill(): void {
    this.killed = true;
  }
}

describe('TaskRunnerManager', () => {
  let manager: TaskRunnerManager;

  beforeEach(() => {
    manager = new TaskRunnerManager();
  });

  // --- 基本操作 ---

  test('#1 register → getTaskRunner returns registered runner', () => {
    const runner = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner as any);
    expect(manager.getTaskRunner({ clicmid: 1 })).toBe(runner);
  });

  test('#2 register → unregister → getTaskRunner returns undefined', () => {
    const runner = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner as any);
    manager.unregister({ clicmid: 1 });
    expect(manager.getTaskRunner({ clicmid: 1 })).toBeUndefined();
  });

  test('#3 getTaskRunner with unregistered ID returns undefined', () => {
    expect(manager.getTaskRunner({ clicmid: 99 })).toBeUndefined();
  });

  test('#4 multiple registers with different IDs are independent', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.register({ clicmid: 2 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 1 })).toBe(runner1);
    expect(manager.getTaskRunner({ clicmid: 2 })).toBe(runner2);
  });

  // --- cleanup ---

  test('#5 cleanup kills all registered tasks', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.register({ clicmid: 2 }, runner2 as any);
    manager.cleanup();
    expect(runner1.killed).toBe(true);
    expect(runner2.killed).toBe(true);
  });

  test('#6 cleanup makes all getTaskRunner return undefined', () => {
    const runner = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner as any);
    manager.cleanup();
    expect(manager.getTaskRunner({ clicmid: 1 })).toBeUndefined();
  });

  test('#7 cleanup with no tasks does not throw', () => {
    expect(() => manager.cleanup()).not.toThrow();
  });

  // --- 競合・エッジケース ---

  test('#8 duplicate register overwrites without killing the previous runner', () => {
    // Known issue: この動作はリソースリーク（孤立したタスク）を引き起こす可能性がある。
    // TaskRunnerManager は上書き時に既存 runner の kill を呼ばない。
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.register({ clicmid: 1 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 1 })).toBe(runner2);
    expect(runner1.killed).toBe(false); // 既存は kill されない
  });

  test('#9 re-register after unregister works normally', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.unregister({ clicmid: 1 });
    manager.register({ clicmid: 1 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 1 })).toBe(runner2);
  });

  test('#10 register after cleanup works normally', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.cleanup();
    manager.register({ clicmid: 2 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 2 })).toBe(runner2);
  });

  // --- keyFromClientJobID ---

  test('#11 different clicmid values produce different keys', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 1 }, runner1 as any);
    manager.register({ clicmid: 2 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 1 })).toBe(runner1);
    expect(manager.getTaskRunner({ clicmid: 2 })).toBe(runner2);
  });

  test('#12 undefined clicmid works normally', () => {
    const runner = new StubTaskRunner();
    manager.register({}, runner as any);
    expect(manager.getTaskRunner({})).toBe(runner);
  });

  test('#13 same clicmid values produce same key', () => {
    const runner1 = new StubTaskRunner();
    const runner2 = new StubTaskRunner();
    manager.register({ clicmid: 5 }, runner1 as any);
    manager.register({ clicmid: 5 }, runner2 as any);
    expect(manager.getTaskRunner({ clicmid: 5 })).toBe(runner2);
  });
});
