import React from 'react';
// import '@testing-library/jest-dom';
import { render, fireEvent, act } from '@testing-library/react';
import { Provider, useAtomValue, useStore } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { StaticIOShell } from '../../../web/widgets/StaticIOShell';
import {
  ClientSocket,
  SocketInterface,
} from '../../../web/services/client-socket';
import { TaskStatusListener } from '../../../web/services/task-status-listener';
import {
  RunSingleTaskRequest,
  KillRequest,
} from '../../../interfaces/query-types';
import { TaskResult } from '../../../interfaces/result-types';
import {
  codeAtom,
  langAtom,
  annotationsAtom,
} from '../../../web/stores/code-editor-atoms';
import { stdinAtom, stdoutAtom } from '../../../web/stores/static-io-atoms';
import { taskResultsAtom } from '../../../web/stores/status-atoms';
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

// black box test of StaticIOShell

class SocketMock implements SocketInterface {
  private emitRunSingleTaskMock: jest.Mock;
  private emitKillMock: jest.Mock;
  private taskResultHandler: ((data: TaskResult) => void) | null = null;

  constructor(emitRunSingleTaskMock: jest.Mock, emitKillMock: jest.Mock) {
    this.emitRunSingleTaskMock = emitRunSingleTaskMock;
    this.emitKillMock = emitKillMock;
  }

  emitRunSingleTask(data: RunSingleTaskRequest): void {
    this.emitRunSingleTaskMock(data);
  }

  emitKill(data: KillRequest): void {
    this.emitKillMock(data);
  }

  onTaskResult(handler: (data: TaskResult) => void): void {
    this.taskResultHandler = handler;
  }

  emitRunInteractiveTask(): void {}
  emitInteractiveStdin(): void {}
  emitInteractiveCloseStdin(): void {}
  onInteractiveOutput(): void {}

  disconnect(): void {}

  simulateTaskResult(data: TaskResult): void {
    this.taskResultHandler?.(data);
  }
}

const exampleReceivedStream: TaskResult[] = [
  {
    success: true,
    continue: true,
    running: false,
    summary: 'setup',
    id: { clicmid: 3 },
  },
  { success: true, continue: true, summary: 'store', id: { clicmid: 3 } },
  {
    success: true,
    continue: true,
    running: true,
    summary: 'exec...',
    id: { clicmid: 3 },
  },
  {
    success: true,
    continue: true,
    running: false,
    summary: 'exec',
    id: { clicmid: 3 },
  },
  { success: true, continue: true, summary: 'pull', id: { clicmid: 3 } },
  {
    success: true,
    summary: 'result(exec)',
    continue: true,
    details: [
      { type: 'status', status: 'success' },
      { type: 'param', key: 'time', value: 0.043364763259887695 },
      { type: 'param', key: 'exitstatus', value: 0 },
      { type: 'out', text: 'ASDFADSFA\n' },
      { type: 'log', text: 'asdfadsfa\n' },
      { type: 'annotation', annotations: [] },
    ],
    id: { clicmid: 3 },
  },
  { success: true, continue: false, summary: 'finalize', id: { clicmid: 3 } },
];

test('StaticIOShell', () => {
  const emitRunSingleTask = jest.fn();
  const emitKill = jest.fn();
  const socketMock = new SocketMock(emitRunSingleTask, emitKill);

  const socket = new ClientSocket(socketMock);

  // atom の状態を読み取るためのテスト用コンポーネント
  let stdoutVal = '';
  let results: TaskStatusEntry[] = [];
  function AtomReader() {
    stdoutVal = useAtomValue(stdoutAtom);
    results = useAtomValue(taskResultsAtom);
    return null;
  }

  // TaskStatusListener をセットアップしてストアに結果を書き込むコンポーネント
  function ListenerSetup() {
    const store = useStore();
    React.useEffect(() => {
      const listener = new TaskStatusListener(store);
      listener.attach(socketMock);
      return () => listener.detach();
    }, [store]);
    return null;
  }

  const { asFragment, getByTestId } = render(
    <TestProvider
      initialValues={[
        [codeAtom, 'p gets'],
        [langAtom, 'ruby'],
        [stdinAtom, 'ruby'],
        [stdoutAtom, 'puts gets'],
      ]}
    >
      <StaticIOShell socket={socket} />
      <AtomReader />
      <ListenerSetup />
    </TestProvider>
  );

  //

  expect(asFragment()).toMatchSnapshot();
  fireEvent.click(getByTestId('button-toggle-display'));

  expect(asFragment()).toMatchSnapshot();
  fireEvent.click(getByTestId('button-toggle-display'));

  //

  fireEvent.click(getByTestId('button-run'));
  expect(emitRunSingleTask.mock.calls.length).toEqual(1);
  expect(emitRunSingleTask.mock.calls[0]).toMatchSnapshot();
  const emittedData = emitRunSingleTask.mock.calls[0][0];
  const id = emittedData.id;
  exampleReceivedStream.forEach((data) => {
    data.id = { ...id };
    act(() => {
      socketMock.simulateTaskResult(data);
    });
    expect(asFragment()).toMatchSnapshot();
    expect({ stdoutVal, resultsCount: results.length }).toMatchSnapshot();
  });
});

test('StaticIOShell_Kill', () => {
  const emitRunSingleTask = jest.fn();
  const emitKill = jest.fn();
  const socketMock = new SocketMock(emitRunSingleTask, emitKill);

  const socket = new ClientSocket(socketMock);

  const { asFragment, getByTestId } = render(
    <TestProvider
      initialValues={[
        [codeAtom, 'p gets'],
        [langAtom, 'ruby'],
        [stdinAtom, 'ruby'],
        [stdoutAtom, 'puts gets'],
      ]}
    >
      <StaticIOShell socket={socket} />
    </TestProvider>
  );

  //

  for (let killIdx = 0; killIdx < exampleReceivedStream.length; ++killIdx) {
    emitRunSingleTask.mock.calls.splice(0);
    emitKill.mock.calls.splice(0);
    fireEvent.click(getByTestId('button-run'));
    const emittedData = emitRunSingleTask.mock.calls[0][0];
    const id = emittedData.id;
    exampleReceivedStream.forEach((data, idx) => {
      if (idx > killIdx) return; // kill したら送ってこない

      data.id = { ...id };
      act(() => {
        socketMock.simulateTaskResult(data);
      });

      // kill command
      if (idx === killIdx) {
        fireEvent.click(getByTestId('button-kill'));
        expect(emitKill.mock.calls).toMatchSnapshot();
        expect(asFragment()).toMatchSnapshot();
      }
    });
  }
});
