import React from 'react';
// import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import { StaticIOShell } from '../../../web/containers/StaticIOShell';
import { ClientSocket, SocketInterface } from '../../../web/lib/ClientSocket';



// black box test of StaticIOShell

class SocketMock implements SocketInterface {
  private emitMock: jest.Mock;
  private receiveHandler: (handler: (data: any) => void) => void;

  constructor(
    emitMock: jest.Mock,
    receiveMock: (handler: (data: any) => void) => void
  ) {
    this.emitMock = emitMock;
    this.receiveHandler = receiveMock;
  }
  emit(data: any): void {
    this.emitMock(data);
  }
  onReceive(handler: (data: any) => void): void {
    this.receiveHandler(handler);
  }
}

const exampleReceivedStream = [
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
  const onReceive = (h: (data: any) => void) => {
    emulateResponce = h;
  };
  const emitSocket = jest.fn();

  const socket = new ClientSocket(new SocketMock(emitSocket, onReceive));
  const updateStdin = jest.fn();
  const updateStdout = jest.fn();
  const activateResult = jest.fn();
  const addResult = jest.fn();
  const clearResults = jest.fn();
  const addAnnotations = jest.fn();
  const clearAnnotations = jest.fn();

  const { asFragment, getByTestId } = render(
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

  //

  expect(asFragment()).toMatchSnapshot();
  fireEvent.click(getByTestId('button-toggle-display'));
  
  expect(asFragment()).toMatchSnapshot();
  fireEvent.click(getByTestId('button-toggle-display'));

  //

  fireEvent.click(getByTestId('button-run'));
  expect(emitSocket.mock.calls.length).toEqual(1);
  expect(emitSocket.mock.calls[0]).toMatchSnapshot();
  const emittedData = emitSocket.mock.calls[0][0];
  const id = emittedData.id;
  exampleReceivedStream.forEach((data) => {
    data.id = { ...id };
    emulateResponce(data);
    expect(asFragment()).toMatchSnapshot();
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
  const onReceive = (h: (data: any) => void) => {
    emulateResponce = h;
  };
  const emitSocket = jest.fn();

  const socket = new ClientSocket(new SocketMock(emitSocket, onReceive));
  const updateStdin = jest.fn();
  const updateStdout = jest.fn();
  const activateResult = jest.fn();
  const addResult = jest.fn();
  const clearResults = jest.fn();
  const addAnnotations = jest.fn();
  const clearAnnotations = jest.fn();

  const { asFragment, getByTestId } = render(
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

  //

  for (let killIdx = 0; killIdx < exampleReceivedStream.length; ++killIdx) {
    emitSocket.mock.calls.splice(0);
    fireEvent.click(getByTestId('button-run'));
    const emittedData = emitSocket.mock.calls[0][0];
    const id = emittedData.id;
    exampleReceivedStream.forEach((data, idx) => {
      if (idx > killIdx) return; // kill したら送ってこない

      data.id = { ...id };
      emulateResponce(data);

      // kill command
      if (idx === killIdx) {
        fireEvent.click(getByTestId('button-kill'));
        expect(emitSocket.mock.calls).toMatchSnapshot();
        expect(asFragment()).toMatchSnapshot();
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
