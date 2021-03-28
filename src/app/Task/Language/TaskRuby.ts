import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseFinalize,
  utilPhaseExecuteFileIO,
  utilPhasePullFiles,
} from '../TaskUtil';
import {
  QueryData,
  Annotation,
  Result,
  SubResultExec,
} from '../../../lib/type';
import { TaskInterface } from '../TaskInterface';
import CallbackManager from '../../../lib/CallbackManager';
import { annotateSummaryDefault } from '../SummaryAnnotator';
import { LauncherResult } from '../../Launcher/types';

function annotateFromStderr(stderr: string): Annotation[] {
  if (!stderr) return [];
  const infos = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^(?:\.\/)?code\.rb:(\d+):/);
    if (m) {
      infos.push({
        text: line,
        row: +m[1] - 1,
        column: 0,
        type: 'error',
      });
    }
  }
  return infos;
}

export class TaskRuby implements TaskInterface {
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
          // TaskUtilからLauncherの結果を直接送らない。
          // 特にresultは送らない
          // 必要に応じてTask[Language]が直接送る。
          const res: Result = {
            success: data.success,
            summary: annotateSummaryDefault(data, label),
            continue: !isFinal,
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
        { path: 'code.rb', data: data.code },
        { path: 'stdin.txt', data: data.stdin },
      ]);

      const exec_result = await utilPhaseExecuteFileIO(
        defaultKits('exec'),
        boxId,
        (hk: Runnable | null) => {
          this.handleKill = hk;
        },
        'ruby',
        ['./code.rb'],
        './stdin.txt',
        './stdout.txt',
        './stderr.txt'
      );

      const pull_result = await utilPhasePullFiles(defaultKits('pull'), boxId, [
        { path: './stdout.txt' },
        { path: './stderr.txt' },
      ]);
      const stdout_data = pull_result.files.find(
        (e) => e.path === './stdout.txt'
      );
      const stderr_data = pull_result.files.find(
        (e) => e.path === './stderr.txt'
      );
      if (stdout_data && stderr_data) {
        // TODO: runの型を使いまわしている。結果を返すための型を用意する。
        const result = {
          success: true,
          summary: 'report ok',
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
        this.resultEmitter(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      isFinal = true;
      await utilPhaseFinalize(defaultKits('finalize'), boxId);
      this.finalize();
    }
  }
}
