import CallbackManager from '../../../lib/CallbackManager';
import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseFinalize,
  utilPhasePullFiles,
  utilPhaseExecuteFileIO,
  mapFilesFromPullResult,
  createReportItemsFromExecResult,
} from '../TaskUtil';
import { QueryInitInfo, QueryInitInfoFileStdin } from '../../../lib/QueryTypes';
import { Annotation, Result } from '../../../lib/ResultTypes';
import { TaskInterface } from '../TaskInterface';
import { annotateSummaryDefault } from '../SummaryAnnotator';
import {
  LauncherResult,
  LauncherSubResultOfExec,
  LauncherSubResultOfPull,
} from '../../Launcher/LauncherType';

function annotateFromStderr(stderr: string): Annotation[] {
  if (!stderr) return [];
  const infos: Annotation[] = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^(?:\.\/)?code\.cpp:(\d+):(\d+): (\w+):/);
    if (m) {
      infos.push({
        text: line,
        row: +m[1] - 1,
        column: +m[2] - 1,
        type: m[3],
      });
    }
  }
  return infos;
}

function createReport(
  label: string,
  exec_result: LauncherSubResultOfExec,
  pull_result: LauncherSubResultOfPull,
  stdout_path: string,
  stderr_path: string,
  annotate: boolean,
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
  if (annotate)
    details.push({
      type: 'annotation',
      annotations: annotateFromStderr(stderr_data.data),
    });
  return {
    success: true,
    summary: `report(${label})`,
    continue: !isFinal,
    details,
  } as Result;
}

export class TaskCpp implements TaskInterface {
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
    const defaultKits = (label: string) => {
      return {
        launcherCallbackManager: this.launcherCallbackManager,
        resultEmitter: (data: LauncherResult) => {
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
      boxId = await utilPhaseSetupBox(defaultKits('setup'));
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles(defaultKits('store'), boxId, [
        { path: 'code.cpp', data: info.code },
        { path: 'stdin.txt', data: info.stdin },
      ]);

      {
        const build_result = await utilPhaseExecuteFileIO(
          defaultKits('build'),
          boxId,
          (hk: Runnable | null) => {
            this.handleKill = hk;
          },
          'g++',
          [
            '-std=c++17',
            '-O3',
            '-Wall',
            '-I',
            '/opt/ac-library',
            '-o',
            'prog',
            './code.cpp',
          ],
          null,
          './stdout.txt',
          './stderr.txt'
        );

        const pull_build_result = await utilPhasePullFiles(
          defaultKits('pull'),
          boxId,
          [{ path: './stdout.txt' }, { path: './stderr.txt' }]
        );
        {
          const res = createReport(
            'build',
            build_result,
            pull_build_result,
            './stdout.txt',
            './stderr.txt',
            false,
            isFinal
          );
          if (res) this.resultEmitter(res);
        }
        // goto finally if compile error occurs
        if (build_result.exitstatus !== 0) return;
      }
      {
        const exec_result = await utilPhaseExecuteFileIO(
          defaultKits('exec'),
          boxId,
          (hk: Runnable | null) => {
            this.handleKill = hk;
          },
          './prog',
          [],
          './stdin.txt',
          './stdout.txt',
          './stderr.txt'
        );

        const pull_exec_result = await utilPhasePullFiles(
          defaultKits('pull'),
          boxId,
          [{ path: './stdout.txt' }, { path: './stderr.txt' }]
        );
        {
          const res = createReport(
            'run',
            exec_result,
            pull_exec_result,
            './stdout.txt',
            './stderr.txt',
            true,
            isFinal
          );
          if (res) this.resultEmitter(res);
        }
      }
    } catch (e) {
      console.error('task failed', e);
    } finally {
      isFinal = true;
      try {
        await utilPhaseFinalize(defaultKits('finalize'), boxId);
      } catch (e) {
        console.error('launcher finalize failed', e);
      } finally {
        this.finalize();
      }
    }
  }
}

// const res_cmp = await utilPhaseExecute(
//   kits('compile'),
//   boxId,
//   (hk) => {
//     this.handleKill = hk;
//   },
//   'g++',
//   [
//     '-std=c++17',
//     '-O3',
//     '-Wall',
//     '-I',
//     '/opt/ac-library',
//     '-o',
//     'prog',
//     './code.cpp',
//   ],
//   ''
// );
