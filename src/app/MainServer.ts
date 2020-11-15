import Next from 'next';

import Config from '../lib/Config';
import { setupExpressServer } from './MainServer/Express';
import {
  setupSocketIO,
  setupSocketIOAndBindHandler,
} from './MainServer/SocketIO';
import LauncherHolder from './MainServer/LauncherHolder';
import { createLauncherSocket } from './Launcher/LauncherSocketFactory';

const appNext = Next({ dev: Config.develop });
const port = Config.httpPort;

(async () => {
  try {
    // launcher
    const launcherHolder = new LauncherHolder(
      5000,
      (code: number) => {
        if (Config.useChildProcess) {
          if (code == 1) {
            console.error('launcher has raised exceptions');
            process.exit(1);
          } else {
            console.error('launcher disconnected code=' + code);
            process.exit(0);
          }
          return false;
        }
        return true;
      },
      () => createLauncherSocket()
    );
    launcherHolder.start();

    // appServer
    await appNext.prepare();
    const [, httpServer] = setupExpressServer(
      appNext.getRequestHandler(),
      port
    );

    // socketio
    const socketio = setupSocketIO(httpServer);
    setupSocketIOAndBindHandler(socketio, launcherHolder.callbackManager);

    // trap
    process.on('SIGINT', () => {
      launcherHolder.stop();
      process.exit(0);
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
