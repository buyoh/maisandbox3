import {
  createStubInteractiveService,
  createStubMultiStdioService,
  createStubLangInfoService,
} from '../../../web/services/stub-services';
import { InteractiveOutputChunk } from '../../../interfaces/interactive-types';
import {
  BuildPhaseResult,
  MultiRunResult,
} from '../../../interfaces/multi-stdio-types';

describe('createStubInteractiveService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('500ms 後にダミー出力を配信する', () => {
    const service = createStubInteractiveService();
    const handle = service.start('ruby', 'puts gets');
    const chunks: InteractiveOutputChunk[] = [];
    handle.onOutput((c) => chunks.push(c));

    jest.advanceTimersByTime(499);
    expect(chunks).toHaveLength(0);

    jest.advanceTimersByTime(1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].stream).toBe('stdout');
    expect(chunks[0].data).toContain('Hello from stub');

    handle.dispose();
  });

  it('writeStdin はエコーバックする', () => {
    const service = createStubInteractiveService();
    const handle = service.start('ruby', '');
    const chunks: InteractiveOutputChunk[] = [];
    handle.onOutput((c) => chunks.push(c));

    handle.writeStdin('hello');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].data).toBe('hello\n');

    handle.dispose();
  });

  it('closeStdin 後 300ms で complete を発火する', () => {
    const service = createStubInteractiveService();
    const handle = service.start('ruby', '');
    let completed = false;
    handle.onComplete(() => {
      completed = true;
    });

    handle.closeStdin();
    jest.advanceTimersByTime(299);
    expect(completed).toBe(false);

    jest.advanceTimersByTime(1);
    expect(completed).toBe(true);

    handle.dispose();
  });

  it('kill は即座に complete を発火する', () => {
    const service = createStubInteractiveService();
    const handle = service.start('ruby', '');
    let exitStatus = -999;
    handle.onComplete((r) => {
      exitStatus = r.exitStatus;
    });

    handle.kill();
    expect(exitStatus).toBe(-1);
  });

  it('dispose 後はイベントが発火しない', () => {
    const service = createStubInteractiveService();
    const handle = service.start('ruby', '');
    const chunks: InteractiveOutputChunk[] = [];
    handle.onOutput((c) => chunks.push(c));

    handle.dispose();
    jest.advanceTimersByTime(1000);
    expect(chunks).toHaveLength(0);
  });
});

describe('createStubMultiStdioService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('200ms 後にビルド結果を配信する', () => {
    const service = createStubMultiStdioService();
    const handle = service.run('cpp', 'int main(){}', ['input1', 'input2']);
    let buildResult: BuildPhaseResult | null = null;
    handle.onBuildResult((r) => {
      buildResult = r;
    });

    jest.advanceTimersByTime(199);
    expect(buildResult).toBeNull();

    jest.advanceTimersByTime(1);
    expect(buildResult).not.toBeNull();
    expect(buildResult!.exitStatus).toBe(0);

    handle.dispose();
  });

  it('ビルド後に各 stdin の結果を 100ms 間隔で配信する', () => {
    const service = createStubMultiStdioService();
    const handle = service.run('cpp', '', ['a', 'b', 'c']);
    const results: MultiRunResult[] = [];
    handle.onBuildResult(() => {});
    handle.onRunResult((r) => results.push(r));

    jest.advanceTimersByTime(200); // build
    expect(results).toHaveLength(0);

    jest.advanceTimersByTime(100); // stdin #0
    expect(results).toHaveLength(1);
    expect(results[0].stdinIndex).toBe(0);

    jest.advanceTimersByTime(100); // stdin #1
    expect(results).toHaveLength(2);

    jest.advanceTimersByTime(100); // stdin #2
    expect(results).toHaveLength(3);

    handle.dispose();
  });

  it('全 stdin 完了後に complete を発火する', () => {
    const service = createStubMultiStdioService();
    const handle = service.run('cpp', '', ['a']);
    let completed = false;
    handle.onBuildResult(() => {});
    handle.onRunResult(() => {});
    handle.onComplete(() => {
      completed = true;
    });

    jest.advanceTimersByTime(200); // build
    jest.advanceTimersByTime(100); // run
    jest.advanceTimersByTime(50); // complete delay
    expect(completed).toBe(true);

    handle.dispose();
  });

  it('dispose 後はイベントが発火しない', () => {
    const service = createStubMultiStdioService();
    const handle = service.run('cpp', '', ['a']);
    let buildFired = false;
    handle.onBuildResult(() => {
      buildFired = true;
    });

    handle.dispose();
    jest.advanceTimersByTime(1000);
    expect(buildFired).toBe(false);
  });
});

describe('createStubLangInfoService', () => {
  it('fetchLangInfo はハードコードされた言語リストを返す', async () => {
    const service = createStubLangInfoService();
    const result = await service.fetchLangInfo();

    expect(result.length).toBeGreaterThan(0);
    expect(result.find((l) => l.lang === 'cpp')).toBeDefined();
    expect(result.find((l) => l.lang === 'ruby')).toBeDefined();
  });

  it('fetchLangVersion は 300ms 遅延後にバージョンを返す', async () => {
    jest.useFakeTimers();
    const service = createStubLangInfoService();
    const promise = service.fetchLangVersion('cpp');

    jest.advanceTimersByTime(300);
    const result = await promise;

    expect(result.version).toContain('gcc');
    expect(result.error).toBe('');
    jest.useRealTimers();
  });

  it('不明な言語には unknown を返す', async () => {
    jest.useFakeTimers();
    const service = createStubLangInfoService();
    const promise = service.fetchLangVersion('unknown_lang');

    jest.advanceTimersByTime(300);
    const result = await promise;

    expect(result.version).toContain('unknown');
    expect(result.error).toBe('');
    jest.useRealTimers();
  });
});
