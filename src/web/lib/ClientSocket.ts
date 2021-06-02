import { CallbackManager } from '../../lib/CallbackManager';

export interface SocketInterface {
  emit: (data: any) => void;
  onRecieve: (handler: (data: any) => void) => void;
}

export class ClientSocket {
  private socket: SocketInterface;
  private callbackManager: CallbackManager;

  constructor(socket: SocketInterface) {
    this.socket = socket;

    this.callbackManager = new CallbackManager((data) => {
      this.socket.emit(data);
    }, 'clicmid');

    this.socket.onRecieve((data: any) => {
      this.callbackManager.handleRecieve(data, data.continue);
    });
  }

  generateForPostExec(recieve: (data: any) => void): (data: any) => void {
    return this.callbackManager.multipost(recieve);
  }
}
