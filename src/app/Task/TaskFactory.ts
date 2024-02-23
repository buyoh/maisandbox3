import CallbackManager from '../../lib/CallbackManager';
import { TaskRuby } from './FileStdinTask/TaskRuby';
import { ResultEmitter, Runnable } from './TaskUtil';
import { TaskInterface } from './TaskInterface';
import { TaskCpp } from './FileStdinTask/TaskCpp';
import { TaskCLay } from './FileStdinTask/TaskCLay';
import { QueryInit } from '../../interfaces/QueryTypes';

// ----------------------------------------------------------------------------

export interface TaskFactory {
  generate(
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitter,
    finalize: Runnable,
    query: QueryInit
  ): TaskInterface | null;
}

// ----------------------------------------------------------------------------

export class TaskFactoryImpl implements TaskFactory {
  generate(
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitter,
    finalize: Runnable,
    query: QueryInit
  ): TaskInterface | null {
    if (query.lang === 'ruby')
      return new TaskRuby(launcherCallbackManager, resultEmitter, finalize);
    if (query.lang === 'cpp')
      return new TaskCpp(launcherCallbackManager, resultEmitter, finalize);
    if (query.lang === 'clay')
      return new TaskCLay(launcherCallbackManager, resultEmitter, finalize);
    return null;
  }
}
