/**
 * インタラクティブ実行タスク。
 * 双方向ストリーミングでプロセスの stdin/stdout をリアルタイムにやり取りする。
 */
import {
  ILauncherClient,
  ExecInteractiveEvent,
  ExecInteractiveHandle,
  ExecInteractiveParams,
} from '../launcher/launcher-client-interface';
import { QueryInitInfo } from '../../interfaces/query-types';
import { TaskResult } from '../../interfaces/result-types';
import { TaskInterface } from './task-interface';
import { ResultEmitter, Runnable } from './task-util';

/** インタラクティブ出力チャンクの配信コールバック */
export type InteractiveOutputEmitter = (output: {
  stream: 'stdout' | 'stderr';
  data: string;
}) => void;

/** インタラクティブモードのデフォルトタイムアウト（ミリ秒） */
const DEFAULT_INTERACTIVE_TIMEOUT_MS = 60000;

/**
 * インタラクティブ実行タスク。
 * ExecInteractive RPC を使い、プロセスの stdin/stdout をリアルタイムに双方向通信する。
 */
export class TaskInteractive implements TaskInterface {
  private launcherClient: ILauncherClient;
  private resultEmitter: ResultEmitter;
  private outputEmitter: InteractiveOutputEmitter;
  private finalize: Runnable;
  private lang: string;
  private code: string;
  private timeoutMs: number;
  private options?: Record<string, string>;
  private handle: ExecInteractiveHandle | null = null;
  private pendingKill = false;

  constructor(
    launcherClient: ILauncherClient,
    resultEmitter: ResultEmitter,
    outputEmitter: InteractiveOutputEmitter,
    finalize: Runnable,
    lang: string,
    code: string,
    timeoutMs?: number,
    options?: Record<string, string>
  ) {
    this.launcherClient = launcherClient;
    this.resultEmitter = resultEmitter;
    this.outputEmitter = outputEmitter;
    this.finalize = finalize;
    this.lang = lang;
    this.code = code;
    this.timeoutMs = timeoutMs ?? DEFAULT_INTERACTIVE_TIMEOUT_MS;
    this.options = options;
    this.kill = this.kill.bind(this);
  }

  /** stdin にデータを書き込む */
  writeStdin(data: string): void {
    this.handle?.writeStdin(data);
  }

  /** stdin を閉じる（EOF） */
  closeStdin(): void {
    this.handle?.closeStdin();
  }

  /** プロセスを kill する */
  kill(): void {
    if (this.handle) {
      this.launcherClient.kill('', this.handle.taskId);
      this.handle.cancel();
    } else {
      this.pendingKill = true;
    }
  }

  async startAsync(_infog: QueryInitInfo): Promise<void> {
    try {
      const params: ExecInteractiveParams = {
        lang: this.lang,
        files: [{ path: 'code', data: this.code }],
        timeoutMs: this.timeoutMs,
        options: this.options,
      };

      const result = await this.launcherClient.execInteractive(params);
      if (!result.ok) {
        this.resultEmitter({
          success: false,
          summary: 'execInteractive failed: ' + result.error.message,
        });
        return;
      }

      this.handle = result.value;

      // started 受信前に kill が要求されていた場合
      if (this.pendingKill) {
        this.pendingKill = false;
        this.kill();
        return;
      }

      this.resultEmitter({
        success: true,
        summary: 'started',
        continue: true,
        running: true,
      });

      await this.consumeEvents();
    } catch (e) {
      console.error(e);
      this.resultEmitter({ success: false, summary: 'internal error' });
    } finally {
      this.handle = null;
      this.finalize();
    }
  }

  private async consumeEvents(): Promise<void> {
    for await (const event of this.handle!.events) {
      this.handleEvent(event);
    }
  }

  private handleEvent(event: ExecInteractiveEvent): void {
    switch (event.type) {
      case 'output':
        this.outputEmitter({ stream: event.stream, data: event.data });
        break;
      case 'compile_result':
        this.resultEmitter({
          success: event.exitStatus === 0,
          summary: `result(compile)`,
          phase: 'compile',
          continue: true,
          running: true,
          details: [
            {
              type: 'status',
              status: event.exitStatus === 0 ? 'success' : 'error',
            },
            { type: 'param', key: 'time', value: event.timeMs / 1000 },
            { type: 'param', key: 'exitstatus', value: event.exitStatus },
          ],
        });
        break;
      case 'completed':
        this.resultEmitter({
          success: event.exitStatus === 0,
          summary: 'completed',
          phase: 'completed',
          details: [
            { type: 'param', key: 'time', value: event.elapsedTimeMs / 1000 },
            { type: 'param', key: 'exitstatus', value: event.exitStatus },
          ],
        });
        break;
      case 'failed':
        this.resultEmitter({
          success: false,
          summary: `${event.phase}: ${event.errorCode}`,
          phase: event.phase,
          details: [
            { type: 'status', status: 'error' },
            { type: 'text', title: 'reason', text: event.reason },
          ],
        });
        break;
      case 'killed':
        this.resultEmitter({
          success: false,
          summary: `killed: ${event.reason}`,
          phase: 'killed',
          details: [
            { type: 'param', key: 'time', value: event.elapsedTimeMs / 1000 },
          ],
        });
        break;
    }
  }
}
