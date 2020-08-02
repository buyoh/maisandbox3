import SocketIO from 'socket.io';
import Http from 'http';

import CallbackManager from '../../lib/CallbackManager';
import { ExecHandler } from './ExecHandler';
import { Query } from '../../lib/type';


export function setupSocketIO(httpServer: Http.Server): SocketIO.Server {
  return SocketIO(httpServer);
}

export function setupSocketIOAndBindHandler(socketio: SocketIO.Server, launcherCallbackManager: CallbackManager): void {
  // socketio binding
  socketio.on('connection', (socket: SocketIO.Socket) => {
    const execHandler = new ExecHandler(socket.id, launcherCallbackManager);
    console.log('connect', socket.id);

    socket.on('disconnect', () => {
      console.log('disconnect', socket.id);
    });

    socket.on('c2e_Exec', (raw_data) => {
      const query: Query = raw_data;
      execHandler.handle(query, (data) => {
        // callback to client
        socket.emit('s2c_ResultExec', data);
      });
    });
  });  // on connection
}
