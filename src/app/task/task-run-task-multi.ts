/**
 * RunTaskMulti RPC を使用するタスク実装。
 * 複数の stdin に対してビルド1回 + run N回を実行し、
 * ビルド結果と各 run 結果を個別に報告する。
 */
import {
  ILauncherClient,
  RunTaskMultiEvent,
  RunTaskMultiHandle,
  RunTaskMultiParams,
} from '../launcher/launcher-client-interface';
import { QueryInitInfo } from '../../interfaces/query-types';
import { TaskResult } from '../../interfaces/result-types';
import { TaskInterface } from './task-interface';
import { ResultEmitter, Runnable } from './task-util';
import { RunTaskTimeoutConfig } from './task-run-task';

const defaultTimeoutConfig: RunTaskTimeoutConfig = {
  totalTimeoutMs: 30000,
  phaseTimeoutMs: 15000,
};

/**
 * RunTaskMulti RPC を使用する統一タスク実装。
 * 複数の stdin に対してビルド1回 + run N回を実行する。
 */
export class TaskRunTaskMulti implements TaskInterface {
  private launcherClient: ILauncherClient;
  private resultEmitter: ResultEmitter;
  private finalize: Runnable;
  private lang: string;
  private timeoutConfig: RunTaskTimeoutConfig;
  private options?: Record<string, string>;
  private handleKill: Runnable | null = null;
  private stdinList: string[];
  private code: string;

  constructor(
    launcherClient: ILauncherClient,
    resultEmitter: ResultEmitter,
    finalize: Runnable,
    lang: string,
    code: string,
    stdinList: string[],
    timeoutConfig?: RunTaskTimeoutConfig,
    options?: Record<string, string>
  ) {
    this.launcherClient = launcherClient;
    this.resultEmitter = resultEmitter;
    this.finalize = finalize;
    this.lang = lang;
    this.code = code;
    this.stdinList = stdinList;
    this.timeoutConfig = timeoutConfig ?? defaultTimeoutConfig;
    this.options = options;
    this.kill = this.kill.bind(this);
  }

  kill(): void {
    this.handleKill?.call(this);
  }

  // stdinList と code はコンストラクタで注入済み。infog は使用しない
  // （TaskFactory が型分解を行い、確定済みデータをコンストラクタに渡す設計）。
  async startAsync(_infog: QueryInitInfo): Promise<void> {
    try {
      const params: RunTaskMultiParams = {
        lang: this.lang,
        files: [
          { path: 'code', data: this.code },
          // 空の stdin を含める: ビルドフェーズが stdin_from_input を参照する設定に対応
          { path: 'stdin', data: '' },
        ],
        totalTimeoutMs: this.timeoutConfig.totalTimeoutMs,
        phaseTimeoutMs: this.timeoutConfig.phaseTimeoutMs,
        options: this.options,
        stdinList: this.stdinList.map((data, i) => ({
          stdinIndex: i,
          data,
        })),
      };

      const result = await this.launcherClient.runTaskMulti(params);
      if (!result.ok) {
        this.resultEmitter({
          success: false,
          summary: 'runTaskMulti failed: ' + result.error.message,
        });
        return;
      }

      const handle = result.value;
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

  private async consumeEvents(handle: RunTaskMultiHandle): Promise<void> {
    for await (const event of handle.events) {
      switch (event.type) {
        case 'build_result':
          this.emitBuildResult(event);
          break;
        case 'run_result':
          this.emitRunResult(event);
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
  }

  private emitBuildResult(
    event: RunTaskMultiEvent & { type: 'build_result' }
  ): void {
    const result: TaskResult = {
      success: true,
      summary: `result(${event.phase})`,
      phase: event.phase,
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
    };
    if (event.stderr) {
      result.details!.push({ type: 'log', text: event.stderr });
    }
    this.resultEmitter(result);
  }

  private emitRunResult(
    event: RunTaskMultiEvent & { type: 'run_result' }
  ): void {
    const result: TaskResult = {
      success: true,
      summary: 'run_result',
      phase: 'run',
      continue: true,
      running: true,
      details: [
        {
          type: 'status',
          status: event.exitStatus === 0 ? 'success' : 'warning',
        },
        { type: 'param', key: 'stdin_index', value: event.stdinIndex },
        { type: 'param', key: 'time', value: event.timeMs / 1000 },
        { type: 'param', key: 'exitstatus', value: event.exitStatus },
        { type: 'out', text: event.stdout },
      ],
    };
    if (event.stderr) {
      result.details!.push({ type: 'log', text: event.stderr });
    }
    this.resultEmitter(result);
  }
}
