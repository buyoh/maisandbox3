import ChildProcess from 'child_process';
import net from 'net';
import { runInThisContext } from 'vm';

const UseChildProcess = true;  // false
const UnixSocketPath = '/tmp/maisandbox3.sock';

export class LauncherSocket {

  private process: ChildProcess.ChildProcess;
  private netSocket: net.Socket;
  private bufferStdout: string;

  private callbacks: { close: Array<any>, recieve: Array<any> };  // close, recieve

  constructor() {
    this.process = null;
    this.netSocket = null;
    this.bufferStdout = '';
    this.callbacks = {
      close: [],
      recieve: []
    };
  }

  private handleClose(code, signal): void {
    for (let c of this.callbacks.close)
      c(code, signal);
  }

  private handleRecieve(str: string): void {
    const li = str.split("\n");
    if (li.length === 1) {
      // no breaks
      this.bufferStdout += li[0];
    }
    else {
      const head = li.shift();
      this.handleRecieveLine(this.bufferStdout + head);
      const tail = li.pop();
      this.bufferStdout = tail;
      for (let line of li) {
        this.handleRecieveLine(line);
      }
    }
  }

  private handleRecieveLine(line: string): void {
    let j = null;
    try {
      j = JSON.parse(line);
    }
    catch (e) {
      // TODO: rescue exception
      console.error("LauncherSocket.handleRecieveLine: failed parse json", e);
      return;
    }
    for (let c of this.callbacks['recieve'])
      c(j);
  }

  //

  private startChildProcess(): void {
    const p = ChildProcess.spawn('ruby', ['launcher/launcher.rb'], { stdio: ['pipe', 'pipe', 'inherit'] });
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
    if (this.process !== null)
      this.process.kill();
  }

  private isAliveChildProcess(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private writeChildProcess(str: string): void {
    this.process.stdin.write(str.trimEnd() + "\n", () => { /* flushed */ });
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
  }

  private stopSocket(): void {
    this.netSocket.end();
  }

  private isAliveSocket(): boolean {
    return this.netSocket !== null && !this.netSocket.destroyed;
  }

  private writeSocket(str: string): void {
    this.netSocket.write(str.trimEnd() + "\n", () => { /* flushed */ });
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

  send(data: Object): boolean {
    if (!this.isAlive())
      return false;
    const j = JSON.stringify(data);
    UseChildProcess ? this.writeChildProcess(j) : this.writeSocket(j);
    return true;
  }

  on(keyword: string, callback: (args) => void): void {
    if (!this.callbacks[keyword])
      return;
    this.callbacks[keyword].push(callback);
  }
}
