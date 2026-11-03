import { ILauncherClient } from '../launcher/launcher-client-interface';
import { RunSingleTaskRequest } from '../../interfaces/query-types';
import { TaskResult } from '../../interfaces/result-types';
import { ClientJobID } from '../../interfaces/id-types';
import { TaskFactory } from '../task/task-factory';
import { TaskInterface } from '../task/task-interface';

type ResultEmitterFunc = (data: TaskResult) => void;
type FinalizerFunc = () => void;

/** 1つのクライアントジョブに対応するタスク実行管理。タスクの開始・kill・結果通知を担当する */
export default class TaskRunner {
  private clientJobId: ClientJobID;
  private task: TaskInterface | null;
  private launcherClient: ILauncherClient;
  private resultEmitter: ResultEmitterFunc;
  private finalizer: FinalizerFunc;

  constructor(
    clientJobId: ClientJobID,
    launcherClient: ILauncherClient,
    resultEmitter: ResultEmitterFunc,
    finalizer: FinalizerFunc
  ) {
    this.clientJobId = clientJobId;
    this.task = null;
    this.launcherClient = launcherClient;
    this.resultEmitter = resultEmitter;
    this.finalizer = finalizer;
  }

  async start(
    taskFactory: TaskFactory,
    data: RunSingleTaskRequest
  ): Promise<void> {
    this.task = taskFactory.generate(
      this.launcherClient,
      (data: TaskResult) => {
        data.id = this.clientJobId;
        this.resultEmitter(data);
      },
      this.finalizer,
      data
    );
    if (!this.task) {
      const res: TaskResult = {
        id: this.clientJobId,
        success: false,
        summary: '(?)',
      };
      this.resultEmitter(res);
      this.finalizer();
      console.warn('unknown language: ', data.lang);
      return;
    }
    // startAsync が reject した場合でも finalizer を確実に呼ぶ。
    // NOTE: TaskRunTask は内部 try-finally で finalize を呼ぶため通常 reject しないが、
    // 他の TaskInterface 実装が finalize を呼ばずに reject した場合の安全策。
    try {
      await this.task.startAsync(data.info);
    } catch (e) {
      this.finalizer();
      throw e;
    }
  }

  kill(): void {
    this.task?.kill();
  }
}
