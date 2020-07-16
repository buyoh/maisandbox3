import Http from "http";
import Express, { Request, Response } from "express";
import Next from "next";
import SocketIO from "socket.io";
import fs from 'fs';

import { LauncherSocket } from "./launcher/LauncherSocket";
import CallbackManager from "./launcher/CallbackManager";

const enableDev = process.env.NODE_ENV !== "production";
const appNext = Next({ dev: enableDev });
const handle = appNext.getRequestHandler();
const port = process.env.PORT || 3030;

(async () => {
  try {
    await appNext.prepare();
    const appExpress = Express();
    const server = Http.createServer(appExpress);
    const socketio = SocketIO(server);

    const launcher = new LauncherSocket();

    // express binding
    appExpress.all("*", (req: Request, res: Response) => {
      if (req.path.includes('sushi')) {
        return res.json({ name: 'maguro' });
      }
      return handle(req, res);
    });
    server.listen(port, (err?: any) => {
      if (err) throw err;
      console.log(`> Ready on localhost:${port} - env ${process.env.NODE_ENV}`);
    });

    const launcherCallbackManager = new CallbackManager((data) => {
      launcher.send(data);
    });
    launcher.on('recieve', launcherCallbackManager.getRecieveCallback());

    // socketio binding
    socketio.on('connection', (socket: SocketIO.Socket) => {
      // TODO: identify browser
      console.log('connect', socket.id);

      socket.on('disconnect', () => {
        console.log('disconnect', socket.id);
      });

      socket.on('myping', (data) => {
        console.log('myping', data);
      })

      socket.on('c2e_Exec', (data) => {
        const jid = data.id;
        data = data.data;
        launcherCallbackManager.post(
          { method: 'store', files: [{ path: 'var/code.rb', data: data.code }] },
          (data) => {
            if (!data.success) {
              console.error('launcher failed: method=store: ', data.error);
              socket.emit('s2c_ResultExec', data);
              return;
            }
            launcherCallbackManager.post(
              { method: 'exec', cmd: 'ruby', args: ['var/code.rb'], stdin: data.stdin, id: { jid, sid: socket.id } },
              (data) => {
                if (!data.success) {
                  console.error('launcher failed: method=exec: ', data.error);
                  socket.emit('s2c_ResultExec', data);
                  return;
                }
                const sid = data.id.sid;
                if (sid !== socket.id) return;  // may not happen
                data.id = data.id.jid;
                socket.emit('s2c_ResultExec', data);
              });
          });
      });
    });
    launcher.on('recieve', (data) => {
    });

    // 仮
    launcher.start();
    // launcher.on('recieve', (data) => {
    //   console.log(data);
    // });


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
