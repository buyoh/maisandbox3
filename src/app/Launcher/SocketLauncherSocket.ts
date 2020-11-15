import net from 'net';
import { CallbackClose, CallbackRecieve, ISocket } from './SocketInterface';

export class SocketLauncherSocket implements ISocket {
  private netSocket: net.Socket | null;
  private bufferStdout: string;
  private socketPath: string;

  private callbacks: {
    close: Array<CallbackClose>;
    recieve: Array<CallbackRecieve>;
  }; // close, recieve

  constructor(socketPath: string) {
    this.netSocket = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      recieve: [],
    };
    this.socketPath = socketPath;
  }

  private handleClose(code: number, signal: NodeJS.Signals | null): void {
    for (const c of this.callbacks.close) c(code, signal);
  }

  private handleRecieve(str: string): void {
    const li = str.split('\n');
    if (li.length === 1) {
      // no breaks
      this.bufferStdout += li[0];
    } else {
      const head = li.shift() || ''; // always string, not undefined
      this.handleRecieveLine(this.bufferStdout + head);
      const tail = li.pop() || ''; // always string, not undefined
      this.bufferStdout = tail;
      for (const line of li) {
        this.handleRecieveLine(line);
      }
    }
  }

  private handleRecieveLine(line: string): void {
    let j = null;
    try {
      j = JSON.parse(line);
    } catch (e) {
      // TODO: rescue exception
      console.error('LauncherSocket.handleRecieveLine: failed parse json', e);
      return;
    }
    for (const c of this.callbacks['recieve']) c(j);
  }

  //

  start(): void {
    const s = net.createConnection(this.socketPath);
    this.netSocket = s;
    s.on('end', () => {
      this.handleClose(0, null);
    });
    s.on('data', (data) => {
      this.handleRecieve(data.toString());
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

  onRecieve(callback: CallbackRecieve): void {
    this.callbacks['recieve'].push(callback);
  }
}
