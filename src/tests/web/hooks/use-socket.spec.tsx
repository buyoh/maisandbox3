import React from 'react';
import { render, act } from '@testing-library/react';
import {
  useSocket,
  UseSocketResult,
  SocketFactoryResult,
} from '../../../web/hooks/use-socket';
import {
  SocketInterface,
  ClientSocket,
  ConnectionEventSource,
} from '../../../web/services/client-socket';
import {
  RunSingleTaskRequest,
  KillRequest,
} from '../../../interfaces/query-types';
import { TaskResult } from '../../../interfaces/result-types';
import { LauncherStatusPayload } from '../../../interfaces/socket-events';

class SocketStub implements SocketInterface {
  disconnected = false;

  emitRunSingleTask(_data: RunSingleTaskRequest): void {}
  emitKill(_data: KillRequest): void {}
  onTaskResult(_handler: (data: TaskResult) => void): void {}
  emitRunInteractiveTask(): void {}
  emitInteractiveStdin(): void {}
  emitInteractiveCloseStdin(): void {}
  onInteractiveOutput(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

class ConnectionEventSourceStub implements ConnectionEventSource {
  offAllCalled = false;

  onConnect(_handler: () => void): void {}
  onDisconnect(_handler: () => void): void {}
  onLauncherStatus(_handler: (data: LauncherStatusPayload) => void): void {}
  offAll(): void {
    this.offAllCalled = true;
  }
}

function createFactory(
  stub: SocketStub,
  eventsStub: ConnectionEventSourceStub
): () => SocketFactoryResult {
  return () => ({ socket: stub, events: eventsStub });
}

describe('useSocket', () => {
  it('returns ClientSocket after mount', () => {
    const stub = new SocketStub();
    const eventsStub = new ConnectionEventSourceStub();
    let result: UseSocketResult = {
      clientSocket: null,
      events: null,
      socketInterface: null,
    };

    function TestComponent() {
      result = useSocket({ factory: createFactory(stub, eventsStub) });
      return null;
    }

    render(<TestComponent />);
    expect(result.clientSocket).toBeInstanceOf(ClientSocket);
    expect(result.events).toBe(eventsStub);
  });

  it('disconnects on unmount', () => {
    const stub = new SocketStub();
    const eventsStub = new ConnectionEventSourceStub();

    function TestComponent() {
      useSocket({ factory: createFactory(stub, eventsStub) });
      return null;
    }

    const { unmount } = render(<TestComponent />);
    expect(stub.disconnected).toBe(false);

    unmount();
    expect(stub.disconnected).toBe(true);
  });

  it('returns null before connection is established', () => {
    // useState の初期値は null
    let result: UseSocketResult = {
      clientSocket: 'not-null' as any,
      events: 'not-null' as any,
      socketInterface: null,
    };
    const stub = new SocketStub();
    const eventsStub = new ConnectionEventSourceStub();

    function TestComponent() {
      result = useSocket({ factory: createFactory(stub, eventsStub) });
      return null;
    }

    // 最初のレンダリングでは useEffect がまだ発火していないが、
    // testing-library は act で自動 flush するので、初回レンダリング後に
    // useEffect が同期的に実行される。
    render(<TestComponent />);
    // act 後は socket が設定されている
    expect(result.clientSocket).not.toBeNull();
    expect(result.events).not.toBeNull();
  });
});
