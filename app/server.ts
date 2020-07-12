import Http from "http";
import Express, { Request, Response } from "express";
import Next from "next";
import SocketIO from "socket.io";
import fs from 'fs';

import { LauncherSocket } from "./launcher/LauncherSocket";

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

    // socketio binding
    socketio.on('connection', (socket: SocketIO.Socket) => {
      // TODO: identify browser
      console.log('connected!');

      socket.on('myping', (data) => {
        console.log('myping', data);
      })

      socket.on('c2e_Exec', (data) => {
        data = data.data;
        fs.writeFileSync('var/code.rb', data.code);
        launcher.send({ method: 'exec', cmd: 'ruby', args: ['var/code.rb'], stdin: data.stdin });
      })

      launcher.on('recieve', (data) => {
        socket.emit('s2c_ResultExec', { data });
      });
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
