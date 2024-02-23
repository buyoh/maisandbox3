import Config from './Config';
import { setupExpressServer } from './Web/Express';
import { readFileSync } from 'fs';
import { ConnectionHandlerFactory } from './Api';

// ----------------------------------------------------------------------------

export interface WebService {
  stop(): void;
}

// ----------------------------------------------------------------------------

class WebServiceImpl implements WebService {
  constructor() {
    //
  }
  stop(): void {
    //
  }
}

// ----------------------------------------------------------------------------

export async function createWebService(
  connectionHandlerFactory: ConnectionHandlerFactory,
  frontEndType: 'nextjs' | 'vite'
): Promise<WebService> {
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
  setupExpressServer(connectionHandlerFactory, port, sslConfig, frontEndType);

  return new WebServiceImpl();
}
