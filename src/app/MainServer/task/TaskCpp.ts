import CallbackManager from '../../../lib/CallbackManager';
import {
  ResultEmitter,
  Runnable,
  utilPhaseSetupBox,
  utilPhaseStoreFiles,
  utilPhaseExecute,
  utilPhaseFinalize,
} from './TaskUtil';
import { QueryData, JobID, Annotation } from '../../../lib/type';

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

export class TaskCpp {
  private socketId: string;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill: Runnable | null;

  constructor(
    socketId: string,
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitter,
    finalize: Runnable
  ) {
    this.socketId = socketId;
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.handleKill = null;
    this.kill = this.kill.bind(this);
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  async startAsync(data: QueryData, jid: JobID): Promise<void> {
    let isFinal = false;
    const kits = {
      socketId: this.socketId,
      launcherCallbackManager: this.launcherCallbackManager,
      resultEmitter: (data: any) => {
        data.continue = !isFinal;
        this.resultEmitter(data);
      },
    };
    let boxId: string | null = null;
    try {
      boxId = await utilPhaseSetupBox('setup', jid, kits);
      if (boxId === null) throw Error('recieved null boxId');

      await utilPhaseStoreFiles('store', jid, kits, boxId, [
        { path: 'code.cpp', data: data.code },
      ]);

      const res_cmp = await utilPhaseExecute(
        'compile',
        jid,
        kits,
        boxId,
        (hk) => {
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
        '',
        annotateFromStderr,
        true
      );

      if (res_cmp.exitstatus === 0) {
        await utilPhaseExecute(
          'run',
          jid,
          kits,
          boxId,
          (hk) => {
            this.handleKill = hk;
          },
          './prog',
          [],
          data.stdin,
          undefined,
          true
        );
      }
    } catch (e) {
      console.error('task failed', e);
    } finally {
      isFinal = true;
      try {
        await utilPhaseFinalize('finalize', jid, kits, boxId);
      } catch (e) {
        console.error('launcher finalize failed', e);
      } finally {
        this.finalize();
      }
    }
  }
}
