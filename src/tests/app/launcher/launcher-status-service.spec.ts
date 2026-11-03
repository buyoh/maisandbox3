import { ConnectivityWatcher } from '../../../app/launcher/connectivity-watcher';
import { LauncherStatusService } from '../../../app/launcher/launcher-status-service';

type ConnectionStatus = 'connected' | 'disconnected';

/** テスト用の ConnectivityWatcher スタブ */
class ConnectivityWatcherStub implements ConnectivityWatcher {
  private status: ConnectionStatus;
  private resolvers: Array<(status: ConnectionStatus | null) => void> = [];
  private stopped = false;

  constructor(initialStatus: ConnectionStatus = 'disconnected') {
    this.status = initialStatus;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  waitForStatusChange(): Promise<ConnectionStatus | null> {
    if (this.stopped) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  stop(): void {
    this.stopped = true;
    for (const resolve of this.resolvers) {
      resolve(null);
    }
    this.resolvers = [];
  }

  // テスト用: 状態変化をシミュレート
  simulateStatusChange(newStatus: ConnectionStatus): void {
    this.status = newStatus;
    const resolvers = this.resolvers;
    this.resolvers = [];
    for (const resolve of resolvers) {
      resolve(newStatus);
    }
  }
}

describe('LauncherStatusService', () => {
  it('reports initial status from watcher', () => {
    const watcher = new ConnectivityWatcherStub('connected');
    const onChange = jest.fn();
    const service = new LauncherStatusService(watcher, onChange);

    expect(service.getStatus()).toBe('connected');
  });

  it('calls onStatusChange when status changes', async () => {
    const watcher = new ConnectivityWatcherStub('disconnected');
    const onChange = jest.fn();
    const service = new LauncherStatusService(watcher, onChange);
    service.start();

    // 状態変化をシミュレート
    watcher.simulateStatusChange('connected');

    // 非同期ループの完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalledWith('connected');
    expect(service.getStatus()).toBe('connected');

    service.stop();
  });

  it('does not call onStatusChange when status remains the same', async () => {
    const watcher = new ConnectivityWatcherStub('disconnected');
    const onChange = jest.fn();
    const service = new LauncherStatusService(watcher, onChange);
    service.start();

    // 同じ状態を返す
    watcher.simulateStatusChange('disconnected');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).not.toHaveBeenCalled();

    service.stop();
  });

  it('stops watching when stop() is called', async () => {
    const watcher = new ConnectivityWatcherStub('disconnected');
    const onChange = jest.fn();
    const service = new LauncherStatusService(watcher, onChange);
    service.start();

    service.stop();

    // stop 後に状態変化しても callback は呼ばれない
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('handles multiple status changes', async () => {
    const watcher = new ConnectivityWatcherStub('disconnected');
    const onChange = jest.fn();
    const service = new LauncherStatusService(watcher, onChange);
    service.start();

    watcher.simulateStatusChange('connected');
    await new Promise((resolve) => setTimeout(resolve, 0));

    watcher.simulateStatusChange('disconnected');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'connected');
    expect(onChange).toHaveBeenNthCalledWith(2, 'disconnected');
    expect(service.getStatus()).toBe('disconnected');

    service.stop();
  });
});
