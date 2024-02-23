import Http from 'http';
import Https from 'https';
import Express from 'express';
import { bindNextjsToExpress } from './ExpressNextjs';
import { bindViteDevToExpress } from './ExpressViteDev';
import { bindSocketIOToExpress } from './ExpressSocketIO';
import { ConnectionHandlerFactory } from '../Api';

export async function setupExpressServer(
  connectionHandlerFactory: ConnectionHandlerFactory,
  port = 3030,
  sslConfig: null | Object,
  frontEndType: 'nextjs' | 'vite'
): Promise<void> {
  const appExpress = Express();

  if (frontEndType === 'nextjs') {
    await bindNextjsToExpress(appExpress);
  } else if (frontEndType === 'vite') {
    await bindViteDevToExpress(appExpress);
  } else {
    throw new Error(
      'setupExpressServer: frontEndType is not valid: ' + frontEndType
    );
  }

  const httpServer = sslConfig
    ? Https.createServer(sslConfig, appExpress)
    : Http.createServer(appExpress);
  await bindSocketIOToExpress(connectionHandlerFactory, httpServer);

  httpServer.listen(port, (err?: any) => {
    if (err) throw err;
    console.log(`> Ready on localhost:${port} - env='${process.env.NODE_ENV}'`);
  });
}
