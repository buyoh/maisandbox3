import CallbackManager from "../../lib/CallbackManager";
import { asyncError, ResultEmitter, Runnable } from "./TaskUtil";

export class TaskRuby {

  private socketId: string;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill?: Runnable;

  constructor(socketId: string, launcherCallbackManager: CallbackManager, resultEmitter: ResultEmitter, finalize: Runnable) {
    this.socketId = socketId;
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.handleKill = null;
    this.kill = this.kill.bind(this);
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  private async phase1(data: any, jid: any) {
    const res_data = await this.launcherCallbackManager.postp(
      { method: 'store', files: [{ path: 'var/code.rb', data: data.code }] });
    res_data.id = res_data.id.jid;
    if (!res_data.success) {
      this.resultEmitter(res_data);
      return await asyncError('launcher failed: method=store: ' + res_data.error);
    }
  }

  private phase2(data: any, jid: any) {
    return new Promise((resolve, reject) => {
      const caller = this.launcherCallbackManager.multipost(
        (res_data2) => {
          // note: call this callback twice or more
          res_data2.id = res_data2.id.jid;
          if (res_data2.result && res_data2.result.exited) {
            this.finalize();
            this.handleKill = null;
            if (res_data2.success) {
              resolve();
            } else {
              // note: NOT runtime error (it means rejected a bad query)
              console.error('launcher failed: method=exec: ', res_data2.error);
              reject();
            }
          }
          this.resultEmitter(res_data2);
        });
      caller.call(null,
        { method: 'exec', cmd: 'ruby', args: ['var/code.rb'], stdin: data.stdin, id: { jid, sid: this.socketId } }
      );
      this.handleKill = () => {
        caller.call(null,
          { method: 'kill', id: { jid, sid: this.socketId } }
        );
      };
    });
  }

  async startAsync(data: any, jid: any) {
    console.log('task start:' + jid);
    try {
      await this.phase1(data, jid);
      await this.phase2(data, jid);
    } catch (e) {
      console.error(e);
      this.finalize();
    }
    console.log('task complete:' + jid);
  }
}