import { FakeLauncherClient } from '../../../app/launcher/fake-launcher-client';
import { TaskRunTask } from '../../../app/task/task-run-task';
import { Result } from '../../../interfaces/result-types';

describe('TaskRunTask', () => {
  let client: FakeLauncherClient;
  let results: Result[];
  let finalized: boolean;

  beforeEach(() => {
    client = new FakeLauncherClient();
    results = [];
    finalized = false;
  });

  function createTask(lang = 'ruby'): TaskRunTask {
    return new TaskRunTask(
      client,
      (data: Result) => {
        results.push(data);
      },
      () => {
        finalized = true;
      },
      lang,
      { totalTimeoutMs: 30000, phaseTimeoutMs: 15000 }
    );
  }

  test('ruby: single phase success', async () => {
    const task = createTask('ruby');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'puts "hi"',
      stdin: '',
    });

    // wait for runTask to start
    await new Promise((r) => setTimeout(r, 10));

    const ctx = [...client.activeRunTasks.values()][0];
    expect(ctx).toBeDefined();
    expect(ctx.params.lang).toBe('ruby');
    expect(ctx.params.files).toEqual([
      { path: 'code', data: 'puts "hi"' },
      { path: 'stdin', data: '' },
    ]);

    ctx.queue.push({
      type: 'phase_result',
      phase: 'exec',
      exitStatus: 0,
      timeMs: 50,
      stdout: 'hi\n',
      stderr: '',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 50 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    // results: started, phase_result(exec), completed
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      success: true,
      summary: 'started',
      continue: true,
    });
    expect(results[1]).toMatchObject({
      success: true,
      summary: 'result(exec)',
    });
    expect(results[1].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'out', text: 'hi\n' }),
      ])
    );
    expect(results[2]).toMatchObject({ success: true, summary: 'completed' });
  });

  test('cpp: multi-phase with annotations', async () => {
    const task = createTask('cpp');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'int main(){}',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    // compile phase
    ctx.queue.push({
      type: 'phase_result',
      phase: 'compile',
      exitStatus: 1,
      timeMs: 20,
      stdout: '',
      stderr: 'code.cpp:3:5: error: expected ;\n',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 20 });
    ctx.queue.close();

    await execPromise;

    expect(results).toHaveLength(3);
    const compileResult = results[1];
    expect(compileResult.summary).toBe('result(compile)');
    // should have annotation
    const annotations = compileResult.details?.find(
      (d) => d.type === 'annotation'
    );
    expect(annotations).toBeDefined();
    if (annotations && annotations.type === 'annotation') {
      expect(annotations.annotations).toHaveLength(1);
      expect(annotations.annotations[0]).toMatchObject({
        row: 2,
        column: 4,
        type: 'error',
      });
    }
  });

  test('ruby: annotation parsing from stderr', async () => {
    const task = createTask('ruby');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'x',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    ctx.queue.push({
      type: 'phase_result',
      phase: 'exec',
      exitStatus: 1,
      timeMs: 10,
      stdout: '',
      stderr: 'code.rb:2: syntax error\n',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 10 });
    ctx.queue.close();

    await execPromise;

    const phaseResult = results[1];
    const annotations = phaseResult.details?.find(
      (d) => d.type === 'annotation'
    );
    expect(annotations).toBeDefined();
    if (annotations && annotations.type === 'annotation') {
      expect(annotations.annotations[0]).toMatchObject({
        row: 1,
        column: 0,
        type: 'error',
      });
    }
  });

  test('failed event emits error result', async () => {
    const task = createTask('ruby');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'x',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    ctx.queue.push({
      type: 'failed',
      phase: 'exec',
      errorCode: 'PHASE_TIMEOUT',
      reason: 'execution timed out',
    });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({
      success: false,
      summary: 'exec: PHASE_TIMEOUT',
    });
  });

  test('runTask RPC failure returns error result', async () => {
    // Override runTask to simulate failure
    client.runTask = () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNAVAILABLE', message: 'connection refused' },
      });

    const task = createTask('ruby');
    await task.startAsync({ type: 'filestdin', code: 'x', stdin: '' });

    expect(finalized).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      success: false,
      summary: 'runTask failed: connection refused',
    });
  });

  test('kill calls launcher.kill with empty box and taskId', async () => {
    const task = createTask('ruby');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'x',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    // kill should call client.kill('', taskId)
    const killSpy = jest.spyOn(client, 'kill');
    task.kill();
    expect(killSpy).toHaveBeenCalledWith('', ctx.taskId);

    // close the stream to finalize
    ctx.queue.close();
    await execPromise;

    expect(finalized).toBe(true);
  });

  test('clay: transpile phase annotation from <stdin>:N:M: stderr', async () => {
    const task = createTask('clay');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'bad code',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    ctx.queue.push({
      type: 'phase_result',
      phase: 'transpile',
      exitStatus: 1,
      timeMs: 10,
      stdout: '',
      stderr: '<stdin>:3:5: error: unexpected token\n',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 10 });
    ctx.queue.close();

    await execPromise;

    const phaseResult = results[1];
    const annotations = phaseResult.details?.find(
      (d) => d.type === 'annotation'
    );
    expect(annotations).toBeDefined();
    if (annotations && annotations.type === 'annotation') {
      expect(annotations.annotations[0]).toMatchObject({
        row: 2,
        column: 4,
        type: 'error',
      });
    }
  });

  test('clay: build phase stderr (out.cpp) does not produce annotation', async () => {
    const task = createTask('clay');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'code',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    ctx.queue.push({
      type: 'phase_result',
      phase: 'build',
      exitStatus: 1,
      timeMs: 10,
      stdout: '',
      stderr: 'out.cpp:5:3: error: some build error\n',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 10 });
    ctx.queue.close();

    await execPromise;

    const phaseResult = results[1];
    const annotations = phaseResult.details?.find(
      (d) => d.type === 'annotation'
    );
    expect(annotations).toBeUndefined();
  });

  test('clay: multi-phase transpile → build → run', async () => {
    const task = createTask('clay');
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: 'code',
      stdin: 'in',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTasks.values()][0];

    ctx.queue.push({
      type: 'phase_result',
      phase: 'transpile',
      exitStatus: 0,
      timeMs: 10,
      stdout: '',
      stderr: '',
      hasNextPhase: true,
    });
    ctx.queue.push({
      type: 'phase_result',
      phase: 'build',
      exitStatus: 0,
      timeMs: 15,
      stdout: '',
      stderr: '',
      hasNextPhase: true,
    });
    ctx.queue.push({
      type: 'phase_result',
      phase: 'run',
      exitStatus: 0,
      timeMs: 20,
      stdout: 'output',
      stderr: '',
      hasNextPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 45 });
    ctx.queue.close();

    await execPromise;

    expect(results).toHaveLength(5); // started, transpile, build, run, completed
    expect(results[1]).toMatchObject({
      summary: 'result(transpile)',
      continue: true,
    });
    expect(results[2]).toMatchObject({
      summary: 'result(build)',
      continue: true,
    });
    expect(results[3]).toMatchObject({
      summary: 'result(run)',
      continue: false,
    });
  });
});
