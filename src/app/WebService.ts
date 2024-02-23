import * as SocketIO from 'socket.io';
import Next from 'next';
import Config from './Config';
import { setupExpressServer } from './Web/Express';
import { readFileSync } from 'fs';
import fs from 'fs';
import vite from 'vite';
import path from 'path';

// ----------------------------------------------------------------------------

export interface WebService {
  getExpress(): any;
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
  constructor(private express: any) {
    //
  }
  getExpress() {
    return this.express;
  }
}

// ----------------------------------------------------------------------------

export async function createWebService(
  connectionHandlerFactory: ConnectionHandlerFactory,
  vitemode = true // TODO: Refactoring
): Promise<WebService> {
  // TODO: nextjs をやめる
  // TODO: REST API を追加できるようにする
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

  let requestHandler = null;
  if (!vitemode) {
    const appNext = Next({ dev: Config.develop });
    /* await */ appNext.prepare();
    requestHandler = appNext.getRequestHandler();
  }

  // appServer
  const [express, httpServer] = setupExpressServer(
    requestHandler,
    port,
    sslConfig
  );

  {
    // TODO: Refactoring
    const cwd = process.cwd();
    const viteServer = await vite.createServer({
      root: cwd,
      logLevel: 'info',
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 250,
        },
      },
    });
    express.use(viteServer.middlewares);

    express.use('*', async (req, res) => {
      try {
        const url = req.originalUrl;

        const html = fs.readFileSync(path.resolve(cwd, 'index.html'), 'utf-8'); // todo: async

        res
          .status(200)
          .set({ 'Content-Type': 'text/html' })
          .end(await viteServer.transformIndexHtml(url, html));
      } catch (e) {
        if (e instanceof Error) {
          viteServer && viteServer.ssrFixStacktrace(e);
          console.log(e.stack);
          res.status(500).end(e.stack);
        }
      }
    });
  }

  // socketio
  // TODO: change entry point
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

  return new WebServiceImpl(express);
}
