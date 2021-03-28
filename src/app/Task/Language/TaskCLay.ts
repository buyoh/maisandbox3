import CallbackManager from '../../../lib/CallbackManager';
import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseExecute,
  utilPhaseFinalize,
} from '../TaskUtil';
import { QueryData } from '../../../lib/type';
import { TaskInterface } from '../TaskInterface';
import {
  annotateSummaryExec,
  annotateSummaryDefault,
} from '../SummaryAnnotator';

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

  async startAsync(data: QueryData): Promise<void> {
    let isFinal = false;
    const kits = (label: string) => {
      return {
        launcherCallbackManager: this.launcherCallbackManager,
        resultEmitter: (data: any) => {
          data.summary = /exec/.test(label)
            ? annotateSummaryExec(data, label)
            : annotateSummaryDefault(data, label);
          data.continue = !isFinal;
          this.resultEmitter(data);
        },
      };
    };
    let boxId: string | null = null;
    try {
      boxId = await utilPhaseSetupBox(kits('setup'));
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles(kits('store'), boxId, [
        { path: 'code.cpp', data: data.code },
      ]);

      const res_tns = await utilPhaseExecute(
        kits('transpile'),
        boxId,
        (hk) => {
          this.handleKill = hk;
        },
        'clay < code.cpp > out.cpp',
        [],
        ''
      ); // TODO: refactor this
      if (res_tns.exitstatus !== 0) return;

      const res_cmp = await utilPhaseExecute(
        kits('compile'),
        boxId,
        (hk) => {
          this.handleKill = hk;
        },
        'g++',
        ['-std=c++14', '-O3', '-o', 'prog', './out.cpp'],
        ''
      );
      if (res_cmp.exitstatus !== 0) return;

      await utilPhaseExecute(
        kits('run'),
        boxId,
        (hk) => {
          this.handleKill = hk;
        },
        './prog',
        [],
        data.stdin
      );
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
