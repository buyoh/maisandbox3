import CallbackManager from '../../lib/CallbackManager';
import { TaskFactory } from './task/TaskFactory';
import { Query } from '../../lib/type';

type ExecHandlerState = {
  tasks: { [key: string]: any };
}

export class ExecHandler {

  private socketHandlerStorage: ExecHandlerState;
  private socketId: string;
  private launcherCallbackManager: CallbackManager;

  constructor(socketId: string, launcherCallbackManager: CallbackManager) {
    this.socketId = socketId;
    this.socketHandlerStorage = { tasks: {} };
    this.launcherCallbackManager = launcherCallbackManager;
  }

  handle(query: Query, resultEmitter: (data: any) => void): void {
    const jobIdStr = JSON.stringify(query.id);
    const data = query.data;
    if (data.action == 'run') {
      const factory = new TaskFactory(this.socketId, this.launcherCallbackManager, resultEmitter, () => {
        delete this.socketHandlerStorage.tasks[jobIdStr];
      });
      const task = factory.generate(data.lang);
      if (!task) {
        console.warn('unknown language: ', data.lang);
        return;
      }
      this.socketHandlerStorage.tasks[jobIdStr] = task;
      task.startAsync(data, query.id);
    }
    else if (data.action == 'kill') {
      const task = this.socketHandlerStorage.tasks[jobIdStr];
      if (!task) return;  // do nothing if jobIdStr is unknown
      task.kill();
    }

  }
}
