import {
  Result,
  SubResultBox,
  SubResultExec,
  Annotation,
} from '../../../lib/type';
import CallbackManager from '../../../lib/CallbackManager';

export type Runnable = () => void;
export type ResultEmitter = (data: any) => void;

export function asyncError(message: string): Promise<boolean> {
  return Promise.reject(new Error(message));
}

type Kits = {
  launcherCallbackManager: CallbackManager;
  resultEmitter: ResultEmitter;
};

export async function utilPhaseSetupBox(
  summaryLabel: string,
  kits: Kits
): Promise<string | null> {
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

  res_data.summary = `${summaryLabel}: ok`;
  kits.resultEmitter(res_data);
  return boxId;
}

export async function utilPhaseStoreFiles(
  summaryLabel: string,
  kits: Kits,
  boxId: string,
  files: Array<{ path: string; data: string }>
): Promise<void> {
  const res_data: Result = await kits.launcherCallbackManager.postp({
    method: 'store',
    box: boxId,
    files
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=store:', res_data.error);
    return await Promise.reject();
  }
  res_data.summary = `${summaryLabel}: ok`;
  kits.resultEmitter(res_data);
  return;
}

export async function utilPhaseExecute(
  summaryLabel: string,
  kits: Kits,
  boxId: string,
  setHandleKill: (f: (() => void) | null) => void,
  cmd: string,
  args: Array<string>,
  stdin: string,
  annotator: undefined | ((stderr: string) => Annotation[]),
  fileio: boolean
): Promise<SubResultExec> {
  return new Promise((resolve, reject) => {
    const caller = kits.launcherCallbackManager.multipost(
      (res_data: Result) => {
        // note: call this callback twice or more
        if (res_data.result && res_data.result.exited) {
          // execution complete
          const res = res_data.result as SubResultExec;
          setHandleKill(null);
          if (res_data.success) {
            res_data.summary = `${summaryLabel}: ok(${res.exitstatus})[${Math.floor(res.time * 1000) / 1000
              }s]`;
            if (annotator)
              (res_data.result as SubResultExec).annotations = annotator(
                res.err
              );
            kits.resultEmitter(res_data);
            resolve(res);
            return;
          } else {
            res_data.summary = `${summaryLabel}: error`;
            // note: NOT runtime error (it means rejected a bad query)
            console.error('launcher failed: method=exec ', res_data.error);
            kits.resultEmitter(res_data);
            reject();
            return;
          }
        }
        // execution inprogress
        res_data.summary = `${summaryLabel}: running`;
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
      });
    });
  });
}

export async function utilPhaseFinalize(
  _summaryLabel: string,
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
