import { ILauncherClient } from '../launcher/launcher-client-interface';
import { TaskRunTask } from './task-run-task';
import { TaskRunTaskMulti } from './task-run-task-multi';
import { Runnable } from './task-util';
import { TaskInterface } from './task-interface';
import { RunSingleTaskRequest } from '../../interfaces/query-types';
import { TaskResult } from '../../interfaces/result-types';

// ----------------------------------------------------------------------------

/** ILauncherClient ベースの TaskFactory インターフェース */
export interface TaskFactory {
  /** リクエストに対応する TaskInterface を生成する。対応できない場合は null を返す */
  generate(
    launcherClient: ILauncherClient,
    resultEmitter: (data: TaskResult) => void,
    finalize: Runnable,
    query: RunSingleTaskRequest
  ): TaskInterface | null;
}

// ----------------------------------------------------------------------------

/** RunTask / RunTaskMulti を info.type でディスパッチする統合 TaskFactory */
export class TaskFactoryRunTask implements TaskFactory {
  generate(
    launcherClient: ILauncherClient,
    resultEmitter: (data: TaskResult) => void,
    finalize: Runnable,
    query: RunSingleTaskRequest
  ): TaskInterface | null {
    if (!query.lang) return null;

    switch (query.info.type) {
      case 'filestdin':
        return new TaskRunTask(
          launcherClient,
          resultEmitter,
          finalize,
          query.lang,
          undefined,
          query.options
        );
      case 'multistdin':
        return new TaskRunTaskMulti(
          launcherClient,
          resultEmitter,
          finalize,
          query.lang,
          query.info.code,
          query.info.stdinList,
          undefined,
          query.options
        );
      default:
        return null;
    }
  }
}
