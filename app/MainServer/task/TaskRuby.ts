import CallbackManager from "../../lib/launcher/CallbackManager";
import { ResultEmitter, Runnable } from "./TaskUtil";

export class TaskRuby {

  private socketId: string;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill: Runnable;

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

  async startAsync(data: any, jid: any) {

    const res_data1 = await this.launcherCallbackManager.postp(
      { method: 'store', files: [{ path: 'var/code.rb', data: data.code }] });

    if (!res_data1.success) {
      console.error('launcher failed: method=store: ', res_data1.error);
      this.resultEmitter(res_data1);
      return;
    }
    const caller = this.launcherCallbackManager.multipost(
      (res_data2) => {
        // note: may call this callback twice or more
        const sid = res_data2.id.sid;
        if (sid !== this.socketId) return;  // may not happen
        res_data2.id = res_data2.id.jid;

        if (res_data2.result && res_data2.result.exited) {
          // finish!
          // delete this.socketStorage.postKill[jidStr];
          this.finalize();
          if (!res_data2.success) {
            // note: NOT runtime error (it means rejected query)
            console.error('launcher failed: method=exec: ', res_data2.error);
            this.resultEmitter(res_data2);
            return;
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
  }
}