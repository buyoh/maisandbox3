import CallbackManager from '../../../lib/CallbackManager';
import { TaskRuby } from './language/TaskRuby';
import { ResultEmitter, Runnable } from './TaskUtil';
import { TaskInterface } from './TaskInterface';
import { TaskCpp } from './language/TaskCpp';
import { TaskCLay } from './language/TaskCLay';

export class TaskFactory {
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
  }

  generate(lang: string): TaskInterface | null {
    if (lang === 'ruby')
      return new TaskRuby(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    if (lang === 'cpp')
      return new TaskCpp(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    if (lang === 'clay')
      return new TaskCLay(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    return null;
  }
}
