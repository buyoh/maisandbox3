/**
 * RunTask RPC を使用する統一タスク実装。
 * 言語ごとの実行ロジックはサーバ側(Go)に委譲し、クライアントはイベントストリームを消費して結果を報告する。
 */
import {
  ILauncherClient,
  RunTaskEvent,
  RunTaskHandle,
  RunTaskParams,
} from '../launcher/launcher-client-interface';
import {
  QueryInitInfo,
  QueryInitInfoFileStdin,
} from '../../interfaces/query-types';
import { ReportItem, TaskResult } from '../../interfaces/result-types';
import { TaskInterface } from './task-interface';
import { ResultEmitter, Runnable } from './task-util';
import { AnnotationParser, annotationParsers } from './lang/annotation-parsers';

// --- RunTask Config ---

/** RunTask 実行時のタイムアウト設定 */
export interface RunTaskTimeoutConfig {
  /** 全フェーズ合計のタイムアウト（ミリ秒）。0は無制限 */
  totalTimeoutMs: number;
  /** 単一フェーズのタイムアウト（ミリ秒）。0は無制限 */
  phaseTimeoutMs: number;
}

const defaultTimeoutConfig: RunTaskTimeoutConfig = {
  totalTimeoutMs: 30000,
  phaseTimeoutMs: 15000,
};

// --- TaskRunTask ---

/**
 * RunTask RPC を使用する統一タスク実装。
 * 全言語を1クラスで処理し、言語固有ロジックはサーバ側に委譲する。
 */
export class TaskRunTask implements TaskInterface {
  private launcherClient: ILauncherClient;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private lang: string;
  private timeoutConfig: RunTaskTimeoutConfig;
  private options?: Record<string, string>;
  private handleKill: Runnable | null = null;

  constructor(
    launcherClient: ILauncherClient,
    resultEmitter: ResultEmitter,
    finalize: Runnable,
    lang: string,
    timeoutConfig?: RunTaskTimeoutConfig,
    options?: Record<string, string>
  ) {
    this.launcherClient = launcherClient;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.lang = lang;
    this.timeoutConfig = timeoutConfig ?? defaultTimeoutConfig;
    this.options = options;
    this.kill = this.kill.bind(this);
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  async startAsync(infog: QueryInitInfo): Promise<void> {
    try {
      // infog は現在 QueryInitInfoFileStdin のみ。
      // 将来バリアントが追加された場合に備え type を検証する。
      if (infog.type !== 'filestdin') {
        this.resultEmitter({
          success: false,
          summary: `Unsupported info type: ${infog.type}`,
        });
        return;
      }
      const info = infog;
      const params: RunTaskParams = {
        lang: this.lang,
        files: [
          { path: 'code', data: info.code },
          { path: 'stdin', data: info.stdin },
        ],
        totalTimeoutMs: this.timeoutConfig.totalTimeoutMs,
        phaseTimeoutMs: this.timeoutConfig.phaseTimeoutMs,
        options: this.options,
      };

      const result = await this.launcherClient.runTask(params);
      if (!result.ok) {
        this.resultEmitter({
          success: false,
          summary: 'runTask failed: ' + result.error.message,
        });
        return;
      }

      const handle: RunTaskHandle = result.value;

      // kill ハンドラ登録（task_idのみでkill可能）
      this.handleKill = () => {
        this.launcherClient.kill('', handle.taskId);
      };

      this.resultEmitter({
        success: true,
        summary: 'started',
        continue: true,
        running: true,
      });

      await this.consumeEvents(handle);
    } catch (e) {
      console.error(e);
      this.resultEmitter({ success: false, summary: 'internal error' });
    } finally {
      this.finalize();
    }
  }

  private async consumeEvents(handle: RunTaskHandle): Promise<void> {
    const parser = annotationParsers[this.lang];

    for await (const event of handle.events) {
      this.handleEvent(event, parser);
    }
  }

  private handleEvent(event: RunTaskEvent, parser?: AnnotationParser): void {
    switch (event.type) {
      case 'phase_result':
        this.emitPhaseResult(event, parser);
        break;
      case 'completed':
        this.resultEmitter({
          success: true,
          summary: 'completed',
          phase: 'completed',
          details: [
            {
              type: 'param',
              key: 'total_time',
              value: event.totalTimeMs / 1000,
            },
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
    }
  }

  private emitPhaseResult(
    event: Extract<RunTaskEvent, { type: 'phase_result' }>,
    parser?: AnnotationParser
  ): void {
    const details: ReportItem[] = [];
    details.push({
      type: 'status',
      status: event.exitStatus === 0 ? 'success' : 'warning',
    });
    details.push({ type: 'param', key: 'time', value: event.timeMs / 1000 });
    details.push({ type: 'param', key: 'exitstatus', value: event.exitStatus });
    details.push({ type: 'out', text: event.stdout });
    details.push({ type: 'log', text: event.stderr });

    if (parser) {
      const annotations = parser(event.stderr);
      if (annotations.length > 0) {
        details.push({ type: 'annotation', annotations });
      }
    }

    this.resultEmitter({
      success: true,
      summary: `result(${event.phase})`,
      phase: event.phase,
      continue: event.hasNextPhase,
      details,
    });
  }
}
