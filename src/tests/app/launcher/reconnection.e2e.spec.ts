/**
 * Feature-Real テスト: gRPC channel 切断→復帰の再接続テスト。
 *
 * Go launcher プロセスを一旦停止し再起動した後、
 * 同一の LauncherGrpcClient が自動再接続し RPC が成功することを検証する。
 *
 * 不安定になりやすいため retry ラッパーを使用。
 */
import { LauncherGrpcClient } from '../../../app/launcher/launcher-grpc-client';
import { RunTaskEvent } from '../../../app/launcher/launcher-client-interface';
import {
  GoLauncherFixture,
  hasLauncherBinary,
} from './helpers/go-launcher-fixture';

const canRun = hasLauncherBinary();

/** 指定回数まで retry する（各試行の間に waitMs だけ待機） */
async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  waitMs: number
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError;
}

(canRun ? describe : describe.skip)('LauncherGrpcClient 再接続', () => {
  let fixture: GoLauncherFixture;
  let client: LauncherGrpcClient;

  beforeAll(async () => {
    fixture = new GoLauncherFixture();
    client = await fixture.start();
  });

  afterAll(async () => {
    const stderr = fixture.stderr;
    if (stderr) {
      console.error('[Reconnection E2E] Go launcher stderr:\n', stderr);
    }
    await fixture.stop();
  });

  test('プロセス再起動後に RunTask が成功する', async () => {
    // 1. 初回 RunTask が成功することを確認
    const firstResult = await client.runTask({
      lang: 'ruby',
      files: [
        { path: 'code.rb', data: 'puts "before"' },
        { path: 'stdin.txt', data: '' },
      ],
      totalTimeoutMs: 10000,
      phaseTimeoutMs: 5000,
    });
    expect(firstResult.ok).toBe(true);
    if (firstResult.ok) {
      const events: RunTaskEvent[] = [];
      for await (const ev of firstResult.value.events) {
        events.push(ev);
      }
      expect(events.some((e) => e.type === 'completed')).toBe(true);
    }

    // 2. Go launcher プロセスを再起動（同一 socket パス）
    await fixture.restartProcess();

    // 3. 再接続後に RunTask が成功するまで retry（最大 10 回、200ms 間隔）
    const reconnectedResult = await retry(
      async () => {
        const r = await client.runTask({
          lang: 'ruby',
          files: [
            { path: 'code.rb', data: 'puts "reconnected"' },
            { path: 'stdin.txt', data: '' },
          ],
          totalTimeoutMs: 10000,
          phaseTimeoutMs: 5000,
        });
        if (!r.ok) {
          throw new Error(
            `RunTask failed after reconnect: ${r.error.code} ${r.error.message}`
          );
        }
        return r;
      },
      10,
      200
    );

    expect(reconnectedResult.ok).toBe(true);
    if (reconnectedResult.ok) {
      const events: RunTaskEvent[] = [];
      for await (const ev of reconnectedResult.value.events) {
        events.push(ev);
      }
      const phaseResult = events.find((e) => e.type === 'phase_result');
      expect(phaseResult).toBeDefined();
      if (phaseResult && phaseResult.type === 'phase_result') {
        expect(phaseResult.stdout).toContain('reconnected');
      }
    }
  });
});
