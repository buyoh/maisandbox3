import CallbackManager from '../../lib/CallbackManager';
import { ReportItem } from '../../lib/ResultTypes';
import {
  LauncherResult,
  LauncherSubResultOfExec,
  LauncherSubResultOfPull,
  LauncherSubResultOfSetupBox,
} from '../Launcher/LauncherType';

export type Runnable = () => void;
export type ResultEmitter = (data: LauncherResult) => void;

export function asyncError(message: string): Promise<boolean> {
  return Promise.reject(new Error(message));
}

type Kits = {
  launcherCallbackManager: CallbackManager;
  resultEmitter: ResultEmitter;
};

export function mapFilesFromPullResult(
  result: LauncherSubResultOfPull,
  filenames: string[]
): ({ path: string; data: string } | undefined)[] {
  return filenames.map((path) => result.files.find((e) => e.path === path));
}

export function createReportItemsFromExecResult(
  exec_result: LauncherSubResultOfExec
): ReportItem[] {
  const details = [] as ReportItem[];
  details.push({
    type: 'status',
    status: exec_result.exitstatus === 0 ? 'success' : 'warning',
  });
  details.push({
    type: 'param',
    key: 'time',
    value: exec_result.time,
  });
  details.push({
    type: 'param',
    key: 'exitstatus',
    value: exec_result.exitstatus,
  });
  return details;
}

export async function utilPhaseSetupBox(kits: Kits): Promise<string | null> {
  const res_data: LauncherResult = await kits.launcherCallbackManager.postp({
    method: 'setupbox',
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=setupbox:', res_data.error);
    return await Promise.reject();
  }
  // store result of setupbox
  const result = res_data.result as LauncherSubResultOfSetupBox;
  const boxId = result.box || null;
  // boxId must be hidden
  result.box = null;

  kits.resultEmitter(res_data);
  return boxId;
}

export async function utilPhaseStoreFiles(
  kits: Kits,
  boxId: string,
  files: Array<{ path: string; data: string }>
): Promise<void> {
  const res_data: LauncherResult = await kits.launcherCallbackManager.postp({
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

export async function utilPhasePullFiles(
  kits: Kits,
  boxId: string,
  files: Array<{ path: string }>
): Promise<LauncherSubResultOfPull> {
  const res_data: LauncherResult = await kits.launcherCallbackManager.postp({
    method: 'pull',
    box: boxId,
    files,
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=store:', res_data.error);
    return await Promise.reject();
  }
  kits.resultEmitter(res_data);
  // return res_data.result as LauncherSubResultOfPull;
  return (res_data as any) as LauncherSubResultOfPull; // TODO: Ruby 側の型が間違っている。取り敢えず動かすだけ。要修正。
}

export async function utilPhaseExecute(
  kits: Kits,
  boxId: string,
  setHandleKill: (f: (() => void) | null) => void,
  cmd: string,
  args: Array<string>,
  stdin: string
): Promise<LauncherSubResultOfExec> {
  return new Promise((resolve, reject) => {
    let taskId = undefined as string | undefined;
    const callback = (res_data: LauncherResult) => {
      // note: call this callback twice or more
      if (
        res_data.result &&
        (res_data.result as LauncherSubResultOfExec).exited
      ) {
        // execution complete
        const res = res_data.result as LauncherSubResultOfExec;
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
    };
    const caller = kits.launcherCallbackManager.multipost(callback);
    caller.call(null, {
      method: 'exec',
      box: boxId,
      cmd,
      args,
      stdin,
      // timeout
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

export async function utilPhaseExecuteFileIO(
  kits: Kits,
  boxId: string,
  setHandleKill: (f: (() => void) | null) => void,
  cmd: string,
  args: Array<string>,
  stdin_path: string | null,
  stdout_path: string | null,
  stderr_path: string | null
): Promise<LauncherSubResultOfExec> {
  return new Promise((resolve, reject) => {
    let taskId = undefined as string | undefined;
    const callback = (res_data: LauncherResult) => {
      // note: call this callback twice or more
      if (
        res_data.result &&
        (res_data.result as LauncherSubResultOfExec).exited
      ) {
        // execution complete
        const res = res_data.result as LauncherSubResultOfExec;
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
    };
    const caller = kits.launcherCallbackManager.multipost(callback);
    caller.call(null, {
      method: 'execfileio',
      box: boxId,
      cmd,
      args,
      stdin_path,
      stdout_path,
      stderr_path,
      // timeout,
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
  const res_data: LauncherResult = await kits.launcherCallbackManager.postp({
    method: 'cleanupbox',
    box: boxId,
  });
  if (!res_data.success) {
    kits.resultEmitter(res_data);
    console.error('launcher failed: method=cleanupbox:', res_data.error);
    return await Promise.reject();
  }
  kits.resultEmitter(res_data);
  return;
}
