import { ClientJobID } from '../../interfaces/IDTypes';
import { TaskRunner } from './TaskRunner';

function keyFromClientJobID(clientJobId: ClientJobID) {
  return JSON.stringify(clientJobId);
}

// 1つのユーザによって生成された複数のTaskRunnerを管理する。
// ユーザとは、1つのconnectionあるいは1つのブラウザタブを指す。
// ユーザは、タスクを作成・制御しその結果を受け取る。
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
