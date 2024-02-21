import CallbackManager from '../../lib/CallbackManager';
import { TaskRuby } from './FileStdinTask/TaskRuby';
import { ResultEmitter, Runnable } from './TaskUtil';
import { TaskInterface } from './TaskInterface';
import { TaskCpp } from './FileStdinTask/TaskCpp';
import { TaskCLay } from './FileStdinTask/TaskCLay';
import { QueryInit } from '../../interfaces/QueryTypes';

export class TaskFactory {
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;

  constructor(
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitter,
    finalize: Runnable
  ) {
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
  }

  generate(query: QueryInit): TaskInterface | null {
    if (query.lang === 'ruby')
      return new TaskRuby(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    if (query.lang === 'cpp')
      return new TaskCpp(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    if (query.lang === 'clay')
      return new TaskCLay(
        this.launcherCallbackManager,
        this.resultEmitter,
        this.finalize
      );
    return null;
  }
}
