import CallbackManager from '../../../lib/CallbackManager';
import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseFinalize,
  utilPhasePullFiles,
  utilPhaseExecuteFileIO,
} from '../TaskUtil';
import {
  QueryData,
  Annotation,
  Result,
  SubResultExec,
} from '../../../lib/type';
import { TaskInterface } from '../TaskInterface';
import { annotateSummaryDefault } from '../SummaryAnnotator';
import {
  LauncherResult,
  LauncherSubResultOfExec,
  LauncherSubResultOfPull,
} from '../../Launcher/types';

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
  exec_result: LauncherSubResultOfExec,
  pull_result: LauncherSubResultOfPull,
  stdout_path: string,
  stderr_path: string,
  isFinal: boolean
): Result | null {
  const stdout_data = pull_result.files.find((e) => e.path === stdout_path);
  const stderr_data = pull_result.files.find((e) => e.path === stderr_path);
  if (!stderr_data || !stdout_data) return null;
  return {
    success: true,
    summary: 'report: ok',
    continue: !isFinal,
    result: {
      exited: true,
      exitstatus: exec_result.exitstatus,
      time: exec_result.time,
      err: stderr_data.data,
      out: stdout_data.data,
      annotations: annotateFromStderr(stderr_data.data),
    } as SubResultExec,
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

  async startAsync(data: QueryData): Promise<void> {
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
            error: data.error,
          };
          this.resultEmitter(res); // 再帰になりかねないような…
        },
      };
    };
    let boxId: string | null = null;
    try {
      boxId = await utilPhaseSetupBox(defaultKits('setup'));
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles(defaultKits('store'), boxId, [
        { path: 'code.cpp', data: data.code },
        { path: 'stdin.txt', data: data.stdin },
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
            build_result,
            pull_build_result,
            './stdout.txt',
            './stderr.txt',
            isFinal
          );
          if (res) this.resultEmitter(res);
        }
        if (build_result.exitstatus !== 0) return; // goto finally
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
            exec_result,
            pull_exec_result,
            './stdout.txt',
            './stderr.txt',
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
