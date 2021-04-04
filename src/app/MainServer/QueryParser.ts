import CallbackManager from '../../lib/CallbackManager';
import { Query } from '../../lib/type';
import { TaskRunner } from './TaskRunner';
import { TaskRunnerManager } from './TaskRunnerManager';

// QueryParser
// SocketIOのconnection単位（ブラウザタブ単位）で生成される。
export class QueryParser {
  private taskRunnerManager: TaskRunnerManager;
  private socketId: string; // note: 今は要らないけどユーザ識別の為いずれ必要になる
  private launcherCallbackManager: CallbackManager;

  constructor(
    socketId: string,
    taskRunnerManager: TaskRunnerManager,
    launcherCallbackManager: CallbackManager
  ) {
    this.socketId = socketId;
    this.taskRunnerManager = taskRunnerManager;
    this.launcherCallbackManager = launcherCallbackManager;
  }

  handle(query: Query, resultEmitter: (data: any) => void): void {
    const clientJobId = query.id;
    // note: query.id は client に返す場合と、
    // QueryParser 内での Task 判定の場合のみに必要
    if (!clientJobId) {
      // can't report to client.
      resultEmitter({ success: false });
      return;
    }

    const taskRunner = this.taskRunnerManager.getTaskRunner(clientJobId);

    if (query.action == 'init') {
      const newTaskRunner = new TaskRunner(
        clientJobId,
        this.launcherCallbackManager,
        resultEmitter,
        () => {
          this.taskRunnerManager.unregister(clientJobId);
        }
      );
      // registration must be before execution.
      this.taskRunnerManager.register(clientJobId, newTaskRunner);
      newTaskRunner.init(query);
    } else if (query.action == 'kill') {
      if (!taskRunner) {
        resultEmitter({ id: query.id, success: false });
        return;
      }
      taskRunner.kill();
    }
    // TODO: 実行中に情報を送信する action == 'send'
  }
}
