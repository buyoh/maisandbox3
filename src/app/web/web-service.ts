import Config from '../config';
import { setupExpressServer } from './express';
import { readFileSync } from 'fs';
import Http from 'http';
import * as SocketIO from 'socket.io';
import { ConnectionHandlerFactory } from '../connection-handler';
import { ILauncherInfoClient } from '../launcher/launcher-info-client-interface';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ConnectionStatus,
} from '../../interfaces/socket-events';

// ----------------------------------------------------------------------------

/** Web サーバのライフサイクルを管理するサービスインターフェース */
export interface WebService {
  stop(): Promise<void>;
}

/** Launcher 接続状態をクライアントに配信するインターフェース */
export interface LauncherStatusBroadcaster {
  /** 全クライアントに launcher 接続状態を broadcast する */
  broadcastLauncherStatus(status: ConnectionStatus): void;
}

/** createWebService の戻り値 */
export interface WebServiceBundle {
  webService: WebService;
  launcherStatusBroadcaster: LauncherStatusBroadcaster;
}

// ----------------------------------------------------------------------------

class WebServiceImpl implements WebService {
  private socketio: SocketIO.Server;
  private httpServer: Http.Server;

  constructor(socketio: SocketIO.Server, httpServer: Http.Server) {
    this.socketio = socketio;
    this.httpServer = httpServer;
  }

  /** Socket.IO サーバを閉じる（内部で httpServer.close() も呼ばれる） */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socketio.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      // Bug fix: httpServer.close() (called internally by socketio.close()) waits
      // for all connections to terminate, but non-Socket.IO connections (e.g., Vite
      // HMR WebSocket) are not closed by engine.close(). Force-close all remaining
      // connections so httpServer.close() can resolve.
      this.httpServer.closeAllConnections();
    });
  }
}

class LauncherStatusBroadcasterImpl implements LauncherStatusBroadcaster {
  private socketio: SocketIO.Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(
    socketio: SocketIO.Server<ClientToServerEvents, ServerToClientEvents>
  ) {
    this.socketio = socketio;
  }

  broadcastLauncherStatus(status: ConnectionStatus): void {
    this.socketio.emit('launcherStatus', { status });
  }
}

// ----------------------------------------------------------------------------

export interface CreateWebServiceOptions {
  /** 初回接続時に送信する launcher 状態を取得する関数 */
  getLauncherStatus?: () => ConnectionStatus;
  /** 言語情報取得用の gRPC クライアント（REST API 提供用） */
  launcherInfoClient?: ILauncherInfoClient;
}

export async function createWebService(
  connectionHandlerFactory: ConnectionHandlerFactory,
  frontEndType: 'vite' | 'static',
  options?: CreateWebServiceOptions
): Promise<WebServiceBundle> {
  const port = Config.httpPort;

  // sslconfig
  let sslConfig: { [index: string]: string } | null = null;
  const sslConfigPath = Config.sslConfigPath;
  if (sslConfigPath) {
    try {
      sslConfig = Object.entries(
        JSON.parse(readFileSync(sslConfigPath).toString()) as {
          [index: string]: string;
        }
      ).reduce(
        (s, keyPath) => {
          s[keyPath[0]] = readFileSync(keyPath[1]).toString();
          return s;
        },
        {} as { [index: string]: string }
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `Failed to load SSL config from ${sslConfigPath}: ${message}`
      );
      throw new Error(`SSL config load failed: ${message}`, { cause: e });
    }
  }

  // appServer
  const socketOptions = options?.getLauncherStatus
    ? { getLauncherStatus: options.getLauncherStatus }
    : undefined;
  const { socketio, httpServer } = await setupExpressServer(
    connectionHandlerFactory,
    port,
    sslConfig,
    frontEndType,
    socketOptions,
    options?.launcherInfoClient
  );

  return {
    webService: new WebServiceImpl(socketio, httpServer),
    launcherStatusBroadcaster: new LauncherStatusBroadcasterImpl(socketio),
  };
}
