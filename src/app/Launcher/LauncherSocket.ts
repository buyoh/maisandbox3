import ChildProcess from 'child_process';
import net from 'net';
import Config from '../../lib/Config';
import { CallbackClose, CallbackRecieve, ISocket } from './SocketInterface';

const UseChildProcess = Config.useChildProcess;
const UnixSocketPath = Config.launcherSocketPath;

export class LauncherSocket implements ISocket {
  private process: ChildProcess.ChildProcess | null;
  private netSocket: net.Socket | null;
  private bufferStdout: string;

  private callbacks: {
    close: Array<CallbackClose>;
    recieve: Array<CallbackRecieve>;
  }; // close, recieve

  constructor() {
    this.process = null;
    this.netSocket = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      recieve: [],
    };
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

  private startChildProcess(): void {
    const args = [];
    if (Config.develop) args.push('--validate');
    const p = ChildProcess.spawn(
      'ruby',
      ['deps/applauncher/index.rb'].concat(args),
      { stdio: ['pipe', 'pipe', 'inherit'] }
    );
    this.process = p;

    p.on('close', (code, signal) => {
      this.handleClose(code, signal);
    });
    p.stdout.on('data', (data) => {
      // buffstdout.write(data.toString());
      this.handleRecieve(data.toString());
    });
  }

  private stopChildProcess(): void {
    if (this.process !== null) this.process.kill();
  }

  private isAliveChildProcess(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private writeChildProcess(str: string): void {
    this.process?.stdin?.write(str.trimEnd() + '\n', () => {
      /* flushed */
    });
  }

  //

  private startSocket(): void {
    const s = net.createConnection(UnixSocketPath);
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

  private stopSocket(): void {
    this.netSocket?.end();
  }

  private isAliveSocket(): boolean {
    return this.netSocket !== null && !this.netSocket.destroyed;
  }

  private writeSocket(str: string): void {
    this.netSocket?.write(str.trimEnd() + '\n', () => {
      /* flushed */
    });
  }

  //

  start(): void {
    UseChildProcess ? this.startChildProcess() : this.startSocket();
  }

  stop(): void {
    UseChildProcess ? this.stopChildProcess() : this.stopSocket();
  }

  isAlive(): boolean {
    return UseChildProcess ? this.isAliveChildProcess() : this.isAliveSocket();
  }

  send(data: unknown): boolean {
    if (!this.isAlive()) return false;
    const j = JSON.stringify(data);
    UseChildProcess ? this.writeChildProcess(j) : this.writeSocket(j);
    return true;
  }

  onClose(callback: CallbackClose): void {
    this.callbacks['close'].push(callback);
  }

  onRecieve(callback: CallbackRecieve): void {
    this.callbacks['recieve'].push(callback);
  }
}
