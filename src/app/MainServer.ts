import Next from 'next';

import Config from '../lib/Config';
import { setupExpressServer } from './MainServer/Express';
import { setupSocketIO, setupSocketIOAndBindHandler } from './MainServer/SocketIO';
import LauncherHolder from './MainServer/LauncherHolder';

const appNext = Next({ dev: Config.develop });
const port = Config.httpPort;

(async () => {
  try {

    // launcher
    const launcherHolder = new LauncherHolder(5000);
    launcherHolder.start();

    // appServer
    await appNext.prepare();
    const [, httpServer] = setupExpressServer(appNext.getRequestHandler(), port);

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
