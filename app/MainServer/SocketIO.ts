import SocketIO from "socket.io";
import Http from "http";
import WebSocketIO from "socket.io";

import CallbackManager from "../lib/launcher/CallbackManager";
import { ExecHandler } from "./ExecHandler";


export function setupSocketIO(httpServer: Http.Server): WebSocketIO.Server {
  return WebSocketIO(httpServer);
}

export function setupSocketIOAndBindHandler(socketio: WebSocketIO.Server, launcherCallbackManager: CallbackManager) {
  // socketio binding
  socketio.on('connection', (socket: WebSocketIO.Socket) => {
    const execHandler = new ExecHandler(socket.id, launcherCallbackManager);
    console.log('connect', socket.id);

    socket.on('disconnect', () => {
      console.log('disconnect', socket.id);
    });

    socket.on('myping', (data) => {
      console.log('myping', data);
    });

    socket.on('c2e_Exec', (data) => {
      const jid = data.id;  // job id
      data = data.data;
      execHandler.handle(data, jid, (data) => {
        socket.emit('s2c_ResultExec', data);
      })
    });
  });  // on connection
}
