import * as SocketIO from 'socket.io';
import Next from 'next';
import Config from './Config';
import { setupExpressServer } from './Web/Express';
import { readFileSync } from 'fs';

// ----------------------------------------------------------------------------

export interface WebService {
  stop(): void;
}

export interface ConnectionHandler {
  disconnect(): void;
  // TODO: インターフェースの見直し(any?)
  queryExec(rawData: any, callback: (data: any) => void): void;
}

export interface ConnectionHandlerFactory {
  createConnectionHandler(socketId: string): ConnectionHandler;
}

// ----------------------------------------------------------------------------

class WebServiceImpl implements WebService {
  // 何も要らない
  stop(): void {
    //
  }
}

// ----------------------------------------------------------------------------

export async function createWebService(
  connectionHandlerFactory: ConnectionHandlerFactory
): Promise<WebService> {
  // TODO: nextjs をやめる
  // TODO: REST API を追加できるようにする
  const appNext = Next({ dev: Config.develop });
  const port = Config.httpPort;

  // sslconfig
  // TODO: 壊れているかもしれない
  const sslConfigPath = Config.sslConfigPath;
  const sslConfig = !sslConfigPath
    ? null
    : Object.entries(
        JSON.parse(readFileSync(sslConfigPath).toString()) as {
          [index: string]: string;
        }
      ).reduce((s, keyPath) => {
        s[keyPath[0]] = readFileSync(keyPath[1]).toString();
        return s;
      }, {} as { [index: string]: string });

  // appServer
  await appNext.prepare();
  const [, httpServer] = setupExpressServer(
    appNext.getRequestHandler(),
    port,
    sslConfig
  );

  // socketio
  const socketio = new SocketIO.Server(httpServer);

  // socketio binding
  socketio.on('connection', (socket: SocketIO.Socket) => {
    const connectionHandler = connectionHandlerFactory.createConnectionHandler(
      socket.id
    );

    socket.on('disconnect', () => {
      connectionHandler.disconnect();
    });

    socket.on('c2e_Exec', (raw_data) => {
      connectionHandler.queryExec(raw_data, (data) => {
        // callback to client
        socket.emit('s2c_ResultExec', data);
      });
    });
  }); // on connection

  return new WebServiceImpl();
}
