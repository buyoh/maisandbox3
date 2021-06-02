import CallbackManager from '../../../lib/CallbackManager';
import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseExecute,
  utilPhaseFinalize,
  mapFilesFromPullResult,
  createReportItemsFromExecResult,
  utilPhaseExecuteFileIO,
  utilPhasePullFiles,
} from '../TaskUtil';
import { QueryInitInfo, QueryInitInfoFileStdin } from '../../../lib/QueryTypes';
import { Result } from '../../../lib/ResultTypes';
import { TaskInterface } from '../TaskInterface';
import { annotateSummaryDefault } from '../SummaryAnnotator';
import {
  LauncherSubResultOfExec,
  LauncherSubResultOfPull,
} from '../../Launcher/LauncherType';

function createReport(
  label: string,
  exec_result: LauncherSubResultOfExec,
  pull_result: LauncherSubResultOfPull,
  stdout_path: string,
  stderr_path: string,
  isFinal: boolean
): Result | null {
  const [stdout_data, stderr_data] = mapFilesFromPullResult(pull_result, [
    stdout_path,
    stderr_path,
  ]);
  if (!stderr_data || !stdout_data) return null;
  const details = createReportItemsFromExecResult(exec_result);
  details.push({
    type: 'out',
    text: stdout_data.data,
  });
  details.push({
    type: 'log',
    text: stderr_data.data,
  });
  return {
    success: true,
    summary: `report(${label})`,
    continue: !isFinal,
    details,
  } as Result;
}

export class TaskCLay implements TaskInterface {
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill: Runnable | null;

  constructor(
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitter,
    finalize: Runnable
  ) {
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.handleKill = null;
    this.kill = this.kill.bind(this);
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  async startAsync(infog: QueryInitInfo): Promise<void> {
    const info = infog as QueryInitInfoFileStdin;
    let isFinal = false;
    const kits = (label: string) => {
      return {
        launcherCallbackManager: this.launcherCallbackManager,
        resultEmitter: (data: any) => {
          const res: Result = {
            success: data.success,
            continue: !isFinal,
            // TODO: これはややこしい…Launcherの方のインターフェースを変える。
            running:
              data.result &&
              (data.result as LauncherSubResultOfExec).exited === false,
            summary: annotateSummaryDefault(data, label),
          };
          this.resultEmitter(res);
        },
      };
    };
    let boxId: string | null = null;
    try {
      boxId = await utilPhaseSetupBox(kits('setup'));
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles(kits('store'), boxId, [
        { path: 'code.cpp', data: info.code },
        { path: 'stdin.txt', data: info.stdin },
      ]);

      const transpile_result = await utilPhaseExecute(
        kits('transpile'),
        boxId,
        (hk: Runnable | null) => {
          this.handleKill = hk;
        },
        'clay < code.cpp > out.cpp',
        [],
        ''
      );
      {
        const details = createReportItemsFromExecResult(transpile_result);
        details.push({
          type: 'log',
          text: transpile_result.err || '',
        });
        const result = {
          success: true,
          summary: 'result(clay)',
          continue: !isFinal,
          details,
        } as Result;
        this.resultEmitter(result);
      }
      // goto finally if compile error occurs
      if (transpile_result.exitstatus !== 0) return;

      const build_result = await utilPhaseExecuteFileIO(
        kits('compile'),
        boxId,
        (hk: Runnable | null) => {
          this.handleKill = hk;
        },
        'g++',
        ['-std=c++14', '-O3', '-o', 'prog', './out.cpp'],
        null,
        './stdout.txt',
        './stderr.txt'
      );
      const pull_build_result = await utilPhasePullFiles(kits('pull'), boxId, [
        { path: './stdout.txt' },
        { path: './stderr.txt' },
      ]);
      {
        const res = createReport(
          'build',
          build_result,
          pull_build_result,
          './stdout.txt',
          './stderr.txt',
          isFinal
        );
        if (res) this.resultEmitter(res);
      }
      // goto finally if compile error occurs
      if (build_result.exitstatus !== 0) return;

      const run_result = await utilPhaseExecuteFileIO(
        kits('run'),
        boxId,
        (hk) => {
          this.handleKill = hk;
        },
        './prog',
        [],
        './stdin.txt',
        './stdout.txt',
        './stderr.txt'
      );

      const pull_run_result = await utilPhasePullFiles(kits('pull'), boxId, [
        { path: './stdout.txt' },
        { path: './stderr.txt' },
      ]);
      {
        const res = createReport(
          'build',
          run_result,
          pull_run_result,
          './stdout.txt',
          './stderr.txt',
          isFinal
        );
        if (res) this.resultEmitter(res);
      }
    } catch (e) {
      console.error('task failed', e);
    } finally {
      isFinal = true;
      try {
        await utilPhaseFinalize(kits('finalize'), boxId);
      } catch (e) {
        console.error('launcher finalize failed', e);
      } finally {
        this.finalize();
      }
    }
  }
}
