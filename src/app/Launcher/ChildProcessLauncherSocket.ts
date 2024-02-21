import ChildProcess from 'child_process';
import Config from '../Config';
import {
  CallbackClose,
  CallbackReceive,
  ISocket,
} from './LauncherSocketInterface';

export class ChildProcessLauncherSocket implements ISocket {
  private process: ChildProcess.ChildProcess | null;
  private bufferStdout: string;

  private callbacks: {
    close: Array<CallbackClose>;
    receive: Array<CallbackReceive>;
  }; // close, receive

  constructor() {
    this.process = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      receive: [],
    };
  }

  private handleClose(
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
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

  private writeChildProcess(str: string): void {
    this.process?.stdin?.write(str.trimEnd() + '\n', () => {
      /* flushed */
    });
  }

  //

  start(): void {
    const args = ['--workdir', `${Config.appRootDirectory}/tmp/omochi`];
    if (Config.develop) {
      args.push('--validate');
    } else {
      args.push('--quiet');
    }
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
      this.handleReceive(data.toString());
    });
  }

  stop(): void {
    if (this.process !== null) this.process.kill();
  }

  isAlive(): boolean {
    return this.process !== null && !this.process.killed;
  }

  send(data: unknown): boolean {
    if (!this.isAlive()) return false;
    const j = JSON.stringify(data);
    this.writeChildProcess(j);
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
