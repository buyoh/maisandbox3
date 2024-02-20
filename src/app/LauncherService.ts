import CallbackManager from '../lib/CallbackManager';
import Config from '../lib/Config';
import LauncherHolder from './Launcher/LauncherHolder';
import { createLauncherSocket } from './Launcher/LauncherSocketFactory';

// ----------------------------------------------------------------------------

export interface LauncherService {
  stop(): void;
  getCallbackManager(): CallbackManager;
}

// ----------------------------------------------------------------------------

class LauncherServiceImpl implements LauncherService {
  launcherHolder: LauncherHolder;
  constructor(launcherHolder: LauncherHolder) {
    this.launcherHolder = launcherHolder;
  }
  stop(): void {
    this.launcherHolder.stop();
  }
  getCallbackManager(): CallbackManager {
    return this.launcherHolder.callbackManager;
  }
}

// ----------------------------------------------------------------------------

export function createLauncherService(): LauncherService {
  const launcherHolder = new LauncherHolder(
    5000,
    (code: number | null) => {
      if (Config.useChildProcess) {
        if (code === 1) {
          console.error('launcher has raised exceptions');
          process.exit(1);
        } else {
          console.error('launcher disconnected code=' + code);
          process.exit(0);
        }
        // NOTREACHED
      }
      return true;
    },
    () => createLauncherSocket()
  );
  launcherHolder.start();

  return new LauncherServiceImpl(launcherHolder);
}
