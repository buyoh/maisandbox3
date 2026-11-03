import * as grpc from '@grpc/grpc-js';
import { ConnectionStatus } from '../../interfaces/socket-events';

/**
 * gRPC 接続状態の監視を抽象化するインターフェース。
 * テスト時にスタブを注入可能にする。
 */
export interface ConnectivityWatcher {
  /** 現在の接続状態を返す */
  getStatus(): ConnectionStatus;
  /** 状態変化を待機し、変化後の状態を返す。停止時は null を返す */
  waitForStatusChange(): Promise<ConnectionStatus | null>;
  /** 監視を停止する */
  stop(): void;
}

/**
 * gRPC Channel の connectivityState を監視する ConnectivityWatcher 実装。
 * READY 状態を connected、それ以外を disconnected と判定する。
 */
export class GrpcConnectivityWatcher implements ConnectivityWatcher {
  private channel: grpc.Channel;
  private stopped = false;
  private pendingResolve: ((status: ConnectionStatus | null) => void) | null =
    null;

  constructor(channel: grpc.Channel) {
    this.channel = channel;
  }

  getStatus(): ConnectionStatus {
    const state = this.channel.getConnectivityState(false);
    return state === grpc.connectivityState.READY
      ? 'connected'
      : 'disconnected';
  }

  waitForStatusChange(): Promise<ConnectionStatus | null> {
    if (this.stopped) return Promise.resolve(null);

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      const currentState = this.channel.getConnectivityState(true);
      const deadline = Date.now() + 5000;

      this.channel.watchConnectivityState(currentState, deadline, (err) => {
        this.pendingResolve = null;
        if (this.stopped) {
          resolve(null);
          return;
        }
        if (err) {
          // タイムアウト時はエラーが返る。現在の状態を返して再度待機させる
          resolve(this.getStatus());
          return;
        }
        resolve(this.getStatus());
      });
    });
  }

  stop(): void {
    this.stopped = true;
    // 保留中の Promise を即座に解決して shutdown ハングを防止
    if (this.pendingResolve) {
      this.pendingResolve(null);
      this.pendingResolve = null;
    }
  }
}
