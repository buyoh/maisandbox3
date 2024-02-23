import { createLauncherService } from './LauncherService';
import { createWebService } from './WebService';
import { createTaskManagerService } from './TaskManagerService';
import Config from './Config';

(async () => {
  try {
    const launcherService = createLauncherService();
    const taskManagerService = createTaskManagerService(
      launcherService.getCallbackManager()
    );
    if (Config.develop) {
      // TODO: Replace completely with vite
      await createWebService(taskManagerService.getConnectionHandlerFactory());  // vite
    } else {
      await createWebService(taskManagerService.getConnectionHandlerFactory(), false);  // nextjs
    }

    // trap
    process.on('SIGINT', () => {
      launcherService.stop();
      process.exit(0);
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
