import { CallbackManager } from '../../lib/CallbackManager';

export interface SocketInterface {
  emit: (data: any) => void;
  onReceive: (handler: (data: any) => void) => void;
}

export class ClientSocket {
  private socket: SocketInterface;
  private callbackManager: CallbackManager;

  constructor(socket: SocketInterface) {
    this.socket = socket;

    this.callbackManager = new CallbackManager((data) => {
      this.socket.emit(data);
    }, 'clicmid');

    this.socket.onReceive((data: any) => {
      this.callbackManager.handleReceive(data, data.continue);
    });
  }

  generateForPostExec(receive: (data: any) => void): (data: any) => void {
    return this.callbackManager.multipost(receive);
  }
}
