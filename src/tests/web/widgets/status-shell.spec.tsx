import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { Provider, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import StatusShell from '../../../web/widgets/StatusShell';
import {
  taskResultsAtom,
  activeTaskIndexAtom,
  activeBadgeIndexAtom,
  activateTaskAtom,
  latestTaskIdByTypeAtom,
  activePanelTabAtom,
} from '../../../web/stores/status-atoms';
import { TaskStatusEntry } from '../../../web/stores/status/types';

function TestProvider({
  initialValues,
  children,
}: {
  initialValues?: Array<[any, any]>;
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <HydrateAtoms initialValues={initialValues || []}>
        {children}
      </HydrateAtoms>
    </Provider>
  );
}

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

/** taskId=1 の single タスク（Build + Completed） */
const singleTask1: TaskStatusEntry = {
  taskId: 1,
  type: 'single',
  phase: 'completed',
  badges: [
    { phase: 'build', status: 'success', label: 'Build', details: null },
    { phase: 'completed', status: 'success', label: 'Completed', details: null },
  ],
};

/** taskId=2 の single タスク（Build 失敗） */
const singleTask2: TaskStatusEntry = {
  taskId: 2,
  type: 'single',
  phase: 'failed',
  badges: [
    { phase: 'build', status: 'error', label: 'Build (exit=1)', details: null },
  ],
};

/** taskId=3 の multi タスク */
const multiTask3: TaskStatusEntry = {
  taskId: 3,
  type: 'multi',
  phase: 'completed',
  badges: [
    { phase: 'build', status: 'success', label: 'Build', details: null },
    { phase: 'summary', status: 'success', label: '2/2 passed', details: null },
  ],
};

describe('StatusShell', () => {
  it('file stdio タブ: 最新 single タスクのバッジを表示する', () => {
    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, [singleTask1, singleTask2]],
          [latestTaskIdByTypeAtom, { single: 2, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
          [activeTaskIndexAtom, 0],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    // taskId=2 の "Build (exit=1)" だけが表示される
    expect(container).toMatchSnapshot();
  });

  it('タスク未登録（latestTaskId が null）のとき空表示になる', () => {
    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, []],
          [latestTaskIdByTypeAtom, { single: null, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    expect(container).toMatchSnapshot();
  });

  it('interactive タブかつ latestTaskId=null のとき空表示になる（クラッシュしない）', () => {
    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, [singleTask1]],
          [latestTaskIdByTypeAtom, { single: 1, multi: null, interactive: null }],
          [activePanelTabAtom, 'interactive'],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    expect(container).toMatchSnapshot();
  });

  it('multi stdio タブ: 最新 multi タスクのバッジを表示する', () => {
    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, [singleTask1, multiTask3]],
          [latestTaskIdByTypeAtom, { single: 1, multi: 3, interactive: null }],
          [activePanelTabAtom, 'multi stdio'],
          [activeTaskIndexAtom, 0],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    // taskId=3 の multi タスクバッジが表示される
    expect(container).toMatchSnapshot();
  });

  it('badges が空のタスク（Running... 状態）を表示する', () => {
    const runningResult: TaskStatusEntry[] = [
      {
        taskId: 1,
        type: 'single',
        phase: 'running',
        badges: [],
      },
    ];

    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, runningResult],
          [latestTaskIdByTypeAtom, { single: 1, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
          [activeTaskIndexAtom, 0],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    expect(container).toMatchSnapshot();
  });

  it('バッジクリックで detail が表示される', () => {
    const resultsWithDetail: TaskStatusEntry[] = [
      {
        taskId: 1,
        type: 'single',
        phase: 'failed',
        badges: [
          {
            phase: 'build',
            status: 'error',
            label: 'Build (exit=1)',
            details: [{ type: 'text', title: 'stderr', text: 'compile error' }],
          },
        ],
      },
    ];

    const { container } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, resultsWithDetail],
          [latestTaskIdByTypeAtom, { single: 1, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
          [activeTaskIndexAtom, 0],
          [activeBadgeIndexAtom, 0],
        ]}
      >
        <StatusShell />
      </TestProvider>
    );

    expect(container).toMatchSnapshot();
  });

  it('バッジクリックで activeTaskIndex と activeBadgeIndex が更新される', () => {
    let capturedTaskIndex: number | null = null;
    let capturedBadgeIndex: number | null = null;

    function StateReader() {
      capturedTaskIndex = useAtomValue(activeTaskIndexAtom);
      capturedBadgeIndex = useAtomValue(activeBadgeIndexAtom);
      return null;
    }

    const { getByText } = render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, [singleTask1, singleTask2]],
          [latestTaskIdByTypeAtom, { single: 2, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
          [activeTaskIndexAtom, null],
        ]}
      >
        <StatusShell />
        <StateReader />
      </TestProvider>
    );

    // task2 の "Build (exit=1)" バッジをクリック
    // StatusBar は最新タスク（task2）を表示する
    const badge = getByText('Build (exit=1)');
    fireEvent.click(badge.parentElement!); // flex-elem-fix wrapper をクリック

    expect(capturedTaskIndex).toBe(1); // task2 (index 1)
    expect(capturedBadgeIndex).toBe(0); // task2 の最初のバッジ
  });

  it('タブ切り替え時に activeBadgeIndex が null にリセットされる', () => {
    let capturedBadgeIndex: number | null | undefined = undefined;
    let setTab: ((key: string) => void) | null = null;

    function TabChanger() {
      setTab = useSetAtom(activePanelTabAtom);
      return null;
    }
    function StateReader() {
      capturedBadgeIndex = useAtomValue(activeBadgeIndexAtom);
      return null;
    }

    render(
      <TestProvider
        initialValues={[
          [taskResultsAtom, [singleTask1]],
          [latestTaskIdByTypeAtom, { single: 1, multi: null, interactive: null }],
          [activePanelTabAtom, 'file stdio'],
          [activeBadgeIndexAtom, 0],
        ]}
      >
        <StatusShell />
        <StateReader />
        <TabChanger />
      </TestProvider>
    );

    // 初期状態: activeBadgeIndex = 0
    expect(capturedBadgeIndex).toBe(0);

    // タブを切り替えると activeBadgeIndex がリセットされる
    act(() => {
      setTab!('multi stdio');
    });

    expect(capturedBadgeIndex).toBeNull();
  });
});
