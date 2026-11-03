import { ClientJobID } from '../../interfaces/id-types';
import TaskRunner from './task-runner';

function keyFromClientJobID(clientJobId: ClientJobID) {
  return JSON.stringify(clientJobId);
}

/**
 * 1つのユーザ（接続/ブラウザタブ）が生成した複数の TaskRunner を管理する。
 * タスクの登録・解除・一括停止を提供する。
 */
export class TaskRunnerManager {
  private tasks: { [key: string]: TaskRunner };

  constructor() {
    this.tasks = {};
  }

  /** TaskRunner を登録する */
  register(id: ClientJobID, task: TaskRunner): void {
    const key = keyFromClientJobID(id);
    this.tasks[key] = task;
  }

  /** 指定 ID の TaskRunner を登録解除する */
  unregister(id: ClientJobID): void {
    const key = keyFromClientJobID(id);
    delete this.tasks[key];
  }

  /** 指定 ID の TaskRunner を取得する。未登録の場合は undefined */
  getTaskRunner(id: ClientJobID): TaskRunner | undefined {
    const key = keyFromClientJobID(id);
    return this.tasks[key];
  }

  /** 全 TaskRunner を停止し、登録をクリアする */
  cleanup(): void {
    for (const task of Object.values(this.tasks)) {
      task.kill();
    }
    this.tasks = {};
  }
}

export default TaskRunnerManager;
