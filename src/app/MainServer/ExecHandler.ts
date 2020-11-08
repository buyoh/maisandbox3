import CallbackManager from '../../lib/CallbackManager';
import { TaskFactory } from './task/TaskFactory';
import { Query, Result } from '../../lib/type';
import { TaskInterface } from './task/TaskInterface';

type ExecHandlerState = {
  tasks: { [key: string]: TaskInterface };
};

// ExecHandler
// SocketIOのconnection単位（ブラウザタブ単位）で生成される。
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
    // note: query.id は client に返す場合と、
    // ExecHandler 内での Task 判定の場合のみに必要
    const jobIdStr = JSON.stringify(query.id);
    const data = query.data;
    console.log(query.id, this.socketId);
    if (data.action == 'run') {
      const factory = new TaskFactory(
        this.launcherCallbackManager,
        (data: any) => {
          data.id = query.id; // clientに結果を返す際に必要となる識別子をここで挿入
          resultEmitter(data);
        },
        () => {
          // finalize
          delete this.socketHandlerStorage.tasks[jobIdStr];
        }
      );
      const task = factory.generate(data.lang);
      if (!task) {
        const res: Result = {
          success: false,
        };
        resultEmitter(res);
        console.warn('unknown language: ', data.lang);
        return;
      }
      this.socketHandlerStorage.tasks[jobIdStr] = task;
      task.startAsync(data);
    } else if (data.action == 'kill') {
      const task = this.socketHandlerStorage.tasks[jobIdStr];
      if (!task) return; // do nothing if jobIdStr is unknown
      task.kill();
    }
  }
}
