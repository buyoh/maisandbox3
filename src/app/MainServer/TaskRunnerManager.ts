import { ClientJobID } from '../../lib/type';
import { TaskRunner } from './TaskRunner';

function keyFromClientJobID(clientJobId: ClientJobID) {
  return JSON.stringify(clientJobId);
}

// あるconnection（ブラウザタブ）によって生成されたTaskRunnerを管理する
// 全てのTaskRunnerは管理しない。
export class TaskRunnerManager {
  tasks: { [key: string]: TaskRunner };

  constructor() {
    this.tasks = {};
  }

  register(id: ClientJobID, task: TaskRunner): void {
    const key = keyFromClientJobID(id);
    this.tasks[key] = task;
  }

  unregister(id: ClientJobID): void {
    const key = keyFromClientJobID(id);
    delete this.tasks[key];
  }

  getTaskRunner(id: ClientJobID): TaskRunner | undefined {
    const key = keyFromClientJobID(id);
    return this.tasks[key];
  }

  cleanup(): void {
    for (const task of Object.values(this.tasks)) {
      task.kill();
    }
    this.tasks = {};
  }
}

export default TaskRunnerManager;
