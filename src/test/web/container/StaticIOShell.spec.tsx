import React from 'react';
import renderer from 'react-test-renderer';
import { StaticIOShell } from '../../../web/containers/StaticIOShell';
import { ClientSocket, SocketInterface } from '../../../web/lib/ClientSocket';

// black box test of StaticIOShell

class SocketMock implements SocketInterface {
  private emitMock: jest.Mock;
  private recieveHandler: (handler: (data: any) => void) => void;

  constructor(
    emitMock: jest.Mock,
    recieveMock: (handler: (data: any) => void) => void
  ) {
    this.emitMock = emitMock;
    this.recieveHandler = recieveMock;
  }
  emit(data: any): void {
    this.emitMock(data);
  }
  onRecieve(handler: (data: any) => void): void {
    this.recieveHandler(handler);
  }
}

const exampleRecievedStream = [
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
  let emulateResponce: (data: any) => void = () => {
    expect(true).toEqual(false);
  };
  const onRecieve = (h: (data: any) => void) => {
    emulateResponce = h;
  };
  const emitSocket = jest.fn();

  const socket = new ClientSocket(new SocketMock(emitSocket, onRecieve));
  const updateStdin = jest.fn();
  const updateStdout = jest.fn();
  const activateResult = jest.fn();
  const addResult = jest.fn();
  const clearResults = jest.fn();
  const addAnnotations = jest.fn();
  const clearAnnotations = jest.fn();

  let component: renderer.ReactTestRenderer | undefined;

  renderer.act(() => {
    component = renderer.create(
      <StaticIOShell
        stdin={'ruby'}
        stdout={'puts gets'}
        errlog={''}
        socket={socket}
        code={'p gets'}
        lang={'ruby'}
        updateStdin={updateStdin}
        updateStdout={updateStdout}
        addResult={addResult}
        clearResults={clearResults}
        addAnnotations={addAnnotations}
        clearAnnotations={clearAnnotations}
      />
    );
  });
  if (component === undefined) {
    expect(0).toEqual(1);
    return;
  }
  const h: ReturnType<
    StaticIOShell['forTestHandler']
  > = component.root.instance.forTestHandler();

  //

  expect(component.toJSON()).toMatchSnapshot();
  h.handleClickToggle();
  expect(component.toJSON()).toMatchSnapshot();
  h.handleClickToggle();

  //

  h.handleClickRun();
  expect(emitSocket.mock.calls.length).toEqual(1);
  expect(emitSocket.mock.calls[0]).toMatchSnapshot();
  const emittedData = emitSocket.mock.calls[0][0];
  const id = emittedData.id;
  exampleRecievedStream.forEach((data) => {
    data.id = { ...id };
    emulateResponce(data);
    if (!component) throw new Error();
    expect(component.toJSON()).toMatchSnapshot();
    expect([
      updateStdin.mock.calls,
      updateStdout.mock.calls,
      activateResult.mock.calls,
      addResult.mock.calls,
      clearResults.mock.calls,
      addAnnotations.mock.calls,
      clearAnnotations.mock.calls,
    ]).toMatchSnapshot();
  });
});

test('StaticIOShell_Kill', () => {
  let emulateResponce: (data: any) => void = () => {
    expect(true).toEqual(false);
  };
  const onRecieve = (h: (data: any) => void) => {
    emulateResponce = h;
  };
  const emitSocket = jest.fn();

  const socket = new ClientSocket(new SocketMock(emitSocket, onRecieve));
  const updateStdin = jest.fn();
  const updateStdout = jest.fn();
  const activateResult = jest.fn();
  const addResult = jest.fn();
  const clearResults = jest.fn();
  const addAnnotations = jest.fn();
  const clearAnnotations = jest.fn();

  let component: renderer.ReactTestRenderer | undefined;

  renderer.act(() => {
    component = renderer.create(
      <StaticIOShell
        stdin={'ruby'}
        stdout={'puts gets'}
        errlog={''}
        socket={socket}
        code={'p gets'}
        lang={'ruby'}
        updateStdin={updateStdin}
        updateStdout={updateStdout}
        addResult={addResult}
        clearResults={clearResults}
        addAnnotations={addAnnotations}
        clearAnnotations={clearAnnotations}
      />
    );
  });
  if (component === undefined) {
    expect(0).toEqual(1);
    return;
  }
  const h: ReturnType<
    StaticIOShell['forTestHandler']
  > = component.root.instance.forTestHandler();

  //

  for (let killIdx = 0; killIdx < exampleRecievedStream.length; ++killIdx) {
    emitSocket.mock.calls.splice(0);
    h.handleClickRun();
    const emittedData = emitSocket.mock.calls[0][0];
    const id = emittedData.id;
    exampleRecievedStream.forEach((data, idx) => {
      if (idx > killIdx) return; // kill したら送ってこない

      data.id = { ...id };
      emulateResponce(data);
      if (!component) throw new Error();

      // kill command
      if (idx === killIdx) {
        h.handleClickKill();
        expect(emitSocket.mock.calls).toMatchSnapshot();
        expect(component.toJSON()).toMatchSnapshot();
      }
    });
  }
  // 蓄積されているはずなので、纏めてsnapshotを取る
  // どこでエラーが発生しているかは、わかりにくくなる
  expect([
    updateStdin.mock.calls,
    updateStdout.mock.calls,
    activateResult.mock.calls,
    addResult.mock.calls,
    clearResults.mock.calls,
    addAnnotations.mock.calls,
    clearAnnotations.mock.calls,
  ]).toMatchSnapshot();
});
