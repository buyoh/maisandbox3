import net from 'net';
import {
  CallbackClose,
  CallbackReceive,
  ISocket,
} from './LauncherSocketInterface';

export class SocketLauncherSocket implements ISocket {
  private netSocket: net.Socket | null;
  private bufferStdout: string;
  private socketPath: string;

  private callbacks: {
    close: Array<CallbackClose>;
    receive: Array<CallbackReceive>;
  }; // close, receive

  constructor(socketPath: string) {
    this.netSocket = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      receive: [],
    };
    this.socketPath = socketPath;
  }

  private handleClose(code: number, signal: NodeJS.Signals | null): void {
    for (const c of this.callbacks.close) c(code, signal);
  }

  private handleReceive(str: string): void {
    const li = str.split('\n');
    if (li.length === 1) {
      // no breaks
      this.bufferStdout += li[0];
    } else {
      const head = li.shift() || ''; // always string, not undefined
      this.handleReceiveLine(this.bufferStdout + head);
      const tail = li.pop() || ''; // always string, not undefined
      this.bufferStdout = tail;
      for (const line of li) {
        this.handleReceiveLine(line);
      }
    }
  }

  private handleReceiveLine(line: string): void {
    let j = null;
    try {
      j = JSON.parse(line);
    } catch (e) {
      // TODO: rescue exception
      console.error('LauncherSocket.handleReceiveLine: failed parse json', e);
      return;
    }
    for (const c of this.callbacks['receive']) c(j);
  }

  //

  start(): void {
    const s = net.createConnection(this.socketPath);
    this.netSocket = s;
    s.on('end', () => {
      this.handleClose(0, null);
    });
    s.on('data', (data) => {
      this.handleReceive(data.toString());
    });
    s.on('error', (err) => {
      console.error('LauncherSocket', err);
      if (!s.connecting) {
        this.handleClose(0, null);
      }
    });
  }

  stop(): void {
    this.netSocket?.end();
  }

  isAlive(): boolean {
    return this.netSocket !== null && !this.netSocket.destroyed;
  }

  private writeSocket(str: string): void {
    this.netSocket?.write(str.trimEnd() + '\n', () => {
      /* flushed */
    });
  }

  send(data: unknown): boolean {
    if (!this.isAlive()) return false;
    const j = JSON.stringify(data);
    this.writeSocket(j);
    return true;
  }

  //

  onClose(callback: CallbackClose): void {
    this.callbacks['close'].push(callback);
  }

  onReceive(callback: CallbackReceive): void {
    this.callbacks['receive'].push(callback);
  }
}
