import { ClientSocket } from '../lib/ClientSocket';

export class CoreBehavior {
  private socket: ClientSocket | null;

  constructor() {
    this.socket = null;
    this.setClientSocket = this.setClientSocket.bind(this);
    this.handleEmitMessage = this.handleEmitMessage.bind(this);
  }

  setClientSocket(socket: ClientSocket): void {
    this.socket = socket;
  }

  handleEmitMessage(callback: (data: any) => void): (data: any) => void {
    if (!this.socket) {
      console.warn('websocket is not initialized!!');
      return () => { return; };
    }
    const post = this.socket.generateForPostExec(callback);
    const emitter = (data: any) => {
      post({ data });
    };
    return emitter;
  }

}