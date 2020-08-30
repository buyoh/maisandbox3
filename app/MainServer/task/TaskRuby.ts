import CallbackManager from '../../../lib/CallbackManager';
import { asyncError, ResultEmitter, Runnable } from './TaskUtil';
import { QueryData, Result, JobID, WorkID, SubResultBox, SubResultExec } from '../../../lib/type';

export class TaskRuby {

  private socketId: string;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill: Runnable | null;
  private boxId: string | null;

  constructor(socketId: string, launcherCallbackManager: CallbackManager, resultEmitter: ResultEmitter, finalize: Runnable) {
    this.socketId = socketId;
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.handleKill = null;
    this.kill = this.kill.bind(this);
    this.boxId = null;
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  private async phase1(data: QueryData, jid: JobID): Promise<boolean> {
    const res_data: Result = await this.launcherCallbackManager.postp(
      { method: 'setupbox', id: { jid, sid: this.socketId } });
    res_data.id = (res_data.id as WorkID).jid;
    if (!res_data.success) {
      this.resultEmitter(res_data);
      return await asyncError('launcher failed: method=setupbox: ' + res_data.error);
    }
    const result = res_data.result as SubResultBox;
    this.boxId = result.box || null;

    res_data.continue = true;
    res_data.summary = 'setup: ok';
    this.resultEmitter(res_data);
    return true;
  }

  private async phase2(data: QueryData, jid: JobID): Promise<boolean> {
    const res_data: Result = await this.launcherCallbackManager.postp(
      { method: 'store', box: this.boxId, files: [{ path: 'code.rb', data: data.code }], id: { jid, sid: this.socketId } });
    res_data.id = (res_data.id as WorkID).jid;
    if (!res_data.success) {
      this.resultEmitter(res_data);
      return await asyncError('launcher failed: method=store: ' + res_data.error);
    }
    res_data.continue = true;
    res_data.summary = 'store: ok';
    this.resultEmitter(res_data);
    return true;
  }

  private phase3(data: QueryData, jid: JobID): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const caller = this.launcherCallbackManager.multipost(
        (res_data: Result) => {
          // note: call this callback twice or more
          res_data.id = (res_data.id as WorkID).jid;
          if (res_data.result && res_data.result.exited) {
            const res = res_data.result as SubResultExec;
            this.finalize();
            this.handleKill = null;
            if (res_data.success) {
              res_data.summary = `run: ok(${res.exitstatus})[${Math.floor(res.time * 1000) / 1000}s]`;
              resolve(true);
            } else {
              res_data.summary = 'run: error';
              // note: NOT runtime error (it means rejected a bad query)
              console.error('launcher failed: method=exec: ', res_data.error);
              reject();
            }
          }
          else {
            res_data.summary = 'run: running';
          }
          this.resultEmitter(res_data);
        });
      caller.call(null,
        { method: 'exec', box: this.boxId, cmd: 'ruby', args: ['code.rb'], stdin: data.stdin, id: { jid, sid: this.socketId } }
      );
      this.handleKill = () => {
        caller.call(null,
          { method: 'kill', box: this.boxId, id: { jid, sid: this.socketId } }
        );
      };
    });
  }

  async startAsync(data: QueryData, jid: JobID): Promise<void> {
    try {
      await this.phase1(data, jid)
        && await this.phase2(data, jid)
        && await this.phase3(data, jid);
    } catch (e) {
      console.error(e);
      this.finalize();
    }
  }
}