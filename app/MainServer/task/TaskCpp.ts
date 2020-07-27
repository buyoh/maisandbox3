import CallbackManager from "../../lib/CallbackManager";
import { asyncError, ResultEmitter, Runnable } from "./TaskUtil";
import { QueryData, Result, WorkID, JobID, SubResultExec } from "../../lib/type";

export class TaskCpp {

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

  private async phase1(data: QueryData, jid: JobID) {
    const res_data: Result = await this.launcherCallbackManager.postp(
      { method: 'store', files: [{ path: 'var/code.cpp', data: data.code }] });
    res_data.id = (res_data.id as WorkID).jid;
    if (!res_data.success) {
      this.resultEmitter(res_data);
      return await asyncError('launcher failed: method=store: ' + res_data.error);
    }
  }

  private async phase2(data: QueryData, jid: JobID) {
    return new Promise((resolve, reject) => {
      this.launcherCallbackManager.post(
        { method: 'exec', cmd: 'g++', args: ['-std=c++17', '-O3', '-Wall', '-o', 'var/code', 'var/code.cpp'], stdin: data.stdin, id: { jid, sid: this.socketId } },
        (res_data: Result) => {
          // note: call this callback twice or more
          res_data.id = (res_data.id as WorkID).jid;
          if (!res_data.success) {
            this.resultEmitter(res_data);
            return reject(asyncError('launcher failed: method=store: ' + res_data.error));
          }
          const res = res_data.result as SubResultExec;
          if (res.exited) {
            if (res.exitstatus === 0) {
              res_data.continue = true;
              this.resultEmitter(res_data);
              return resolve();
            }
            else {
              this.resultEmitter(res_data);
              return reject(asyncError('compile error'));
            }
          }
          return;
          // 1コマンド実行するだけでも4パターンのハンドリングが必要…
          // 1. Launcher側のエラー
          // 2. 実行失敗時(exitstatus!=0)
          // 3. 実行成功時(exitstatus==0)
          // 4. それ以外(inprogress)
        });
    });

  }

  private phase3(data: QueryData, jid: JobID) {
    return new Promise((resolve, reject) => {
      const caller = this.launcherCallbackManager.multipost(
        (res_data: Result) => {
          // note: call this callback twice or more
          res_data.id = (res_data.id as WorkID).jid;
          if (res_data.result && res_data.result.exited) {
            this.finalize();
            this.handleKill = null;
            if (res_data.success) {
              resolve();
            } else {
              // note: NOT runtime error (it means rejected a bad query)
              console.error('launcher failed: method=exec: ', res_data.error);
              reject();
            }
          }
          this.resultEmitter(res_data);
        });
      caller.call(null,
        { method: 'exec', cmd: 'var/code', args: [], stdin: data.stdin, id: { jid, sid: this.socketId } }
      );
      this.handleKill = () => {
        caller.call(null,
          { method: 'kill', id: { jid, sid: this.socketId } }
        );
      };
    });
  }

  async startAsync(data: QueryData, jid: JobID) {
    try {
      await this.phase1(data, jid);
      await this.phase2(data, jid);
      await this.phase3(data, jid);
    } catch (e) {
      console.error(e);  // include compile error...
      this.finalize();
    }
  }
}