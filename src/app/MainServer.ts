import { createLauncherService } from './LauncherService';
import { createWebService } from './WebService';
import { createTaskManagerService } from './TaskManagerService';

(async () => {
  try {
    const launcherService = createLauncherService();
    const taskManagerService = createTaskManagerService(
      launcherService.getCallbackManager()
    );
    await createWebService(taskManagerService.getConnectionHandlerFactory());

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
