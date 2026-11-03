import * as SocketIO from 'socket.io';
import Http from 'http';
import { ConnectionHandlerFactory } from '../connection-handler';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ConnectionStatus,
} from '../../interfaces/socket-events';
import {
  validateRunSingleTask,
  validateKill,
  extractId,
} from '../task-manager-service';

export interface BindSocketIOOptions {
  /** 初回接続時に送信する launcher 状態を取得する関数。未指定時は送信しない */
  getLauncherStatus?: () => ConnectionStatus;
}

export async function bindSocketIOToExpress(
  connectionHandlerFactory: ConnectionHandlerFactory,
  httpServer: Http.Server,
  options?: BindSocketIOOptions
): Promise<SocketIO.Server> {
  // TODO: 接続数上限・レートリミットの導入を検討
  // 現状、悪意あるクライアントが大量に接続・リクエスト送信可能（DoS脆弱性）
  const socketio = new SocketIO.Server<
    ClientToServerEvents,
    ServerToClientEvents
  >(httpServer);

  socketio.on('connection', (socket) => {
    const connectionHandler = connectionHandlerFactory.createConnectionHandler(
      socket.id
    );

    // 初回接続時に現在の launcher 状態を送信
    if (options?.getLauncherStatus) {
      socket.emit('launcherStatus', { status: options.getLauncherStatus() });
    }

    socket.on('disconnect', () => {
      connectionHandler.disconnect();
    });

    socket.on('runSingleTask', (raw_data) => {
      const request = validateRunSingleTask(raw_data);
      if (request === null) {
        const id = extractId(raw_data);
        socket.emit('taskResult', {
          id,
          success: false,
          summary: 'Invalid request',
        });
        return;
      }
      connectionHandler
        .runSingleTask(request, (data) => {
          socket.emit('taskResult', data);
        })
        .catch((e) => {
          console.error('Unhandled error in runSingleTask:', e);
        });
    });

    socket.on('kill', (raw_data) => {
      const request = validateKill(raw_data);
      if (request === null) {
        const id = extractId(raw_data);
        socket.emit('taskResult', {
          id,
          success: false,
          summary: 'Invalid request',
        });
        return;
      }
      connectionHandler.kill(request);
    });

    socket.on('runInteractiveTask', (raw_data) => {
      if (!raw_data || typeof raw_data !== 'object') {
        socket.emit('taskResult', {
          success: false,
          summary: 'Invalid request',
        });
        return;
      }
      const data = raw_data as any;
      if (!data.lang || typeof data.lang !== 'string') {
        const id = extractId(raw_data);
        socket.emit('taskResult', {
          id,
          success: false,
          summary: 'Invalid request',
        });
        return;
      }
      connectionHandler
        .runInteractiveTask(
          raw_data as any,
          (result) => {
            socket.emit('taskResult', result);
          },
          (output) => {
            socket.emit('interactiveOutput', output);
          }
        )
        .catch((e) => {
          console.error('Unhandled error in runInteractiveTask:', e);
        });
    });

    socket.on('interactiveStdin', (raw_data) => {
      if (!raw_data || typeof raw_data !== 'object') return;
      connectionHandler.interactiveStdin(raw_data as any);
    });

    socket.on('interactiveCloseStdin', (raw_data) => {
      connectionHandler.interactiveCloseStdin((raw_data as any) ?? {});
    });
  });

  return socketio;
}
