import Next from "next";
import SocketIO from "socket.io";

import { LauncherSocket } from "./lib/launcher/LauncherSocket";
import CallbackManager from "./lib/launcher/CallbackManager";
import { setupExpressServer } from "./MainServer/Express";
import { setupSocketIO, setupSocketIOAndBindHandler } from "./MainServer/SocketIO";

const enableDev = process.env.NODE_ENV !== "production";
const appNext = Next({ dev: enableDev });
const port = parseInt(process.env.PORT || '3030');

(async () => {
  try {

    // launcher
    const launcher = new LauncherSocket();
    const launcherCallbackManager = new CallbackManager((data) => {
      launcher.send(data);
    });
    launcher.on('close', (code) => {
      if (code == 1) {
        console.error('launcher has raised exceptions');
        process.exit(1);
      }
    })
    launcher.on('recieve', (data) => {
      launcherCallbackManager.handleRecieve(data, !!data.continue);
    });
    launcher.start();

    // appServer
    await appNext.prepare();
    const [expressServer, httpServer] = setupExpressServer(appNext.getRequestHandler(), port);

    // socketio
    const socketio = setupSocketIO(httpServer);
    setupSocketIOAndBindHandler(socketio, launcherCallbackManager);

    // trap
    process.on('SIGINT', () => {
      launcher.stop();
      process.exit(0);
    });

  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
