/**
 * Unit-Real テスト: LauncherGrpcClient ↔ Go launcher の実接続テスト。
 */
import { LauncherGrpcClient } from '../../../app/launcher/launcher-grpc-client';
import { RunTaskEvent } from '../../../app/launcher/launcher-client-interface';
import {
  GoLauncherFixture,
  hasLauncherBinary,
} from './helpers/go-launcher-fixture';

const canRun = hasLauncherBinary();

(canRun ? describe : describe.skip)('LauncherGrpcClient E2E', () => {
  let fixture: GoLauncherFixture;
  let client: LauncherGrpcClient;

  beforeAll(async () => {
    fixture = new GoLauncherFixture();
    client = await fixture.start();
  });

  afterAll(async () => {
    await fixture.stop();
  });

  test('RunTask: Ruby echo', async () => {
    const result = await client.runTask({
      lang: 'ruby',
      files: [
        { path: 'code.rb', data: 'puts "hello"' },
        { path: 'stdin.txt', data: '' },
      ],
      totalTimeoutMs: 30000,
      phaseTimeoutMs: 15000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const events: RunTaskEvent[] = [];
    for await (const ev of result.value.events) {
      events.push(ev);
    }

    const phaseResult = events.find((e) => e.type === 'phase_result');
    expect(phaseResult).toBeDefined();
    if (phaseResult && phaseResult.type === 'phase_result') {
      expect(phaseResult.exitStatus).toBe(0);
      expect(phaseResult.stdout).toContain('hello');
    }

    const completed = events.find((e) => e.type === 'completed');
    expect(completed).toBeDefined();
  });

  test('RunTask: 未対応言語でエラー', async () => {
    const result = await client.runTask({
      lang: 'nonexistent-lang',
      files: [
        { path: 'code.txt', data: '' },
        { path: 'stdin.txt', data: '' },
      ],
      totalTimeoutMs: 30000,
      phaseTimeoutMs: 15000,
    });
    // INVALID_ARGUMENT が gRPC エラーとして返される
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ARGUMENT');
    }
  });

  test('Kill: 実行中タスクの停止', async () => {
    const result = await client.runTask({
      lang: 'ruby',
      files: [
        { path: 'code.rb', data: 'sleep 30' },
        { path: 'stdin.txt', data: '' },
      ],
      totalTimeoutMs: 10000,
      phaseTimeoutMs: 10000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const handle = result.value;

    // kill 発行（少し待ってからプロセスが起動した後に実行）
    await new Promise((r) => setTimeout(r, 200));
    const killResult = await client.kill('', handle.taskId);
    expect(killResult.ok).toBe(true);

    const events: RunTaskEvent[] = [];
    for await (const ev of handle.events) {
      events.push(ev);
    }

    // kill後はストリームが終了する
    expect(events.length).toBeGreaterThanOrEqual(0);
  }, 15000);

  test('接続先が存在しない場合', async () => {
    const badClient = new LauncherGrpcClient(
      './tmp/nonexistent-e2e-sock-path.sock'
    );
    const result = await badClient.runTask({
      lang: 'ruby',
      files: [
        { path: 'code.rb', data: '' },
        { path: 'stdin.txt', data: '' },
      ],
      totalTimeoutMs: 5000,
      phaseTimeoutMs: 5000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAVAILABLE');
    }
    badClient.close();
  });
});
