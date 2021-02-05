import ChildProcess from 'child_process';
import Config from '../../lib/Config';
import {
  CallbackClose,
  CallbackRecieve,
  ISocket,
} from './LauncherSocketInterface';

export class ChildProcessLauncherSocket implements ISocket {
  private process: ChildProcess.ChildProcess | null;
  private bufferStdout: string;

  private callbacks: {
    close: Array<CallbackClose>;
    recieve: Array<CallbackRecieve>;
  }; // close, recieve

  constructor() {
    this.process = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      recieve: [],
    };
  }

  private handleClose(
    code: number | null,
    signal: NodeJS.Signals | null
  ): void {
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

  private writeChildProcess(str: string): void {
    this.process?.stdin?.write(str.trimEnd() + '\n', () => {
      /* flushed */
    });
  }

  //

  start(): void {
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

  onRecieve(callback: CallbackRecieve): void {
    this.callbacks['recieve'].push(callback);
  }
}
