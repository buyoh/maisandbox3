import CallbackManager from '../../lib/CallbackManager';
import { Query } from '../../lib/type';
import { TaskRunner } from './TaskRunner';

type QueryParserState = {
  // TODO: split to TaskRunnerManager
  tasks: { [key: string]: TaskRunner };
};

// QueryParser
// SocketIOのconnection単位（ブラウザタブ単位）で生成される。
export class QueryParser {
  private socketHandlerStorage: QueryParserState;
  private socketId: string;
  private launcherCallbackManager: CallbackManager;

  constructor(socketId: string, launcherCallbackManager: CallbackManager) {
    this.socketId = socketId;
    this.socketHandlerStorage = { tasks: {} };
    this.launcherCallbackManager = launcherCallbackManager;
  }

  handle(query: Query, resultEmitter: (data: any) => void): void {
    // note: query.id は client に返す場合と、
    // QueryParser 内での Task 判定の場合のみに必要
    if (!query.id) {
      // can't report to client.
      resultEmitter({ success: false });
      return;
    }

    const jobIdStr = JSON.stringify(query.id);
    const data = query.data;
    const taskRunner = this.socketHandlerStorage.tasks[jobIdStr];

    if (data.action == 'run') {
      const newTaskRunner = new TaskRunner(
        query.id,
        this.launcherCallbackManager,
        resultEmitter,
        () => {
          delete this.socketHandlerStorage.tasks[jobIdStr];
        }
      );
      this.socketHandlerStorage.tasks[jobIdStr] = newTaskRunner;
      newTaskRunner.run(data);
    } else if (data.action == 'kill') {
      if (!taskRunner) {
        resultEmitter({ id: query.id, success: false });
        return;
      }
      taskRunner.kill();
    }
  }
}
