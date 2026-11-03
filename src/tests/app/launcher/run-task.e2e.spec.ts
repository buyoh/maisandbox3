/**
 * Feature-Real テスト: RunTask RPC フロー全体の検証。
 */
import { LauncherGrpcClient } from '../../../app/launcher/launcher-grpc-client';
import { RunTaskEvent } from '../../../app/launcher/launcher-client-interface';
import {
  GoLauncherFixture,
  hasLauncherBinary,
  hasCommand,
} from './helpers/go-launcher-fixture';

const canRun = hasLauncherBinary();

const hasRuby = () => hasCommand('ruby');
const hasGpp = () => hasCommand('g++');

(canRun ? describe : describe.skip)('RunTask E2E', () => {
  let fixture: GoLauncherFixture;
  let client: LauncherGrpcClient;

  beforeAll(async () => {
    fixture = new GoLauncherFixture();
    client = await fixture.start();
  });

  afterAll(async () => {
    // テスト失敗時の診断用: Go launcher の stderr を出力
    const stderr = fixture.stderr;
    if (stderr) {
      console.error('[RunTask E2E] Go launcher stderr:\n', stderr);
    }
    await fixture.stop();
  });

  /** イベントストリームを全て消費して配列で返す（タイムアウト付き） */
  async function collectEvents(
    events: AsyncIterable<RunTaskEvent>,
    timeoutMs = 20000
  ): Promise<RunTaskEvent[]> {
    const result: RunTaskEvent[] = [];
    const deadline = Date.now() + timeoutMs;
    for await (const ev of events) {
      result.push(ev);
      if (Date.now() > deadline) {
        throw new Error(
          `collectEvents timed out after ${timeoutMs}ms. Collected ${result.length} events: ` +
            JSON.stringify(result.map((e) => e.type))
        );
      }
    }
    return result;
  }

  (hasRuby() ? describe : describe.skip)('RunTask: Ruby', () => {
    test('hello world', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code.rb', data: 'puts "hello from ruby"' }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 10000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);

      // PhaseResult(run) と Completed が含まれること
      const phaseResult = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'run'
      );
      expect(phaseResult).toBeDefined();
      if (phaseResult && phaseResult.type === 'phase_result') {
        expect(phaseResult.exitStatus).toBe(0);
        expect(phaseResult.stdout).toContain('hello from ruby');
      }

      const completed = events.find((e) => e.type === 'completed');
      expect(completed).toBeDefined();
    });

    test('stdin 入力', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [
          { path: 'code.rb', data: 'puts gets.chomp.reverse' },
          { path: 'stdin.txt', data: 'abcde\n' },
        ],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 10000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);
      const phaseResult = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'run'
      );
      expect(phaseResult).toBeDefined();
      if (phaseResult && phaseResult.type === 'phase_result') {
        expect(phaseResult.stdout).toContain('edcba');
      }
    });

    test('実行時エラー', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code.rb', data: 'raise "test error"' }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 10000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);
      const phaseResult = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'run'
      );
      expect(phaseResult).toBeDefined();
      if (phaseResult && phaseResult.type === 'phase_result') {
        expect(phaseResult.exitStatus).not.toBe(0);
        expect(phaseResult.stderr).toContain('test error');
      }
    });

    test('フェーズタイムアウト', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code.rb', data: 'sleep 30' }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 1000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);
      const failed = events.find((e) => e.type === 'failed');
      expect(failed).toBeDefined();
      if (failed && failed.type === 'failed') {
        expect(failed.errorCode).toBe('PHASE_TIMEOUT');
      }
    });

    // NOTE: Kill for RunTask は現在の Go launcher では未実装。
    // executor の内部 taskID と RunTask の taskId(=boxID) が異なるため、
    // Kill RPC がプロセスに到達しない。将来のハンドラ修正で対応予定。
    test.skip('Kill during execution', async () => {
      const result = await client.runTask({
        lang: 'ruby',
        files: [{ path: 'code.rb', data: 'sleep 30' }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 0,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const handle = result.value;

      // Started イベント受信後に kill 発行（taskId で box を指定）
      await client.kill('', handle.taskId);

      const events = await collectEvents(handle.events);
      // Kill 後はストリームが終了する（failed または phase_result でプロセス終了を示す）
      expect(events.length).toBeGreaterThan(0);
      const lastEvent = events[events.length - 1];
      // failed イベントまたは completed で終了
      expect(['failed', 'phase_result', 'completed']).toContain(lastEvent.type);
    });
  });

  (hasGpp() ? describe : describe.skip)('RunTask: C++', () => {
    test('ビルド+実行', async () => {
      const cppCode = `
#include <iostream>
int main() {
  std::cout << "hello from cpp" << std::endl;
  return 0;
}
`;
      const result = await client.runTask({
        lang: 'cpp',
        files: [{ path: 'code.cpp', data: cppCode }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 10000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);

      // build phase
      const buildPhase = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'build'
      );
      expect(buildPhase).toBeDefined();
      if (buildPhase && buildPhase.type === 'phase_result') {
        expect(buildPhase.exitStatus).toBe(0);
      }

      // run phase
      const runPhase = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'run'
      );
      expect(runPhase).toBeDefined();
      if (runPhase && runPhase.type === 'phase_result') {
        expect(runPhase.exitStatus).toBe(0);
        expect(runPhase.stdout).toContain('hello from cpp');
      }

      const completed = events.find((e) => e.type === 'completed');
      expect(completed).toBeDefined();
    });

    test('コンパイルエラー', async () => {
      const result = await client.runTask({
        lang: 'cpp',
        files: [{ path: 'code.cpp', data: 'int main() { undeclared_var; }' }],
        totalTimeoutMs: 0,
        phaseTimeoutMs: 10000,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const events = await collectEvents(result.value.events);

      const buildPhase = events.find(
        (e) => e.type === 'phase_result' && e.phase === 'build'
      );
      expect(buildPhase).toBeDefined();
      if (buildPhase && buildPhase.type === 'phase_result') {
        expect(buildPhase.exitStatus).not.toBe(0);
        expect(buildPhase.stderr).toBeTruthy();
        expect(buildPhase.hasNextPhase).toBe(false);
      }
    });
  });

  test('未対応言語', async () => {
    const result = await client.runTask({
      lang: 'nonexistent_lang_xyz',
      files: [{ path: 'main.py', data: 'print("hi")' }],
      totalTimeoutMs: 0,
      phaseTimeoutMs: 5000,
    });
    // INVALID_ARGUMENT エラー、またはストリーム内の failed イベント
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ARGUMENT');
    } else {
      const events = await collectEvents(result.value.events);
      const failed = events.find((e) => e.type === 'failed');
      expect(failed).toBeDefined();
      if (failed && failed.type === 'failed') {
        expect(failed.errorCode).toBe('INVALID_LANG');
      }
    }
  });

  (hasRuby() ? test : test.skip)('全体タイムアウト', async () => {
    const result = await client.runTask({
      lang: 'ruby',
      files: [{ path: 'code.rb', data: 'sleep 30' }],
      totalTimeoutMs: 1000,
      phaseTimeoutMs: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const events = await collectEvents(result.value.events);
    const failed = events.find((e) => e.type === 'failed');
    expect(failed).toBeDefined();
    if (failed && failed.type === 'failed') {
      expect(failed.errorCode).toBe('TIMEOUT');
    }
  });
});
