import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useMultiTaskExecution } from '../../../web/hooks/use-multi-task-execution';
import {
  MultiStdioService,
  MultiStdioHandle,
} from '../../../web/services/service-interfaces';
import {
  BuildPhaseResult,
  MultiRunResult,
} from '../../../interfaces/multi-stdio-types';
import {
  multiBuildResultAtom,
  multiRunResultsAtom,
  stdinListAtom,
} from '../../../web/stores/multi-stdio-atoms';
import { taskResultsAtom } from '../../../web/stores/status-atoms';
import { TaskStatusEntry } from '../../../web/stores/status/types';

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: Array<[any, any]>;
  children: React.ReactNode;
}) {
  useHydrateAtoms(initialValues);
  return <>{children}</>;
}

/** 即座にコールバックを発火するテスト用 MultiStdioService */
function createTestMultiService(options?: {
  buildExitStatus?: number;
  runResults?: MultiRunResult[];
}): MultiStdioService {
  return {
    run(_lang: string, _code: string, _stdinList: string[]): MultiStdioHandle {
      let buildHandler: ((r: BuildPhaseResult) => void) | null = null;
      let runHandler: ((r: MultiRunResult) => void) | null = null;
      let completeHandler: (() => void) | null = null;
      let disposed = false;

      // 即座にイベント発火
      setTimeout(() => {
        if (disposed) return;
        const buildExit = options?.buildExitStatus ?? 0;
        buildHandler?.({
          phase: 'build',
          exitStatus: buildExit,
          timeMs: 50,
          stdout: '',
          stderr: '',
        });
        if (buildExit !== 0) {
          completeHandler?.();
          return;
        }
        const results = options?.runResults ?? [
          {
            stdinIndex: 0,
            exitStatus: 0,
            timeMs: 10,
            stdout: 'out0',
            stderr: '',
          },
        ];
        for (const r of results) {
          runHandler?.(r);
        }
        completeHandler?.();
      }, 0);

      return {
        onBuildResult(h) {
          buildHandler = h;
        },
        onRunResult(h) {
          runHandler = h;
        },
        onComplete(h) {
          completeHandler = h;
        },
        kill() {
          disposed = true;
        },
        dispose() {
          disposed = true;
        },
      };
    },
  };
}

function TestHarness({ service }: { service: MultiStdioService }) {
  const { run, kill, running } = useMultiTaskExecution(service);
  return (
    <div>
      <button data-testid="run" onClick={run} />
      <button data-testid="kill" onClick={kill} />
      <span data-testid="running">{String(running)}</span>
    </div>
  );
}

function ResultsReader() {
  const build = useAtomValue(multiBuildResultAtom);
  const runs = useAtomValue(multiRunResultsAtom);
  const statusResults = useAtomValue(taskResultsAtom);
  const lastEntry =
    statusResults.length > 0 ? statusResults[statusResults.length - 1] : null;
  const lastBadge =
    lastEntry && lastEntry.badges.length > 0
      ? lastEntry.badges[lastEntry.badges.length - 1]
      : null;
  return (
    <div>
      <span data-testid="build">
        {build ? String(build.exitStatus) : 'null'}
      </span>
      <span data-testid="run-count">{runs.length}</span>
      <span data-testid="status-count">{statusResults.length}</span>
      <span data-testid="status-last-badge-label">
        {lastBadge ? lastBadge.label : ''}
      </span>
      <span data-testid="status-last-phase">
        {lastEntry ? lastEntry.phase : ''}
      </span>
      <span data-testid="status-badge-count">
        {lastEntry ? lastEntry.badges.length : 0}
      </span>
    </div>
  );
}

describe('useMultiTaskExecution', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('run 後に running=true、complete 後に running=false', () => {
    const service = createTestMultiService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <ResultsReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    // まだ setTimeout 内が実行されていない
    expect(getByTestId('running').textContent).toBe('true');

    act(() => {
      jest.runAllTimers();
    });
    expect(getByTestId('running').textContent).toBe('false');
  });

  it('ビルド結果と実行結果が atom に格納される', () => {
    const service = createTestMultiService({
      runResults: [
        { stdinIndex: 0, exitStatus: 0, timeMs: 10, stdout: 'a', stderr: '' },
        { stdinIndex: 1, exitStatus: 0, timeMs: 20, stdout: 'b', stderr: '' },
      ],
    });
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <ResultsReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(getByTestId('build').textContent).toBe('0');
    expect(getByTestId('run-count').textContent).toBe('2');
  });

  it('ステータスバーにタスクが登録される', () => {
    const service = createTestMultiService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <ResultsReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(getByTestId('status-count').textContent).not.toBe('0');
    // 最後のバッジのラベルに "passed" が含まれる（例: "1/1 passed"）
    expect(getByTestId('status-last-badge-label').textContent).toContain('passed');
  });

  it('kill で running=false になりステータスが Killed になる', () => {
    const service: MultiStdioService = {
      run() {
        return {
          onBuildResult() {},
          onRunResult() {},
          onComplete() {},
          kill() {},
          dispose() {},
        };
      },
    };
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <ResultsReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      getByTestId('kill').click();
    });

    expect(getByTestId('running').textContent).toBe('false');
    expect(getByTestId('status-last-badge-label').textContent).toBe('Killed');
  });

  it('ビルド失敗時は Build バッジが追加され phase=failed になる', () => {
    const service = createTestMultiService({ buildExitStatus: 1 });
    const { getByTestId } = render(
      <Provider>
        <TestHarness service={service} />
        <ResultsReader />
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      jest.runAllTimers();
    });

    expect(getByTestId('status-last-phase').textContent).toBe('failed');
    // バッジの 1 つ目が build フェーズ失敗バッジ
    expect(getByTestId('status-badge-count').textContent).toBe('1');
  });

  it('ビルド成功 + 一部 run 失敗時はすべてのバッジが追加される', () => {
    const service = createTestMultiService({
      runResults: [
        { stdinIndex: 0, exitStatus: 0, timeMs: 10, stdout: 'ok', stderr: '' },
        { stdinIndex: 1, exitStatus: 1, timeMs: 10, stdout: '', stderr: 'err' },
      ],
    });
    const { getByTestId } = render(
      <Provider>
        <HydrateAtoms initialValues={[[stdinListAtom, ['input1', 'input2']]]}>
          <TestHarness service={service} />
          <ResultsReader />
        </HydrateAtoms>
      </Provider>
    );

    act(() => {
      getByTestId('run').click();
    });
    act(() => {
      jest.runAllTimers();
    });

    // build + run1 + run2 + summary = 4 バッジ
    expect(getByTestId('status-badge-count').textContent).toBe('4');
    // 最後は "1/2 passed"
    expect(getByTestId('status-last-badge-label').textContent).toBe('1/2 passed');
  });
});
