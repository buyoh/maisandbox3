import { CallbackManager } from '../../lib/CallbackManager';
import { ClientJobID, QueryInit, Result } from '../../lib/type';
import { TaskFactory } from '../Task/TaskFactory';
import { TaskInterface } from '../Task/TaskInterface';

type ResultEmitterFunc = (data: any) => void;
type FinalizerFunc = () => void;

export class TaskRunner {
  private clientJobId: ClientJobID;
  private task: TaskInterface | null;
  private launcherCallbackManager: CallbackManager;
  private resultEmitter: ResultEmitterFunc;
  private finalizer: FinalizerFunc;

  constructor(
    clientJobId: ClientJobID,
    launcherCallbackManager: CallbackManager,
    resultEmitter: ResultEmitterFunc,
    finalizer: FinalizerFunc
  ) {
    this.clientJobId = clientJobId;
    this.task = null;
    this.launcherCallbackManager = launcherCallbackManager;
    this.resultEmitter = resultEmitter;
    this.finalizer = finalizer;
  }

  init(data: QueryInit): void {
    const factory = new TaskFactory(
      this.launcherCallbackManager,
      (data: any) => {
        data.id = this.clientJobId; // clientに結果を返す際に必要となる識別子をここで挿入
        this.resultEmitter(data);
      },
      this.finalizer
    );
    this.task = factory.generate(data);
    if (!this.task) {
      // unknown language
      const res: Result = {
        id: this.clientJobId,
        success: false,
        summary: '(?)',
      };
      this.resultEmitter(res);
      this.finalizer();
      console.warn('unknown language: ', data.lang);
      return;
    }
    // TODO: data の持ち方を考える
    // 現状このデータをフィールドに保持する必要が無い
    // 以下を別関数に分離するためだけにdataを保持するかどうか
    this.task.startAsync(data);
  }

  kill(): void {
    this.task?.kill();
  }
}

export default TaskRunner;
