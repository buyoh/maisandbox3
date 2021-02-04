import * as SocketIO from 'socket.io';
import Http from 'http';

import CallbackManager from '../../lib/CallbackManager';
import { QueryParser } from './QueryParser';
import { Query } from '../../lib/type';
import { TaskRunnerManager } from './TaskRunnerManager';

export function setupSocketIO(httpServer: Http.Server): SocketIO.Server {
  return new SocketIO.Server(httpServer);
}

export function setupSocketIOAndBindHandler(
  socketio: SocketIO.Server,
  launcherCallbackManager: CallbackManager
): void {
  // socketio binding
  socketio.on('connection', (socket: SocketIO.Socket) => {
    const taskRunnerManager = new TaskRunnerManager();
    const queryParser = new QueryParser(
      socket.id,
      taskRunnerManager,
      launcherCallbackManager
    );
    console.log('connect', socket.id);

    socket.on('disconnect', () => {
      console.log('disconnect', socket.id);
      taskRunnerManager.cleanup();
    });

    socket.on('c2e_Exec', (raw_data) => {
      const query: Query = raw_data;
      queryParser.handle(query, (data) => {
        // callback to client
        socket.emit('s2c_ResultExec', data);
      });
    });
  }); // on connection
}
