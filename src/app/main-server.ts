import { createWebService } from './web/web-service';
import { createTaskManagerService } from './task-manager-service';
import { ChildProcessGrpcLauncher } from './launcher/child-process-grpc-launcher';
import { LauncherGrpcClient } from './launcher/launcher-grpc-client';
import { LauncherInfoGrpcClient } from './launcher/launcher-info-grpc-client';
import { ILauncherClient } from './launcher/launcher-client-interface';
import { ILauncherInfoClient } from './launcher/launcher-info-client-interface';
import { GrpcConnectivityWatcher } from './launcher/connectivity-watcher';
import { LauncherStatusService } from './launcher/launcher-status-service';
import Config from './config';

(async () => {
  try {
    let childProcessGrpcLauncher: ChildProcessGrpcLauncher | null = null;
    let launcherClient: ILauncherClient;
    let grpcClient: LauncherGrpcClient | null = null;
    let launcherInfoClient: ILauncherInfoClient | undefined;

    if (Config.launcherMode === 'grpc') {
      grpcClient = new LauncherGrpcClient(Config.launcherGrpcAddress);
      launcherClient = grpcClient;
      launcherInfoClient = new LauncherInfoGrpcClient(
        Config.launcherGrpcAddress
      );
      console.log(
        'Launcher mode: gRPC (address:',
        Config.launcherGrpcAddress,
        ')'
      );
    } else {
      // grpc-child
      childProcessGrpcLauncher = new ChildProcessGrpcLauncher();
      const result = await childProcessGrpcLauncher.start();
      launcherClient = result;
      launcherInfoClient = new LauncherInfoGrpcClient(
        childProcessGrpcLauncher.getAddress()
      );
      console.log('Launcher mode: gRPC child process');
    }

    const taskManagerService = createTaskManagerService(launcherClient);

    // Launcher 接続状態監視（LauncherStatusService は webService 作成後に生成するため、
    // getLauncherStatus はクロージャ経由で遅延参照する）
    let launcherStatusService: LauncherStatusService | null = null;

    console.log('Config.frontend', Config.frontend);
    const { webService, launcherStatusBroadcaster } = await createWebService(
      taskManagerService.getConnectionHandlerFactory(),
      Config.frontend, // vite or static
      {
        getLauncherStatus: () =>
          launcherStatusService?.getStatus() ?? 'disconnected',
        launcherInfoClient,
      }
    );

    // Launcher 接続状態監視の開始
    if (grpcClient) {
      const channel = grpcClient.getChannel();
      if (channel) {
        const watcher = new GrpcConnectivityWatcher(channel);
        launcherStatusService = new LauncherStatusService(watcher, (status) => {
          launcherStatusBroadcaster.broadcastLauncherStatus(status);
        });
        launcherStatusService.start();
      }
    }

    // Graceful shutdown
    let shuttingDown = false;
    process.on('SIGINT', async () => {
      if (shuttingDown) {
        // 2度目のSIGINT: graceful shutdown に失敗した場合の強制終了
        console.error('Forced shutdown (second SIGINT)');
        process.exit(1);
      }
      shuttingDown = true;
      console.log('Shutting down gracefully...');

      try {
        // 1. Launcher 状態監視を停止
        launcherStatusService?.stop();

        // 2. HTTP/WebSocket サーバを閉じる（新規接続を拒否、既存接続を切断）
        await webService.stop();

        // 3. 全接続のタスクを停止
        taskManagerService.stop();

        // 4. gRPC クライアント/子プロセスを停止
        if (childProcessGrpcLauncher) {
          childProcessGrpcLauncher.stop();
        } else {
          grpcClient?.close();
        }

        process.exit(0);
      } catch (e) {
        console.error('Error during shutdown:', e);
        process.exit(1);
      }
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
