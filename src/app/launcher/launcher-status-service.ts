import { ConnectivityWatcher } from './connectivity-watcher';
import { ConnectionStatus } from '../../interfaces/socket-events';

/**
 * gRPC 接続状態を監視し、変化時にコールバックで通知するサービス。
 * ConnectivityWatcher を注入することでテスト容易にする。
 */
export class LauncherStatusService {
  private watcher: ConnectivityWatcher;
  private onStatusChange: (status: ConnectionStatus) => void;
  private running = false;
  private currentStatus: ConnectionStatus;

  constructor(
    watcher: ConnectivityWatcher,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.watcher = watcher;
    this.onStatusChange = onStatusChange;
    this.currentStatus = watcher.getStatus();
  }

  /** 現在の接続状態を返す */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /** 状態監視ループを開始する */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.watchLoop();
  }

  /** 状態監視を停止する */
  stop(): void {
    this.running = false;
    this.watcher.stop();
  }

  private async watchLoop(): Promise<void> {
    while (this.running) {
      try {
        const newStatus = await this.watcher.waitForStatusChange();
        if (newStatus === null) break;
        if (newStatus !== this.currentStatus) {
          this.currentStatus = newStatus;
          this.onStatusChange(newStatus);
        }
      } catch (e) {
        // 予期しないエラー時は disconnected として扱い、ループを継続する
        console.error('LauncherStatusService: error in watch loop:', e);
        if (this.currentStatus !== 'disconnected') {
          this.currentStatus = 'disconnected';
          this.onStatusChange('disconnected');
        }
      }
    }
  }
}
