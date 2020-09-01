import { QueryData, JobID, Result, WorkID, SubResultBox, SubResultExec } from '../../../lib/type';
import CallbackManager from '../../../lib/CallbackManager';

export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export interface Task {
  kill(): void;
  startAsync(data: QueryData, jid: any): Promise<any>;
}

export function asyncError(message: string): Promise<boolean> {
  return Promise.reject(new Error(message));
}

type Kits = { socketId: string, launcherCallbackManager: CallbackManager, resultEmitter: ResultEmitter };

export async function utilPhaseSetupBox(
  jid: JobID,
  kits: Kits,
  continu: boolean)
  : Promise<string | null> {

  const res_data: Result = await kits.launcherCallbackManager.postp(
    { method: 'setupbox', id: { jid, sid: kits.socketId } });
  res_data.id = (res_data.id as WorkID).jid;
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=setupbox:', res_data.error);
    return await Promise.reject();
  }
  // store result of setupbox
  const result = res_data.result as SubResultBox;
  const boxId = result.box || null;

  // launcherからの応答はこれ以上続かないのでres_data.continue = falseだが、
  // phase2移行の為、trueを指定する。
  res_data.continue = continu;
  res_data.summary = 'setup: ok';
  kits.resultEmitter(res_data);
  return boxId;
}

export async function utilPhaseStoreFiles(
  jid: JobID,
  kits: Kits,
  boxId: string,
  files: Array<{ path: string, data: string }>,
  continu: boolean)
  : Promise<void> {

  const res_data: Result = await kits.launcherCallbackManager.postp(
    { method: 'store', box: boxId, files, id: { jid, sid: kits.socketId } });
  res_data.id = (res_data.id as WorkID).jid;
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=store:', res_data.error);
    return await Promise.reject();
  }
  res_data.continue = continu;
  res_data.summary = 'store: ok';
  kits.resultEmitter(res_data);
  return;
}

export async function utilPhaseExecute(
  jid: JobID,
  kits: Kits,
  boxId: string,
  setHandleKill: (f: (() => void) | null) => void,
  cmd: string,
  args: Array<string>,
  stdin: string,
  fileio: boolean,
  continu: boolean): Promise<SubResultExec> {

  return new Promise((resolve, reject) => {
    const caller = kits.launcherCallbackManager.multipost(
      (res_data: Result) => {
        // note: call this callback twice or more
        res_data.id = (res_data.id as WorkID).jid;
        if (res_data.result && res_data.result.exited) {
          // execution complete
          const res = res_data.result as SubResultExec;
          setHandleKill(null);
          if (res_data.success) {
            res_data.summary = `run: ok(${res.exitstatus})[${Math.floor(res.time * 1000) / 1000}s]`;
            res_data.continue = continu;
            kits.resultEmitter(res_data);
            resolve(res);
            return;
          } else {
            res_data.summary = 'run: error';
            // note: NOT runtime error (it means rejected a bad query)
            console.error('launcher failed: method=exec ', res_data.error);
            kits.resultEmitter(res_data);
            reject();
            return;
          }
        }
        // execution inprogress
        res_data.summary = 'run: running';
        kits.resultEmitter(res_data);
        return;
      });
    caller.call(null,
      { method: 'exec', box: boxId, cmd, args, stdin, id: { jid, sid: kits.socketId }, fileio }
    );
    setHandleKill(() => {
      caller.call(null,
        { method: 'kill', box: boxId, id: { jid, sid: kits.socketId } }
      );
    });
  });
}