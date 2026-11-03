/**
 * Socket.IO ベースの InteractiveService 実装。
 * サーバとリアルタイムに stdin/stdout を双方向通信する。
 */
import type {
  InteractiveOutputChunk,
  InteractiveCompleteResult,
  InteractiveBuildResult,
} from '../../interfaces/interactive-types';
import { InteractiveService, InteractiveHandle } from './service-interfaces';
import { SocketInterface } from './client-socket';

/**
 * Socket.IO ベースの InteractiveService を作成する。
 * サーバの runInteractiveTask / interactiveStdin / interactiveCloseStdin イベントを使用し、
 * interactiveOutput / taskResult イベントで結果を受信する。
 */
export function createSocketInteractiveService(
  socket: SocketInterface
): InteractiveService {
  return {
    start(lang: string, code: string): InteractiveHandle {
      let outputHandler: ((data: InteractiveOutputChunk) => void) | null = null;
      let buildResultHandler: ((result: InteractiveBuildResult) => void) | null = null;
      let completeHandler:
        ((result: InteractiveCompleteResult) => void) | null = null;
      let disposed = false;
      const clicmid = Date.now() + Math.floor(Math.random() * 10000);

      // interactiveOutput イベントを購読
      socket.onInteractiveOutput((data) => {
        if (disposed) return;
        if (data.id?.clicmid !== clicmid) return;
        outputHandler?.({ stream: data.stream, data: data.data });
      });

      // taskResult で完了通知を受ける（continue=false で完了）
      socket.onTaskResult((data) => {
        if (disposed) return;
        if (data.id?.clicmid !== clicmid) return;
        if (data.continue) {
          // フェーズ結果（ビルド/コンパイル等）
          if (data.phase) {
            buildResultHandler?.({
              phase: data.phase,
              exitStatus: data.success ? 0 : 1,
              details: data.details?.filter((d) => d.type !== 'out') ?? null,
            });
          }
          return;
        }
        completeHandler?.({ exitStatus: data.success ? 0 : 1, timeMs: 0, phase: data.phase });
      });

      // 実行開始
      socket.emitRunInteractiveTask({
        id: { clicmid },
        lang,
        code,
      });

      return {
        onOutput(handler: (data: InteractiveOutputChunk) => void): void {
          outputHandler = handler;
        },
        onBuildResult(handler: (result: InteractiveBuildResult) => void): void {
          buildResultHandler = handler;
        },
        onComplete(handler: (result: InteractiveCompleteResult) => void): void {
          completeHandler = handler;
        },
        writeStdin(data: string): void {
          if (disposed) return;
          socket.emitInteractiveStdin({ id: { clicmid }, data });
        },
        closeStdin(): void {
          if (disposed) return;
          socket.emitInteractiveCloseStdin({ id: { clicmid } });
        },
        kill(): void {
          if (disposed) return;
          socket.emitKill({ id: { clicmid } });
        },
        dispose(): void {
          disposed = true;
          outputHandler = null;
          buildResultHandler = null;
          completeHandler = null;
        },
      };
    },
  };
}
