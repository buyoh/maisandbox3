import { ClientJobID, LauncherQueryID } from '../../lib/type';

// note: 現在の実装はCallbackManagerをそのままTaskまで渡すので、
// Actionは使う場所が無い

export interface LauncherSetupBoxAction {
  method: 'setupbox';
  id: LauncherQueryID;
}

export interface LauncherStoreAction {
  method: 'store';
  box: string;
  files: Array<{ path: string; data: string }>;
  id: LauncherQueryID;
}

export interface LauncherExecAction {
  method: 'exec';
  box: string;
  cmd: string;
  args: Array<string>;
  stdin: string;
  id: LauncherQueryID;
  fileio: boolean;
}

export interface LauncherKillAction {
  method: 'kill';
  box: string;
  id: LauncherQueryID;
}

export type LauncherAction =
  | LauncherSetupBoxAction
  | LauncherStoreAction
  | LauncherExecAction
  | LauncherKillAction;

// setupbox
// reporter.report({ success: true, result: { box: boxkey } })
// store
// reporter.report({ success: true })
// pull
// success: true, files: result_files
// kill
// { success: true, continue: true, result: { accepted: false } }
// exec
// { success: true, continue: true, taskid: exec_task_id,
//   result: { exited: false } }
// { success: true,
//   result: { exited: true, exitstatus: status &.exitstatus, time: time,
//  out: output, err: errlog }
// cleanupbox
// { success: true }

export interface LauncherSubResultOfPull {
  files: Array<{ path: string; data: string }>;
}

export interface LauncherSubResultOfSetupBox {
  box: string | null;
}

export interface LauncherSubResultOfExec {
  exited: boolean;
  err?: string;
  out?: string;
  exitstatus?: number;
  time?: number;
}

export interface LauncherResult {
  id?: ClientJobID;
  success: boolean;
  taskid?: string;
  result?:
    | LauncherSubResultOfPull
    | LauncherSubResultOfSetupBox
    | LauncherSubResultOfExec;
  error?: string;
}
