import CallbackManager from '../../../lib/CallbackManager';
import { ResultEmitter, Runnable, utilPhaseSetupBox, utilPhaseStoreFiles, utilPhaseExecute } from './TaskUtil';
import { QueryData, JobID } from '../../../lib/type';

export class TaskRuby {

  private socketId: string;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private handleKill: Runnable | null;

  constructor(socketId: string, launcherCallbackManager: CallbackManager, resultEmitter: ResultEmitter, finalize: Runnable) {
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
    try {
      const kits = {
        socketId: this.socketId,
        launcherCallbackManager: this.launcherCallbackManager,
        resultEmitter: this.resultEmitter
      };

      const boxId = await utilPhaseSetupBox(jid, kits, true);
      if (boxId === null)
        throw Error('recieved null boxId');

      await utilPhaseStoreFiles(jid, kits, boxId, [{ path: 'code.rb', data: data.code }], true);

      await utilPhaseExecute(jid, kits, boxId, (hk) => { this.handleKill = hk; },
        'ruby', ['code.rb'], data.stdin, true, false);
    } catch (e) {
      console.error(e);
    } finally {
      this.finalize();
    }
  }
}