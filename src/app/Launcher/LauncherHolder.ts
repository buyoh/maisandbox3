import CallbackManager from '../../lib/CallbackManager';
import { ISocket } from './LauncherSocketInterface';

export default class LauncherHolder {
  private running: boolean;
  private restartMs: number;
  private launcherFactory: () => ISocket;
  private launcher: ISocket;
  private isRestartable: (
    code: number | null,
    signal: NodeJS.Signals | null
  ) => boolean;
  callbackManager: CallbackManager;

  private createLauncherSocket() {
    const launcher = this.launcherFactory();
    launcher.onClose((code: number | null, signal: NodeJS.Signals | null) => {
      if (!this.isRestartable(code, signal)) {
        return;
      }
      if (this.running)
        setTimeout(() => {
          this.triggerRestart();
        }, this.restartMs);
    });
    launcher.onReceive((data: any) => {
      this.callbackManager.handleReceive(data, !!data.continue);
    });
    return launcher;
  }

  private createCallbackManager() {
    return new CallbackManager((data) => {
      this.launcher.send(data);
    }, 'request_id');
  }

  constructor(
    restartMsec: number,
    isRestartable: LauncherHolder['isRestartable'],
    launcherFactory: () => ISocket
  ) {
    this.restartMs = restartMsec;
    this.running = false;
    this.launcherFactory = launcherFactory;
    this.launcher = this.createLauncherSocket();
    this.isRestartable = isRestartable;
    this.callbackManager = this.createCallbackManager();
  }

  resetLauncher(): void {
    if (this.running) console.warn('LauncherHolder running, but called reset');

    this.launcher = this.createLauncherSocket();
  }

  start(): void {
    this.launcher.start();
    this.running = true;
  }

  stop(): void {
    this.running = false;
    this.launcher.stop();
  }

  // restart while fail startup
  triggerRestart(): void {
    let failed: string | null = null;
    try {
      this.running = false;
      this.resetLauncher();
      this.start();
      // if (!this.launcher.isAlive())
      //   failed = 'success, but dead';
    } catch (e) {
      failed = 'catch something';
      if (
        typeof e == 'object' &&
        typeof (e as { message: unknown }).message == 'string'
      ) {
        failed = (e as { message: string }).message;
      }
    }
    if (failed) {
      console.warn('restart launcher: failed', failed);
      if (this.restartMs > 0)
        setTimeout(() => {
          this.triggerRestart();
        }, this.restartMs);
    } else {
      console.log('restart launcher: complete');
    }
  }
}
