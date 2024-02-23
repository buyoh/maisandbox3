import * as SocketIO from 'socket.io';
import Http from 'http';
import { ConnectionHandlerFactory } from '../Api';

export async function bindSocketIOToExpress(
  connectionHandlerFactory: ConnectionHandlerFactory,
  httpServer: Http.Server
): Promise<void> {
  // TODO: change entry point
  const socketio = new SocketIO.Server(httpServer);

  // socketio binding
  socketio.on('connection', (socket: SocketIO.Socket) => {
    const connectionHandler = connectionHandlerFactory.createConnectionHandler(
      socket.id
    );

    socket.on('disconnect', () => {
      connectionHandler.disconnect();
    });

    socket.on('c2e_Exec', (raw_data) => {
      connectionHandler.queryExec(raw_data, (data) => {
        // callback to client
        socket.emit('s2c_ResultExec', data);
      });
    });
  }); // on connection
}
