import { LauncherSocket } from '../Launcher/LauncherSocket';
import CallbackManager from '../../lib/CallbackManager';
import Config from '../../lib/Config';

export default class LauncherHolder {
  private running: boolean;
  private restartMs: number;
  private launcher: LauncherSocket;
  callbackManager: CallbackManager;

  private createLauncherSocket() {
    const launcher = new LauncherSocket();
    launcher.onClose((code: number) => {
      if (Config.useChildProcess) {
        if (code == 1) {
          console.error('launcher has raised exceptions');
          process.exit(1);
        } else {
          console.error('launcher disconnected code=' + code);
          process.exit(0);
        }
      }
      if (this.running)
        setTimeout(() => {
          this.triggerRestart();
        }, this.restartMs);
    });
    launcher.onRecieve((data: any) => {
      this.callbackManager.handleRecieve(data, !!data.continue);
    });
    return launcher;
  }

  private createCallbackManager() {
    return new CallbackManager((data) => {
      this.launcher.send(data);
    }, 'lcmid');
  }

  constructor(restartMsec: number) {
    this.restartMs = restartMsec;
    this.running = false;
    this.launcher = this.createLauncherSocket();
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

  triggerRestart(): void {
    let failed: string | null = null;
    try {
      this.running = false;
      this.resetLauncher();
      this.start();
      // if (!this.launcher.isAlive())
      //   failed = 'success, but dead';
    } catch (e) {
      failed = e.message || 'catch something';
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
