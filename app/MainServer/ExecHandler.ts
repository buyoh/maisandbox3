import CallbackManager from "../lib/launcher/CallbackManager";
import { TaskFactory } from "./task/TaskFactory";

type ExecHandlerState = {
  tasks: { [jid: string]: any };
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

  handle(data: any, jid: any, resultEmitter: (data: any) => void) {
    const jidStr = JSON.stringify(jid);

    if (data.action == 'run') {
      const factory = new TaskFactory(this.socketId, this.launcherCallbackManager, resultEmitter, () => {
        delete this.socketHandlerStorage.tasks[jidStr];
      });
      const task = factory.generate(data.lang);
      if (!task) {
        console.warn('unknown language: ', data.lang);
        return;
      }
      this.socketHandlerStorage.tasks[jidStr] = task;
      task.startAsync(data, jid);
    }
    else if (data.action == 'kill') {
      console.log("call kill");
      const task = this.socketHandlerStorage.tasks[jidStr];
      if (!task) return;  // do nothing if jid is unknown
      task.kill();
    }

  }
}
