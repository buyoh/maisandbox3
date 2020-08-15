import CallbackManager from '../../../lib/CallbackManager';
import { ResultEmitter, Runnable } from './TaskUtil';
import { QueryData, Result, WorkID, JobID, SubResultExec, SubResultBox } from '../../../lib/type';

export class TaskCpp {

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
      console.error('launcher failed: method=setupbox:', res_data.error);
      return await Promise.reject();
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
      { method: 'store', box: this.boxId, files: [{ path: 'code.cpp', data: data.code }], id: { jid, sid: this.socketId } });
    res_data.id = (res_data.id as WorkID).jid;
    if (!res_data.success) {
      this.resultEmitter(res_data);
      console.error('launcher failed: method=store:', res_data.error);
      return await Promise.reject();
    }
    res_data.continue = true;
    res_data.summary = 'store: ok';
    this.resultEmitter(res_data);
    return true;
  }

  private phase3(data: QueryData, jid: JobID): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.launcherCallbackManager.post(
        { method: 'exec', box: this.boxId, cmd: 'g++', args: ['-std=c++17', '-O3', '-Wall', '-o', 'prog', 'code.cpp'], stdin: data.stdin, id: { jid, sid: this.socketId } },
        (res_data: Result) => {
          // note: call this callback twice or more
          res_data.id = (res_data.id as WorkID).jid;
          if (!res_data.success) {
            this.resultEmitter(res_data);
            console.error('launcher failed: method=compile:', res_data.error);
            return reject();
          }
          const res = res_data.result as SubResultExec;
          if (res.exited) {
            if (res.exitstatus === 0) {
              res_data.continue = true;
              res_data.summary = 'compile: ok';
              this.resultEmitter(res_data);
              return resolve(true);
            } else {
              res_data.summary = `compile: failed(${res.exitstatus})`;
              this.resultEmitter(res_data);
              return resolve(false);
            }
          }
          res_data.summary = 'compile: running';
          this.resultEmitter(res_data);
          return;
          // 1コマンド実行するだけでも4パターンのハンドリングが必要…
          // 1. Launcher側のエラー
          // 2. 実行失敗時(exitstatus!=0)
          // 3. 実行成功時(exitstatus==0)
          // 4. それ以外(inprogress)
        });
    });

  }

  private phase4(data: QueryData, jid: JobID): Promise<boolean> {
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
              res_data.summary = `run: ok(${res.exitstatus})`;
              resolve(true);
            } else {
              res_data.summary = 'run: error';
              // note: NOT runtime error (it means rejected a bad query)
              console.error('launcher failed: method=exec ', res_data.error);
              reject();
            }
          }
          else {
            res_data.summary = 'run: running';
          }
          this.resultEmitter(res_data);
        });
      caller.call(null,
        { method: 'exec', box: this.boxId, cmd: './prog', args: [], stdin: data.stdin, id: { jid, sid: this.socketId } }
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
        && await this.phase3(data, jid)
        && await this.phase4(data, jid);
    } catch (e) {
      console.error('task failed', e);
      this.finalize();
    }
  }
}