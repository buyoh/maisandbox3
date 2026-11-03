import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { useInteractiveExecution } from '../../../web/hooks/use-interactive-execution';
import {
  InteractiveService,
  InteractiveHandle,
} from '../../../web/services/service-interfaces';
import {
  InteractiveOutputChunk,
  InteractiveCompleteResult,
  InteractiveBuildResult,
} from '../../../interfaces/interactive-types';
import {
  interactiveOutputAtom,
  interactiveRunningAtom,
  interactiveStdinClosedAtom,
} from '../../../web/stores/interactive-atoms';
import {
  taskResultsAtom,
  latestTaskIdByTypeAtom,
} from '../../../web/stores/status-atoms';

type BuildResultHandler = (result: InteractiveBuildResult) => void;
type CompleteHandler = (result: InteractiveCompleteResult) => void;

/** テスト用: 手動でコールバックを発火できる InteractiveService */
function createTestService(options?: {
  outputChunks?: InteractiveOutputChunk[];
  completeOnClose?: boolean;
}): InteractiveService & {
  lastHandle: InteractiveHandle | null;
  fireBuildResult: (result: InteractiveBuildResult) => void;
  fireComplete: (result: InteractiveCompleteResult) => void;
} {
  let buildResultHandler: BuildResultHandler | null = null;
  let completeHandler: CompleteHandler | null = null;

  const svc: ReturnType<typeof createTestService> = {
    lastHandle: null,
    fireBuildResult(result: InteractiveBuildResult) {
      buildResultHandler?.(result);
    },
    fireComplete(result: InteractiveCompleteResult) {
      completeHandler?.(result);
    },
    start(_lang: string, _code: string): InteractiveHandle {
      let outputHandler: ((data: InteractiveOutputChunk) => void) | null = null;
      buildResultHandler = null;
      completeHandler = null;
      let disposed = false;

      const handle: InteractiveHandle = {
        onOutput(handler) {
          outputHandler = handler;
        },
        onBuildResult(handler) {
          buildResultHandler = handler;
        },
        onComplete(handler) {
          completeHandler = handler;
        },
        writeStdin(data: string) {
          if (disposed) return;
          outputHandler?.({ stream: 'stdout', data: data + '\n' });
        },
        closeStdin() {
          if (disposed) return;
          if (options?.completeOnClose) {
            completeHandler?.({ exitStatus: 0, timeMs: 100 });
          }
        },
        kill() {
          if (disposed) return;
          completeHandler?.({ exitStatus: -1, timeMs: 0 });
        },
        dispose() {
          disposed = true;
          buildResultHandler = null;
          completeHandler = null;
        },
      };

      // 即座にダミー出力を配信
      if (options?.outputChunks) {
        setTimeout(() => {
          if (disposed) return;
          for (const chunk of options.outputChunks!) {
            outputHandler?.(chunk);
          }
        }, 0);
      }

      svc.lastHandle = handle;
      return handle;
    },
  };
  return svc;
}

function TestHarness({ service }: { service: InteractiveService }) {
  const result = useInteractiveExecution(service);
  return (
    <div>
      <button data-testid="run" onClick={result.run} />
      <button data-testid="kill" onClick={result.kill} />
      <button data-testid="flush" onClick={result.flush} />
      <button data-testid="close" onClick={result.closeStdin} />
      <span data-testid="running">{String(result.running)}</span>
      <span data-testid="closed">{String(result.stdinClosed)}</span>
    </div>
  );
}

function OutputReader() {
  const output = useAtomValue(interactiveOutputAtom);
  return <span data-testid="output">{output.join('')}</span>;
}

describe('useInteractiveExecution', () => {
  it('run 後に running=true になる', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    expect(getByTestId('running').textContent).toBe('true');
  });

  it('kill 後に running=false になる', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      getByTestId('kill').click();
    });
    expect(getByTestId('running').textContent).toBe('false');
  });

  it('closeStdin 後に stdinClosed=true になる', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      getByTestId('close').click();
    });
    expect(getByTestId('closed').textContent).toBe('true');
  });

  it('出力チャンクが interactiveOutputAtom に追記される', () => {
    const service = createTestService({
      outputChunks: [{ stream: 'stdout', data: 'hello' }],
    });
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <OutputReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      jest.runAllTimers();
    });
    expect(getByTestId('output').textContent).toContain('hello');
  });

  it('アンマウント時に dispose が呼ばれる', () => {
    const service = createTestService();
    const { getByTestId, unmount } = render(
      <Provider>
        <TestHarness service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    const handle = service.lastHandle!;
    const disposeSpy = jest.spyOn(handle, 'dispose');

    unmount();
    expect(disposeSpy).toHaveBeenCalled();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });
});

// --- Phase 5: badge 統合テスト ---

function BadgeReader() {
  const results = useAtomValue(taskResultsAtom);
  const latestByType = useAtomValue(latestTaskIdByTypeAtom);
  const interactiveId = latestByType['interactive'];
  const entry = results.find((r) => r.taskId === interactiveId);
  return (
    <div>
      <span data-testid="phase">{entry?.phase ?? ''}</span>
      <span data-testid="badge-count">{String(entry?.badges.length ?? 0)}</span>
      <span data-testid="badges">
        {entry?.badges.map((b) => `${b.phase}:${b.status}:${b.label}`).join('|') ?? ''}
      </span>
    </div>
  );
}

describe('useInteractiveExecution - Phase 5 badge 統合', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('run 後にタスクが interactive として登録される', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    expect(getByTestId('phase').textContent).toBe('running');
    expect(getByTestId('badge-count').textContent).toBe('0');
  });

  it('ビルド成功 → 完了: badges に Compile + Completed が蓄積される', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      service.fireBuildResult({ phase: 'compile', exitStatus: 0, details: null });
    });

    act(() => {
      service.fireComplete({ exitStatus: 0, timeMs: 200 });
    });

    expect(getByTestId('badges').textContent).toBe(
      'compile:success:Compile|completed:success:Completed'
    );
    expect(getByTestId('phase').textContent).toBe('completed');
    expect(getByTestId('running').textContent).toBe('false');
  });

  it('ビルド失敗: Compile (exit=1) バッジのみ、phase=failed', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      service.fireBuildResult({ phase: 'compile', exitStatus: 1, details: null });
    });

    // ビルド失敗後に complete が来ても Completed バッジは追加されない
    act(() => {
      service.fireComplete({ exitStatus: 1, timeMs: 100 });
    });

    expect(getByTestId('badges').textContent).toBe(
      'compile:error:Compile (exit=1)'
    );
    expect(getByTestId('phase').textContent).toBe('failed');
  });

  it('ビルドフェーズなし: 完了時に Completed バッジのみ', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      service.fireComplete({ exitStatus: 0, timeMs: 50 });
    });

    expect(getByTestId('badges').textContent).toBe('completed:success:Completed');
    expect(getByTestId('phase').textContent).toBe('completed');
  });

  it('kill: Killed バッジが追加され phase=killed になる', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      getByTestId('kill').click();
    });

    expect(getByTestId('badges').textContent).toBe('killed:error:Killed');
    expect(getByTestId('phase').textContent).toBe('killed');
  });

  it('kill 後に complete が来ても Completed バッジは追加されない', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      getByTestId('kill').click();
    });

    act(() => {
      service.fireComplete({ exitStatus: -1, timeMs: 0 });
    });

    // Killed バッジのみ。Completed は追加されない
    expect(getByTestId('badges').textContent).toBe('killed:error:Killed');
    expect(getByTestId('phase').textContent).toBe('killed');
  });

  it('サーバ起因のシステムエラー（failed フェーズ）: Failed バッジが追加される', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    // サーバがシステムエラーで failed イベントを送信（phase='setup'）
    act(() => {
      service.fireComplete({ exitStatus: 1, timeMs: 0, phase: 'setup' });
    });

    expect(getByTestId('badges').textContent).toBe('setup:error:Failed');
    expect(getByTestId('phase').textContent).toBe('failed');
  });

  it('サーバ起因の kill（タイムアウト等）: Killed バッジが追加される', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    // サーバ側がタイムアウトで killed イベントを送信
    act(() => {
      service.fireComplete({ exitStatus: 1, timeMs: 0, phase: 'killed' });
    });

    expect(getByTestId('badges').textContent).toBe('killed:error:Killed');
    expect(getByTestId('phase').textContent).toBe('killed');
  });

  it('完了後に exitStatus!=0 の場合は Completed(exit=N) バッジ + phase=failed', () => {
    const service = createTestService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <BadgeReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });

    act(() => {
      service.fireComplete({ exitStatus: 2, timeMs: 100 });
    });

    expect(getByTestId('badges').textContent).toBe(
      'completed:warning:Completed (exit=2)'
    );
    expect(getByTestId('phase').textContent).toBe('failed');
  });
});
