import { FakeLauncherClient } from '../../../app/launcher/fake-launcher-client';
import { TaskInteractive } from '../../../app/task/task-interactive';
import {
  Result,
  InteractiveOutputData,
} from '../../../interfaces/result-types';

describe('TaskInteractive', () => {
  let client: FakeLauncherClient;
  let results: Result[];
  let outputs: { stream: 'stdout' | 'stderr'; data: string }[];
  let finalized: boolean;

  beforeEach(() => {
    client = new FakeLauncherClient();
    results = [];
    outputs = [];
    finalized = false;
  });

  function createTask(lang = 'ruby', code = 'puts "hi"'): TaskInteractive {
    return new TaskInteractive(
      client,
      (data: Result) => {
        results.push(data);
      },
      (output) => {
        outputs.push(output);
      },
      () => {
        finalized = true;
      },
      lang,
      code,
      60000
    );
  }

  test('normal flow: stdout then completed', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];
    expect(ctx).toBeDefined();
    expect(ctx.params.lang).toBe('ruby');

    ctx.queue.push({ type: 'output', stream: 'stdout', data: 'Enter: ' });
    ctx.queue.push({ type: 'output', stream: 'stdout', data: 'Hello!\n' });
    ctx.queue.push({ type: 'completed', exitStatus: 0, elapsedTimeMs: 150 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    expect(results[0]).toMatchObject({ success: true, summary: 'started' });
    expect(results[1]).toMatchObject({ success: true, summary: 'completed' });
    expect(outputs).toEqual([
      { stream: 'stdout', data: 'Enter: ' },
      { stream: 'stdout', data: 'Hello!\n' },
    ]);
  });

  test('writeStdin forwards to handle', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    task.writeStdin('hello\n');
    task.writeStdin('world\n');
    expect(ctx.stdinChunks).toEqual(['hello\n', 'world\n']);

    ctx.queue.push({ type: 'completed', exitStatus: 0, elapsedTimeMs: 100 });
    ctx.queue.close();
    await execPromise;
  });

  test('closeStdin forwards to handle', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    task.closeStdin();
    expect(ctx.stdinClosed).toBe(true);

    ctx.queue.push({ type: 'completed', exitStatus: 0, elapsedTimeMs: 100 });
    ctx.queue.close();
    await execPromise;
  });

  test('kill calls launcher.kill and cancels stream', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    const killSpy = jest.spyOn(client, 'kill');
    task.kill();
    expect(killSpy).toHaveBeenCalledWith('', ctx.taskId);
    expect(ctx.cancelled).toBe(true);

    await execPromise;
    expect(finalized).toBe(true);
  });

  test('kill before started sets pendingKill', async () => {
    const task = createTask();
    // Kill before startAsync
    task.kill();

    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];
    // Should have been cancelled immediately after start
    expect(ctx.cancelled).toBe(true);

    await execPromise;
    expect(finalized).toBe(true);
  });

  test('failed event emits error result', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    ctx.queue.push({
      type: 'failed',
      phase: 'setup',
      errorCode: 'INVALID_LANG',
      reason: 'unsupported language',
    });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    expect(results[1]).toMatchObject({
      success: false,
      summary: 'setup: INVALID_LANG',
    });
  });

  test('killed event emits killed result', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    ctx.queue.push({
      type: 'killed',
      reason: 'TIMEOUT',
      elapsedTimeMs: 60000,
    });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    expect(results[1]).toMatchObject({
      success: false,
      summary: 'killed: TIMEOUT',
    });
  });

  test('compile_result event is emitted', async () => {
    const task = createTask('cpp', 'int main(){}');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    ctx.queue.push({
      type: 'compile_result',
      exitStatus: 0,
      timeMs: 500,
      stdout: '',
      stderr: '',
    });
    ctx.queue.push({ type: 'output', stream: 'stdout', data: '> ' });
    ctx.queue.push({ type: 'completed', exitStatus: 0, elapsedTimeMs: 700 });
    ctx.queue.close();

    await execPromise;

    // started, compile_result, completed
    expect(results).toHaveLength(3);
    expect(results[1]).toMatchObject({ summary: 'result(compile)' });
    expect(outputs).toEqual([{ stream: 'stdout', data: '> ' }]);
  });

  test('RPC failure returns error result', async () => {
    client.execInteractive = () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNAVAILABLE', message: 'connection refused' },
      });

    const task = createTask();
    await task.startAsync({ type: 'filestdin', code: '', stdin: '' });

    expect(finalized).toBe(true);
    expect(results[0]).toMatchObject({
      success: false,
      summary: 'execInteractive failed: connection refused',
    });
  });

  test('stderr output is forwarded correctly', async () => {
    const task = createTask();
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeInteractives.values()][0];

    ctx.queue.push({ type: 'output', stream: 'stderr', data: 'warning\n' });
    ctx.queue.push({ type: 'completed', exitStatus: 0, elapsedTimeMs: 50 });
    ctx.queue.close();

    await execPromise;

    expect(outputs).toEqual([{ stream: 'stderr', data: 'warning\n' }]);
  });
});
