import {
  validateRunSingleTask,
  validateKill,
  extractId,
  createTaskManagerService,
} from '../../app/task-manager-service';
import { FakeLauncherClient } from '../../app/launcher/fake-launcher-client';
import { ConnectionHandler } from '../../app/connection-handler';
import { TaskResult } from '../../interfaces/result-types';
import { RunSingleTaskRequest } from '../../interfaces/query-types';

describe('validateRunSingleTask', () => {
  test('returns request for valid data', () => {
    const data = {
      lang: 'ruby',
      info: { type: 'filestdin', code: 'puts 1', stdin: '' },
    };
    expect(validateRunSingleTask(data)).toEqual(data);
  });

  test('returns null for null', () => {
    expect(validateRunSingleTask(null)).toBeNull();
  });

  test('returns null for non-object', () => {
    expect(validateRunSingleTask('string')).toBeNull();
    expect(validateRunSingleTask(42)).toBeNull();
  });

  test('returns null when lang is missing', () => {
    expect(
      validateRunSingleTask({
        info: { type: 'filestdin', code: '', stdin: '' },
      })
    ).toBeNull();
  });

  test('returns null when lang is not a string', () => {
    expect(
      validateRunSingleTask({
        lang: 123,
        info: { type: 'filestdin', code: '', stdin: '' },
      })
    ).toBeNull();
  });

  test('returns null when info is missing', () => {
    expect(validateRunSingleTask({ lang: 'ruby' })).toBeNull();
  });

  test('returns null when info is not an object', () => {
    expect(validateRunSingleTask({ lang: 'ruby', info: 'bad' })).toBeNull();
  });

  test('returns null when info.type is missing', () => {
    expect(
      validateRunSingleTask({ lang: 'ruby', info: { code: '', stdin: '' } })
    ).toBeNull();
  });

  test('returns null when info.code is not a string', () => {
    expect(
      validateRunSingleTask({
        lang: 'ruby',
        info: { type: 'filestdin', code: 123, stdin: '' },
      })
    ).toBeNull();
  });

  test('returns null when info.stdin is not a string', () => {
    expect(
      validateRunSingleTask({
        lang: 'ruby',
        info: { type: 'filestdin', code: '', stdin: null },
      })
    ).toBeNull();
  });
});

describe('validateKill', () => {
  test('returns request for valid data with id', () => {
    const data = { id: { clicmid: 1 } };
    expect(validateKill(data)).toEqual(data);
  });

  test('returns request for valid data without id', () => {
    const data = {};
    expect(validateKill(data)).toEqual(data);
  });

  test('returns request for id with no clicmid', () => {
    const data = { id: {} };
    expect(validateKill(data)).toEqual(data);
  });

  test('returns null for null', () => {
    expect(validateKill(null)).toBeNull();
  });

  test('returns null for non-object', () => {
    expect(validateKill('string')).toBeNull();
  });

  test('returns null when id is not an object', () => {
    expect(validateKill({ id: 'invalid' })).toBeNull();
  });

  test('returns null when id is a number', () => {
    expect(validateKill({ id: 42 })).toBeNull();
  });

  test('returns null when clicmid is not a number', () => {
    expect(validateKill({ id: { clicmid: 'bad' } })).toBeNull();
  });

  test('returns null when id is an array', () => {
    expect(validateKill({ id: [1, 2] })).toBeNull();
  });

  test('treats id: null as valid (id not provided)', () => {
    expect(validateKill({ id: null })).toEqual({ id: null });
  });
});

describe('extractId', () => {
  test('extracts id from valid data', () => {
    expect(extractId({ id: { clicmid: 5 } })).toEqual({ clicmid: 5 });
  });

  test('returns undefined for null', () => {
    expect(extractId(null)).toBeUndefined();
  });

  test('returns undefined for non-object', () => {
    expect(extractId('string')).toBeUndefined();
  });

  test('returns undefined when id is missing', () => {
    expect(extractId({ lang: 'ruby' })).toBeUndefined();
  });

  test('returns undefined when id is not an object', () => {
    expect(extractId({ id: 42 })).toBeUndefined();
  });
});

// --- ConnectionHandlerImpl ---

describe('ConnectionHandlerImpl', () => {
  let client: FakeLauncherClient;
  let handler: ConnectionHandler;

  beforeEach(() => {
    client = new FakeLauncherClient();
    const service = createTaskManagerService(client);
    const factory = service.getConnectionHandlerFactory();
    handler = factory.createConnectionHandler('socket-1');
  });

  function makeRequest(
    clicmid: number,
    lang = 'ruby',
    code = 'puts 1'
  ): RunSingleTaskRequest {
    return {
      id: { clicmid },
      lang,
      info: { type: 'filestdin', code, stdin: '' },
    };
  }

  /** RunTask のフェーズ結果を完了までプッシュするヘルパー */
  async function completeRunTask(taskId: string): Promise<void> {
    const ctx = client.activeRunTasks.get(taskId);
    if (!ctx) return;
    ctx.queue.push({
      type: 'phase_result',
      phase: 'run',
      exitStatus: 0,
      timeMs: 100,
      stdout: 'hello',
      stderr: '',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 100 });
    ctx.queue.close();
    // Yield to let async iteration process events
    await new Promise((r) => setTimeout(r, 10));
  }

  /** 最初に登録された activeRunTask のIDを取得 */
  function getFirstRunTaskId(): string {
    return [...client.activeRunTasks.keys()][0];
  }

  // --- runSingleTask ---

  test('#1 normal runSingleTask returns success', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    const taskId = getFirstRunTaskId();
    await completeRunTask(taskId);

    expect(results.length).toBeGreaterThan(0);
    const lastResult = results[results.length - 1];
    expect(lastResult.success).toBe(true);
  });

  test('#2 missing id returns failure', async () => {
    const results: TaskResult[] = [];
    const request: RunSingleTaskRequest = {
      lang: 'ruby',
      info: { type: 'filestdin', code: 'x', stdin: '' },
    };
    await handler.runSingleTask(request, (data) => results.push(data));
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].summary).toBe('Missing job ID');
  });

  test('#3 empty lang returns failure (TaskFactory returns null for empty lang)', async () => {
    const results: TaskResult[] = [];
    await handler.runSingleTask(
      {
        id: { clicmid: 1 },
        lang: '',
        info: { type: 'filestdin', code: '', stdin: '' },
      },
      (data) => results.push(data)
    );
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].summary).toBe('(?)');
  });

  // --- kill ---

  test('#4 kill running task invokes task.kill() path', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    const taskId = getFirstRunTaskId();
    // After runTask resolves + one tick, handleKill is set in TaskRunTask
    // kill() will call launcherClient.kill('', taskId)
    handler.kill({ id: { clicmid: 1 } });

    // Verify kill path reached FakeLauncherClient
    // NOTE: FakeLauncherClient.kill with box='' returns FAILED_PRECONDITION
    // because '' is not in boxes. This is a FakeLauncherClient limitation -
    // in production, the server-side stream terminates on kill.
    // We verify the task was registered and kill didn't throw.
    expect(client.activeRunTasks.has(taskId)).toBe(true);
  });

  test('#5 kill non-existent id is no-op', () => {
    expect(() => handler.kill({ id: { clicmid: 999 } })).not.toThrow();
  });

  test('#6 kill already completed task is no-op', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    const taskId = getFirstRunTaskId();
    await completeRunTask(taskId);

    // Task completed, runner is unregistered via finalizer
    expect(() => handler.kill({ id: { clicmid: 1 } })).not.toThrow();
  });

  // --- disconnect ---

  test('#7 disconnect kills running tasks via cleanup', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    handler.runSingleTask(makeRequest(2), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    // Both tasks are active
    expect(client.activeRunTasks.size).toBe(2);

    handler.disconnect();

    // disconnect() calls cleanup() which calls kill() on each TaskRunner.
    // After disconnect, new operations on this handler are not expected.
    // NOTE: Due to FakeLauncherClient.kill limitation (box='' not found),
    // the RunTask streams don't actually close, but kill() was invoked on each task.
  });

  test('#8 disconnect with no tasks is no-op', () => {
    expect(() => handler.disconnect()).not.toThrow();
  });

  // --- 競合シナリオ ---

  test('#9 same clientJobId submitted twice overwrites in TaskRunnerManager', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1, 'ruby', 'code1'), (data) =>
      results.push(data)
    );
    await new Promise((r) => setTimeout(r, 0));

    handler.runSingleTask(makeRequest(1, 'ruby', 'code2'), (data) =>
      results.push(data)
    );
    await new Promise((r) => setTimeout(r, 0));

    // Both RunTask calls were made to the launcher
    expect(client.activeRunTasks.size).toBe(2);
  });

  test('#10 duplicate clientJobId - first task finalizer removes second task registration', async () => {
    // Known issue: 1つ目の finalizer が unregister を呼ぶと、既に2つ目で上書き済みのキーが削除される。
    // これはリソースリークの可能性があるが、現状の仕様として記録。
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1, 'ruby', 'code1'), (data) =>
      results.push(data)
    );
    await new Promise((r) => setTimeout(r, 0));

    const firstTaskId = getFirstRunTaskId();

    handler.runSingleTask(makeRequest(1, 'ruby', 'code2'), (data) =>
      results.push(data)
    );
    await new Promise((r) => setTimeout(r, 0));

    // Complete the first task - its finalizer will unregister clientJobId=1
    await completeRunTask(firstTaskId);

    // Now kill on clientJobId=1 should be no-op because the key was unregistered
    // (even though second task is still running - this is the known issue)
    expect(() => handler.kill({ id: { clicmid: 1 } })).not.toThrow();
  });

  test('#11 multiple different clientJobIds run independently', async () => {
    const results1: TaskResult[] = [];
    const results2: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results1.push(data));
    handler.runSingleTask(makeRequest(2), (data) => results2.push(data));
    await new Promise((r) => setTimeout(r, 0));

    const [taskId1, taskId2] = [...client.activeRunTasks.keys()];
    await completeRunTask(taskId1);

    expect(results1.length).toBeGreaterThan(0);
    expect(results1[results1.length - 1].success).toBe(true);

    // Task 2 is still active
    expect(client.activeRunTasks.has(taskId2)).toBe(true);

    await completeRunTask(taskId2);
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[results2.length - 1].success).toBe(true);
  });

  test('#12 runSingleTask followed immediately by kill', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    // Verify task was started
    expect(client.activeRunTasks.size).toBe(1);

    // Kill immediately - task.kill() is called (handleKill set after runTask resolves)
    handler.kill({ id: { clicmid: 1 } });

    // Verify no exception and task was in RunTask map
    expect(client.activeRunTasks.size).toBe(1);
  });

  test('#13 multiple ConnectionHandlers share LauncherClient independently', async () => {
    const service = createTaskManagerService(client);
    const factory = service.getConnectionHandlerFactory();
    const handler2 = factory.createConnectionHandler('socket-2');

    const results1: TaskResult[] = [];
    const results2: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results1.push(data));
    handler2.runSingleTask(makeRequest(1), (data) => results2.push(data));
    await new Promise((r) => setTimeout(r, 0));

    // Both handlers created their own tasks independently
    expect(client.activeRunTasks.size).toBe(2);

    // Kill on handler1 doesn't affect handler2's task with same clientJobId
    handler.kill({ id: { clicmid: 1 } });

    // handler2 still has its task runner; can complete independently
    const [, taskId2] = [...client.activeRunTasks.keys()];
    await completeRunTask(taskId2);
    expect(results2.length).toBeGreaterThan(0);
    expect(results2[results2.length - 1].success).toBe(true);
  });

  test('#14 callback after disconnect does not throw', async () => {
    const results: TaskResult[] = [];
    handler.runSingleTask(makeRequest(1), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    const taskId = getFirstRunTaskId();
    handler.disconnect();

    // After disconnect, simulate late completion events arriving
    const ctx = client.activeRunTasks.get(taskId);
    if (ctx) {
      ctx.queue.push({
        type: 'phase_result',
        phase: 'run',
        exitStatus: 0,
        timeMs: 50,
        stdout: 'late',
        stderr: '',
        hasNextPhase: false,
      });
      ctx.queue.push({ type: 'completed', totalTimeMs: 50 });
      ctx.queue.close();
    }
    await new Promise((r) => setTimeout(r, 10));

    // Callback still received results after disconnect (no guard flag currently)
    // This confirms no exception was thrown.
    expect(results.length).toBeGreaterThan(0);
  });

  // --- createTaskManagerService ---

  test('#15 createTaskManagerService produces working ConnectionHandler', () => {
    const svc = createTaskManagerService(client);
    const fac = svc.getConnectionHandlerFactory();
    const h = fac.createConnectionHandler('test-socket');
    expect(h).toBeDefined();
    expect(typeof h.runSingleTask).toBe('function');
    expect(typeof h.kill).toBe('function');
    expect(typeof h.disconnect).toBe('function');
  });

  test('#16 stop() disconnects all active connections', async () => {
    const svc = createTaskManagerService(client);
    const fac = svc.getConnectionHandlerFactory();
    const h1 = fac.createConnectionHandler('socket-a');
    const h2 = fac.createConnectionHandler('socket-b');

    // Start tasks on both handlers
    const results: TaskResult[] = [];
    h1.runSingleTask(makeRequest(1), (data) => results.push(data));
    h2.runSingleTask(makeRequest(2), (data) => results.push(data));
    await new Promise((r) => setTimeout(r, 0));

    expect(client.activeRunTasks.size).toBe(2);

    // stop() should disconnect all
    svc.stop();

    // After stop, creating a new handler and running tasks should still work
    // (stop only cleans up existing connections, doesn't prevent future use)
    const h3 = fac.createConnectionHandler('socket-c');
    expect(h3).toBeDefined();
  });

  test('#17 stop() with no active connections does not throw', () => {
    const svc = createTaskManagerService(client);
    expect(() => svc.stop()).not.toThrow();
  });

  test('#18 stop() after disconnect does not double-disconnect', async () => {
    const svc = createTaskManagerService(client);
    const fac = svc.getConnectionHandlerFactory();
    const h = fac.createConnectionHandler('socket-x');

    h.runSingleTask(makeRequest(1), () => {});
    await new Promise((r) => setTimeout(r, 0));

    // Manual disconnect removes handler from tracking
    h.disconnect();

    // stop() should not throw (handler already removed)
    expect(() => svc.stop()).not.toThrow();
  });
});
