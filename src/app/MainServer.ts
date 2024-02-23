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

    console.log('Config.frontend', Config.frontend);
    await createWebService(
      taskManagerService.getConnectionHandlerFactory(),
      Config.frontend // vite or nextjs or static
    );

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
