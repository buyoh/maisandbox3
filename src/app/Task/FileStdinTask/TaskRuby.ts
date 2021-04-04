import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseFinalize,
  utilPhaseExecuteFileIO,
  utilPhasePullFiles,
  mapFilesFromPullResult,
  createReportItemsFromExecResult,
} from '../TaskUtil';
import { QueryInit, Annotation, Result } from '../../../lib/type';
import { TaskInterface } from '../TaskInterface';
import CallbackManager from '../../../lib/CallbackManager';
import { annotateSummaryDefault } from '../SummaryAnnotator';
import { LauncherResult, LauncherSubResultOfExec } from '../../Launcher/types';

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

  async startAsync(data: QueryInit): Promise<void> {
    let isFinal = false;
    const defaultKits = (label: string) => {
      return {
        launcherCallbackManager: this.launcherCallbackManager,
        resultEmitter: (data: LauncherResult) => {
          // TaskUtilからLauncherの結果を直接送らない。
          // 特にresultは送らない
          // 必要に応じてTask[Language]が直接送る。
          if (data.error) console.warn(label, data.error);
          const res: Result = {
            success: data.success,
            continue: !isFinal,
            // TODO: これはややこしい…Launcherの方のインターフェースを変える。
            running:
              data.result &&
              (data.result as LauncherSubResultOfExec).exited === false,
            summary: annotateSummaryDefault(data, label),
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
        { path: 'code.rb', data: data.info.code },
        { path: 'stdin.txt', data: data.info.stdin },
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
      const [stdout_data, stderr_data] = mapFilesFromPullResult(pull_result, [
        './stdout.txt',
        './stderr.txt',
      ]);
      if (stdout_data && stderr_data) {
        const details = createReportItemsFromExecResult(exec_result);
        details.push({
          type: 'out',
          text: stdout_data.data,
        });
        details.push({
          type: 'log',
          text: stderr_data.data,
        });
        details.push({
          type: 'annotation',
          annotations: annotateFromStderr(stderr_data.data),
        });
        const result = {
          success: true,
          summary: 'result(exec)',
          continue: !isFinal,
          details,
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
