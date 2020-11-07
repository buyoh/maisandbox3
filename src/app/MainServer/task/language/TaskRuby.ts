import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseExecute,
  utilPhaseFinalize,
} from '../TaskUtil';
import { QueryData, Annotation } from '../../../../lib/type';
import { TaskInterface } from '../TaskInterface';
import CallbackManager from '../../../../lib/CallbackManager';

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
    const kits = {
      launcherCallbackManager: this.launcherCallbackManager,
      resultEmitter: (data: any) => {
        data.continue = !isFinal;
        this.resultEmitter(data);
      },
    };
    let boxId: string | null = null;
    try {
      boxId = await utilPhaseSetupBox('setup', kits);
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles('store', kits, boxId, [
        { path: 'code.rb', data: data.code },
      ]);

      await utilPhaseExecute(
        'run',
        kits,
        boxId,
        (hk) => {
          this.handleKill = hk;
        },
        'ruby',
        ['./code.rb'],
        data.stdin,
        annotateFromStderr,
        true
      );
    } catch (e) {
      console.error(e);
    } finally {
      isFinal = true;
      await utilPhaseFinalize('finalize', kits, boxId);
      this.finalize();
    }
  }
}
