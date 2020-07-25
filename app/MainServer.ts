import Next from "next";
import SocketIO from "socket.io";

import { LauncherSocket } from "./lib/launcher/LauncherSocket";
import CallbackManager from "./lib/launcher/CallbackManager";
import { setupExpressServer } from "./MainServer/Express";

const enableDev = process.env.NODE_ENV !== "production";
const appNext = Next({ dev: enableDev });
const port = parseInt(process.env.PORT || '3030');

(async () => {
  try {
    await appNext.prepare();

    const [expressServer, httpServer] = setupExpressServer(appNext.getRequestHandler(), port);
    const socketio = SocketIO(httpServer);

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

    // socketio binding
    socketio.on('connection', (socket: SocketIO.Socket) => {
      // TODO: identify browser
      console.log('connect', socket.id);

      socket.on('disconnect', () => {
        console.log('disconnect', socket.id);
      });

      socket.on('myping', (data) => {
        console.log('myping', data);
      });

      const jid2caller = {};

      socket.on('c2e_Exec', (data) => {
        const jid = data.id;
        data = data.data;

        if (data.action == 'run') {  // TODO: 実装が汚すぎる

          (async () => {
            // TODO: KILLが実装できない…
            const res_data1 = await launcherCallbackManager.postp(
              { method: 'store', files: [{ path: 'var/code.rb', data: data.code }] });
            if (!res_data1.success) {
              console.error('launcher failed: method=store: ', res_data1.error);
              socket.emit('s2c_ResultExec', res_data1);
              return;
            }

            // TODO: 実装が汚すぎる
            const caller = launcherCallbackManager.multipost(
              (res_data2) => {
                // note: may call this callback twice or more
                if (res_data2.result && res_data2.result.exited) {
                  // finish!
                  delete jid2caller[jid];
                  if (!res_data2.success) {
                    console.error('launcher failed: method=exec: ', res_data2.error);
                    socket.emit('s2c_ResultExec', res_data2);
                    return;
                  }
                }
                const sid = res_data2.id.sid;
                if (sid !== socket.id) return;  // may not happen
                res_data2.id = res_data2.id.jid;
                socket.emit('s2c_ResultExec', res_data2);
              });

            caller.call(null,
              { method: 'exec', cmd: 'ruby', args: ['var/code.rb'], stdin: data.stdin, id: { jid, sid: socket.id } }
            );

            jid2caller[jid] = caller;  // jidではなくJSON.stringify(data.id) の方が良さげ？
          })();

        }
        else if (data.action == 'kill') {  // TODO: 実装が汚すぎる

          const caller = jid2caller[jid];
          if (!caller) return;  // do nothing if jid is unknown
          caller.call(null,
            { method: 'kill', id: { jid, sid: socket.id } }
          );

        }
      });

    });

    // 仮
    launcher.start();


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
