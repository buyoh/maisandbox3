import { FakeLauncherClient } from '../../../app/launcher/fake-launcher-client';
import { TaskRunTaskMulti } from '../../../app/task/task-run-task-multi';
import { Result } from '../../../interfaces/result-types';

describe('TaskRunTaskMulti', () => {
  let client: FakeLauncherClient;
  let results: Result[];
  let finalized: boolean;

  beforeEach(() => {
    client = new FakeLauncherClient();
    results = [];
    finalized = false;
  });

  function createTask(
    lang = 'ruby',
    code = 'puts "hi"',
    stdinList = ['a', 'b']
  ): TaskRunTaskMulti {
    return new TaskRunTaskMulti(
      client,
      (data: Result) => {
        results.push(data);
      },
      () => {
        finalized = true;
      },
      lang,
      code,
      stdinList,
      { totalTimeoutMs: 30000, phaseTimeoutMs: 15000 }
    );
  }

  test('ruby: multiple run results', async () => {
    const task = createTask('ruby', 'puts "hi"', ['input1', 'input2']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));

    const ctx = [...client.activeRunTaskMultis.values()][0];
    expect(ctx).toBeDefined();
    expect(ctx.params.lang).toBe('ruby');
    expect(ctx.params.stdinList).toEqual([
      { stdinIndex: 0, data: 'input1' },
      { stdinIndex: 1, data: 'input2' },
    ]);

    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 0,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'out1\n',
      stderr: '',
      hasNextRun: true,
    });
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 1,
      exitStatus: 0,
      timeMs: 15,
      stdout: 'out2\n',
      stderr: '',
      hasNextRun: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 25 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    // results: started, run_result(0), run_result(1), completed
    expect(results).toHaveLength(4);
    expect(results[0]).toMatchObject({
      success: true,
      summary: 'started',
      continue: true,
    });
    expect(results[1]).toMatchObject({ success: true, summary: 'run_result' });
    expect(results[1].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'param',
          key: 'stdin_index',
          value: 0,
        }),
        expect.objectContaining({ type: 'out', text: 'out1\n' }),
      ])
    );
    expect(results[2]).toMatchObject({ success: true, summary: 'run_result' });
    expect(results[2].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'param',
          key: 'stdin_index',
          value: 1,
        }),
        expect.objectContaining({ type: 'out', text: 'out2\n' }),
      ])
    );
    expect(results[3]).toMatchObject({ success: true, summary: 'completed' });
  });

  test('cpp: build phase then run results', async () => {
    const task = createTask('cpp', 'int main(){}', ['1', '2', '3']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    // Build phase
    ctx.queue.push({
      type: 'build_result',
      phase: 'build',
      exitStatus: 0,
      timeMs: 100,
      stdout: '',
      stderr: '',
      hasNextBuildPhase: false,
    });
    // Run results
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 0,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'r1',
      stderr: '',
      hasNextRun: true,
    });
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 1,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'r2',
      stderr: '',
      hasNextRun: true,
    });
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 2,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'r3',
      stderr: '',
      hasNextRun: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 130 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    // results: started, build_result, run(0), run(1), run(2), completed
    expect(results).toHaveLength(6);
    expect(results[0]).toMatchObject({ success: true, summary: 'started' });
    expect(results[1]).toMatchObject({
      success: true,
      summary: 'result(build)',
    });
    expect(results[1].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'status', status: 'success' }),
      ])
    );
    expect(results[2]).toMatchObject({ summary: 'run_result' });
    expect(results[3]).toMatchObject({ summary: 'run_result' });
    expect(results[4]).toMatchObject({ summary: 'run_result' });
    expect(results[5]).toMatchObject({ success: true, summary: 'completed' });
  });

  test('build failure emits error status and stops', async () => {
    const task = createTask('cpp', 'bad code', ['in']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    ctx.queue.push({
      type: 'build_result',
      phase: 'build',
      exitStatus: 1,
      timeMs: 50,
      stdout: '',
      stderr: 'error: ...',
      hasNextBuildPhase: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 50 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    // results: started, build_result (error), completed
    expect(results).toHaveLength(3);
    expect(results[1].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'status', status: 'error' }),
        expect.objectContaining({ type: 'log', text: 'error: ...' }),
      ])
    );
  });

  test('partial run failure still reports all results', async () => {
    const task = createTask('ruby', 'code', ['ok', 'fail', 'ok2']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 0,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'out1',
      stderr: '',
      hasNextRun: true,
    });
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 1,
      exitStatus: 1,
      timeMs: 10,
      stdout: '',
      stderr: 'runtime error',
      hasNextRun: true,
    });
    ctx.queue.push({
      type: 'run_result',
      stdinIndex: 2,
      exitStatus: 0,
      timeMs: 10,
      stdout: 'out3',
      stderr: '',
      hasNextRun: false,
    });
    ctx.queue.push({ type: 'completed', totalTimeMs: 30 });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    // started + 3 run_results + completed
    expect(results).toHaveLength(5);
    // failed run shows warning status
    expect(results[2].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'status', status: 'warning' }),
        expect.objectContaining({ type: 'log', text: 'runtime error' }),
      ])
    );
    // other runs succeed
    expect(results[1].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'status', status: 'success' }),
      ])
    );
    expect(results[3].details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'status', status: 'success' }),
      ])
    );
  });

  test('failed event emits error result', async () => {
    const task = createTask('ruby', 'code', ['in']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    ctx.queue.push({
      type: 'failed',
      phase: 'run',
      errorCode: 'PHASE_TIMEOUT',
      reason: 'execution timed out',
    });
    ctx.queue.close();

    await execPromise;

    expect(finalized).toBe(true);
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({
      success: false,
      summary: 'run: PHASE_TIMEOUT',
    });
  });

  test('runTaskMulti RPC failure returns error result', async () => {
    client.runTaskMulti = () =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'UNAVAILABLE', message: 'connection refused' },
      });

    const task = createTask('ruby', 'code', ['in']);
    await task.startAsync({ type: 'filestdin', code: '', stdin: '' });

    expect(finalized).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      success: false,
      summary: 'runTaskMulti failed: connection refused',
    });
  });

  test('kill calls launcher.kill with empty box and taskId', async () => {
    const task = createTask('ruby', 'code', ['in']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    const killSpy = jest.spyOn(client, 'kill');
    task.kill();
    expect(killSpy).toHaveBeenCalledWith('', ctx.taskId);

    ctx.queue.close();
    await execPromise;

    expect(finalized).toBe(true);
  });

  test('params include code in files', async () => {
    const task = createTask('ruby', 'my_code', ['in1']);
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    expect(ctx.params.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'code', data: 'my_code' }),
      ])
    );

    ctx.queue.push({ type: 'completed', totalTimeMs: 0 });
    ctx.queue.close();
    await execPromise;
  });

  test('options are passed to launcher', async () => {
    const task = new TaskRunTaskMulti(
      client,
      (data: Result) => {
        results.push(data);
      },
      () => {
        finalized = true;
      },
      'cpp',
      'code',
      ['in'],
      { totalTimeoutMs: 30000, phaseTimeoutMs: 15000 },
      { std: 'c++17' }
    );
    const execPromise = task.startAsync({
      type: 'filestdin',
      code: '',
      stdin: '',
    });

    await new Promise((r) => setTimeout(r, 10));
    const ctx = [...client.activeRunTaskMultis.values()][0];

    expect(ctx.params.options).toEqual({ std: 'c++17' });

    ctx.queue.push({ type: 'completed', totalTimeMs: 0 });
    ctx.queue.close();
    await execPromise;
  });
});
