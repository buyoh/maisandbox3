import Http from 'http';
import Https from 'https';
import Express from 'express';
import * as SocketIO from 'socket.io';
import { bindViteDevToExpress } from './express-vite-dev';
import {
  bindSocketIOToExpress,
  BindSocketIOOptions,
} from './express-socket-io';
import { bindLangInfoApi } from './express-lang-info-api';
import { ConnectionHandlerFactory } from '../connection-handler';
import { bindStaticFileToExpress } from './express-static';
import { ILauncherInfoClient } from '../launcher/launcher-info-client-interface';

/** setupExpressServer の戻り値 */
export interface ExpressServerResources {
  httpServer: Http.Server;
  socketio: SocketIO.Server;
}

export async function setupExpressServer(
  connectionHandlerFactory: ConnectionHandlerFactory,
  port = 3030,
  sslConfig: null | Object,
  frontEndType: 'vite' | 'static',
  socketOptions?: BindSocketIOOptions,
  launcherInfoClient?: ILauncherInfoClient
): Promise<ExpressServerResources> {
  const appExpress = Express();

  // REST API routes（Vite/static ミドルウェアより前に登録）
  if (launcherInfoClient) {
    bindLangInfoApi(appExpress, launcherInfoClient);
  }

  const httpServer = sslConfig
    ? Https.createServer(sslConfig, appExpress)
    : Http.createServer(appExpress);

  if (frontEndType === 'vite') {
    await bindViteDevToExpress(appExpress, httpServer);
  } else if (frontEndType === 'static') {
    await bindStaticFileToExpress(appExpress);
  } else {
    throw new Error(
      'setupExpressServer: frontEndType is not valid: ' + frontEndType
    );
  }

  const socketio = await bindSocketIOToExpress(
    connectionHandlerFactory,
    httpServer,
    socketOptions
  );

  httpServer.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`> Ready on localhost:${port} - env='${process.env.NODE_ENV}'`);
  });

  return { httpServer, socketio };
}
