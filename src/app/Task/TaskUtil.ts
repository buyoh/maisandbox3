import { Result, SubResultBox, SubResultExec } from '../../lib/type';
import CallbackManager from '../../lib/CallbackManager';

export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export function asyncError(message: string): Promise<boolean> {
  return Promise.reject(new Error(message));
}

type Kits = {
  launcherCallbackManager: CallbackManager;
  resultEmitter: ResultEmitter;
};

export async function utilPhaseSetupBox(kits: Kits): Promise<string | null> {
  const res_data: Result = await kits.launcherCallbackManager.postp({
    method: 'setupbox',
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=setupbox:', res_data.error);
    return await Promise.reject();
  }
  // store result of setupbox
  const result = res_data.result as SubResultBox;
  const boxId = result.box || null;

  kits.resultEmitter(res_data);
  return boxId;
}

export async function utilPhaseStoreFiles(
  kits: Kits,
  boxId: string,
  files: Array<{ path: string; data: string }>
): Promise<void> {
  const res_data: Result = await kits.launcherCallbackManager.postp({
    method: 'store',
    box: boxId,
    files,
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=store:', res_data.error);
    return await Promise.reject();
  }
  kits.resultEmitter(res_data);
  return;
}

export async function utilPhaseExecute(
  kits: Kits,
  boxId: string,
  setHandleKill: (f: (() => void) | null) => void,
  cmd: string,
  args: Array<string>,
  stdin: string,
  fileio: boolean
): Promise<SubResultExec> {
  return new Promise((resolve, reject) => {
    let taskId = undefined as string | undefined;
    const caller = kits.launcherCallbackManager.multipost(
      (res_data: Result) => {
        // note: call this callback twice or more
        if (res_data.result && res_data.result.exited) {
          // execution complete
          const res = res_data.result as SubResultExec;
          setHandleKill(null);
          if (res_data.success) {
            kits.resultEmitter(res_data);
            resolve(res);
          } else {
            // note: NOT runtime error (it means rejected a bad query)
            console.error('launcher failed: method=exec ', res_data.error);
            kits.resultEmitter(res_data);
            reject();
          }
          return;
        }
        taskId = res_data.taskid;
        // execution inprogress
        kits.resultEmitter(res_data);
        return;
      }
    );
    caller.call(null, {
      method: 'exec',
      box: boxId,
      cmd,
      args,
      stdin,
      fileio,
    });
    setHandleKill(() => {
      caller.call(null, {
        method: 'kill',
        box: boxId,
        taskid: taskId,
      });
    });
  });
}

export async function utilPhaseFinalize(
  kits: Kits,
  boxId: string | null
): Promise<void> {
  const res_data: Result = await kits.launcherCallbackManager.postp({
    method: 'cleanupbox',
    box: boxId,
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=cleanupbox:', res_data.error);
    return await Promise.reject();
  }
  res_data.summary = undefined;
  kits.resultEmitter(res_data);
  return;
}
