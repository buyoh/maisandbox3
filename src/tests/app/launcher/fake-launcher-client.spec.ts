import {
  FakeLauncherClient,
  AsyncQueue,
} from '../../../app/launcher/fake-launcher-client';
import { RunTaskEvent } from '../../../app/launcher/launcher-client-interface';

describe('AsyncQueue', () => {
  test('push then consume', async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();

    const results: number[] = [];
    for await (const item of queue) {
      results.push(item);
    }
    expect(results).toEqual([1, 2]);
  });

  test('consume waits for push', async () => {
    const queue = new AsyncQueue<string>();
    const resultPromise = (async () => {
      const results: string[] = [];
      for await (const item of queue) {
        results.push(item);
      }
      return results;
    })();

    queue.push('a');
    queue.push('b');
    queue.close();

    const results = await resultPromise;
    expect(results).toEqual(['a', 'b']);
  });

  test('close terminates waiting consumers', async () => {
    const queue = new AsyncQueue<number>();
    const resultPromise = (async () => {
      const results: number[] = [];
      for await (const item of queue) {
        results.push(item);
      }
      return results;
    })();

    queue.close();
    const results = await resultPromise;
    expect(results).toEqual([]);
  });
});

describe('FakeLauncherClient', () => {
  let client: FakeLauncherClient;

  beforeEach(() => {
    client = new FakeLauncherClient();
  });

  describe('runTask', () => {
    test('returns handle with taskId and events', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code', data: 'puts 1' }],
        totalTimeoutMs: 30000,
        phaseTimeoutMs: 15000,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taskId).toMatch(/^task-\d+$/);
      }
    });

    test('receives events from queue', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code', data: 'puts 1' }],
        totalTimeoutMs: 30000,
        phaseTimeoutMs: 15000,
      });
      if (!result.ok) throw new Error('runTask failed');
      const handle = result.value;

      const context = client.activeRunTasks.get(handle.taskId)!;
      context.queue.push({
        type: 'phase_result',
        phase: 'run',
        exitStatus: 0,
        timeMs: 10.5,
        stdout: '1\n',
        stderr: '',
        hasNextPhase: false,
      });
      context.queue.push({
        type: 'completed',
        totalTimeMs: 10.5,
      });
      context.queue.close();

      const events: RunTaskEvent[] = [];
      for await (const event of handle.events) {
        events.push(event);
      }
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('phase_result');
      expect(events[1].type).toBe('completed');
    });
  });

  describe('kill', () => {
    test('closes runTask stream', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code', data: 'puts 1' }],
        totalTimeoutMs: 30000,
        phaseTimeoutMs: 15000,
      });
      if (!result.ok) throw new Error('runTask failed');
      const handle = result.value;

      await client.kill('', handle.taskId);

      const events: RunTaskEvent[] = [];
      for await (const event of handle.events) {
        events.push(event);
      }
      expect(events).toEqual([]);
    });

    test('returns ok for nonexistent task', async () => {
      const result = await client.kill('', 'nonexistent-task');
      expect(result.ok).toBe(true);
    });
  });
});
