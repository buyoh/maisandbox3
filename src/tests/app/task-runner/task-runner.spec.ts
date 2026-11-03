import TaskRunner from '../../../app/task-runner/task-runner';
import { FakeLauncherClient } from '../../../app/launcher/fake-launcher-client';
import { TaskFactory } from '../../../app/task/task-factory';
import { TaskInterface } from '../../../app/task/task-interface';
import { ILauncherClient } from '../../../app/launcher/launcher-client-interface';
import { TaskResult } from '../../../interfaces/result-types';
import {
  QueryInitInfo,
  RunSingleTaskRequest,
} from '../../../interfaces/query-types';
import { Runnable } from '../../../app/task/task-util';

// --- Stubs ---

class StubTask implements TaskInterface {
  killed = false;
  startAsyncFn: ((data: QueryInitInfo) => Promise<void>) | null = null;

  kill(): void {
    this.killed = true;
  }

  async startAsync(data: QueryInitInfo): Promise<void> {
    if (this.startAsyncFn) await this.startAsyncFn(data);
  }
}

class StubTaskFactory implements TaskFactory {
  task: StubTask | null = null;
  capturedResultEmitter: ((data: TaskResult) => void) | null = null;
  capturedFinalize: Runnable | null = null;

  generate(
    _launcherClient: ILauncherClient,
    resultEmitter: (data: TaskResult) => void,
    finalize: Runnable,
    _query: RunSingleTaskRequest
  ): TaskInterface | null {
    this.capturedResultEmitter = resultEmitter;
    this.capturedFinalize = finalize;
    return this.task;
  }
}

// --- Tests ---

describe('TaskRunner', () => {
  let client: FakeLauncherClient;
  let factory: StubTaskFactory;
  let results: TaskResult[];
  let finalizeCalls: number;
  const clientJobId = { clicmid: 42 };

  beforeEach(() => {
    client = new FakeLauncherClient();
    factory = new StubTaskFactory();
    results = [];
    finalizeCalls = 0;
  });

  function createRunner(): TaskRunner {
    return new TaskRunner(
      clientJobId,
      client,
      (data: TaskResult) => {
        results.push(data);
      },
      () => {
        finalizeCalls++;
      }
    );
  }

  const request: RunSingleTaskRequest = {
    id: { clicmid: 42 },
    lang: 'ruby',
    info: { type: 'filestdin', code: 'puts 1', stdin: '' },
  };

  // --- 正常系 ---

  test('#1 start generates task and calls startAsync', async () => {
    const task = new StubTask();
    let startAsyncCalled = false;
    task.startAsyncFn = async () => {
      startAsyncCalled = true;
    };
    factory.task = task;

    const runner = createRunner();
    await runner.start(factory, request);
    expect(startAsyncCalled).toBe(true);
  });

  test('#2 resultEmitter receives data with id attached', async () => {
    const task = new StubTask();
    factory.task = task;

    const runner = createRunner();
    await runner.start(factory, request);

    // Emit a result through the captured emitter
    factory.capturedResultEmitter!({ success: true, summary: 'ok' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toEqual(clientJobId);
    expect(results[0].success).toBe(true);
  });

  test('#3 finalize is called when task invokes finalizer', async () => {
    const task = new StubTask();
    factory.task = task;

    const runner = createRunner();
    await runner.start(factory, request);

    factory.capturedFinalize!();
    expect(finalizeCalls).toBe(1);
  });

  // --- 未知言語 ---

  test('#4 null task emits failure result', async () => {
    factory.task = null;

    const runner = createRunner();
    await runner.start(factory, request);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].summary).toBe('(?)');
    expect(results[0].id).toEqual(clientJobId);
  });

  test('#5 null task calls finalizer', async () => {
    factory.task = null;

    const runner = createRunner();
    await runner.start(factory, request);

    expect(finalizeCalls).toBe(1);
  });

  // --- kill ---

  test('#6 kill after start calls task.kill()', async () => {
    const task = new StubTask();
    factory.task = task;

    const runner = createRunner();
    await runner.start(factory, request);
    runner.kill();
    expect(task.killed).toBe(true);
  });

  test('#7 kill before start does not throw (task is null)', () => {
    const runner = createRunner();
    expect(() => runner.kill()).not.toThrow();
  });

  test('#8 kill after task completes does not throw', async () => {
    const task = new StubTask();
    factory.task = task;

    const runner = createRunner();
    await runner.start(factory, request);
    // Simulate completion
    factory.capturedFinalize!();
    // Kill after completion
    expect(() => runner.kill()).not.toThrow();
    expect(task.killed).toBe(true);
  });

  // --- 競合シナリオ ---

  test('#9 kill during startAsync execution', async () => {
    const task = new StubTask();
    let resolveStart: (() => void) | null = null;
    task.startAsyncFn = () =>
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
    factory.task = task;

    const runner = createRunner();
    const startPromise = runner.start(factory, request);

    // startAsync is still pending; kill should still work
    runner.kill();
    expect(task.killed).toBe(true);

    // Resolve the pending startAsync
    resolveStart!();
    await startPromise;
  });

  test('#10 kill during startAsync → task completes normally', async () => {
    const task = new StubTask();
    let resolveStart: (() => void) | null = null;
    task.startAsyncFn = () =>
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      });
    factory.task = task;

    const runner = createRunner();
    const startPromise = runner.start(factory, request);

    runner.kill();
    resolveStart!();
    await startPromise;

    // After startAsync resolves, emitting results and finalizer still work
    factory.capturedResultEmitter!({ success: true, summary: 'done' });
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    factory.capturedFinalize!();
    expect(finalizeCalls).toBe(1);
  });

  // --- エラーハンドリング ---

  test('#11 startAsync rejection propagates from async start()', async () => {
    // 案B 修正後: start() が async になったため、startAsync の reject は
    // 呼び出し元で catch 可能になった。
    const task = new StubTask();
    task.startAsyncFn = async () => {
      throw new Error('unexpected failure');
    };
    factory.task = task;

    const runner = createRunner();
    await expect(runner.start(factory, request)).rejects.toThrow(
      'unexpected failure'
    );
  });

  test('#12 startAsync rejection calls finalizer before propagating', async () => {
    // startAsync が reject した場合でも finalizer が呼ばれることを確認
    const task = new StubTask();
    task.startAsyncFn = async () => {
      throw new Error('crash');
    };
    factory.task = task;

    const runner = createRunner();
    await expect(runner.start(factory, request)).rejects.toThrow('crash');
    expect(finalizeCalls).toBe(1);
  });
});
