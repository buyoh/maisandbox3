import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { useConnectionStatus } from '../../../web/hooks/use-connection-status';
import { ConnectionEventSource } from '../../../web/services/client-socket';
import {
  wsStatusAtom,
  launcherStatusAtom,
} from '../../../web/stores/connection-atoms';
import { LauncherStatusPayload } from '../../../interfaces/socket-events';

class ConnectionEventSourceStub implements ConnectionEventSource {
  private connectHandler: (() => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private launcherStatusHandler:
    ((data: LauncherStatusPayload) => void) | null = null;
  offAllCalled = false;

  onConnect(handler: () => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  onLauncherStatus(handler: (data: LauncherStatusPayload) => void): void {
    this.launcherStatusHandler = handler;
  }

  offAll(): void {
    this.offAllCalled = true;
    this.connectHandler = null;
    this.disconnectHandler = null;
    this.launcherStatusHandler = null;
  }

  // テスト用: イベント発火メソッド
  simulateConnect(): void {
    this.connectHandler?.();
  }

  simulateDisconnect(): void {
    this.disconnectHandler?.();
  }

  simulateLauncherStatus(status: 'connected' | 'disconnected'): void {
    this.launcherStatusHandler?.({ status });
  }
}

/** テスト用: atom 値を外部に公開するコンポーネント */
function AtomReader({
  onRead,
}: {
  onRead: (ws: string, launcher: string) => void;
}) {
  const ws = useAtomValue(wsStatusAtom);
  const launcher = useAtomValue(launcherStatusAtom);
  onRead(ws, launcher);
  return null;
}

describe('useConnectionStatus', () => {
  it('updates wsStatusAtom on connect event', () => {
    const stub = new ConnectionEventSourceStub();
    let wsStatus = '';
    let launcherStatus = '';

    function TestComponent() {
      useConnectionStatus(stub);
      return (
        <AtomReader
          onRead={(ws, l) => {
            wsStatus = ws;
            launcherStatus = l;
          }}
        />
      );
    }

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    expect(wsStatus).toBe('disconnected');

    act(() => {
      stub.simulateConnect();
    });

    expect(wsStatus).toBe('connected');
  });

  it('updates wsStatusAtom on disconnect event', () => {
    const stub = new ConnectionEventSourceStub();
    let wsStatus = '';

    function TestComponent() {
      useConnectionStatus(stub);
      return (
        <AtomReader
          onRead={(ws) => {
            wsStatus = ws;
          }}
        />
      );
    }

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    act(() => {
      stub.simulateConnect();
    });
    expect(wsStatus).toBe('connected');

    act(() => {
      stub.simulateDisconnect();
    });
    expect(wsStatus).toBe('disconnected');
  });

  it('updates launcherStatusAtom on launcherStatus event', () => {
    const stub = new ConnectionEventSourceStub();
    let launcherStatus = '';

    function TestComponent() {
      useConnectionStatus(stub);
      return (
        <AtomReader
          onRead={(_, l) => {
            launcherStatus = l;
          }}
        />
      );
    }

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    expect(launcherStatus).toBe('disconnected');

    act(() => {
      stub.simulateLauncherStatus('connected');
    });

    expect(launcherStatus).toBe('connected');

    act(() => {
      stub.simulateLauncherStatus('disconnected');
    });

    expect(launcherStatus).toBe('disconnected');
  });

  it('calls offAll on unmount', () => {
    const stub = new ConnectionEventSourceStub();

    function TestComponent() {
      useConnectionStatus(stub);
      return null;
    }

    const { unmount } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    expect(stub.offAllCalled).toBe(false);
    unmount();
    expect(stub.offAllCalled).toBe(true);
  });

  it('does nothing when events is null', () => {
    function TestComponent() {
      useConnectionStatus(null);
      return null;
    }

    // Should not throw
    expect(() => {
      render(
        <Provider>
          <TestComponent />
        </Provider>
      );
    }).not.toThrow();
  });
});
