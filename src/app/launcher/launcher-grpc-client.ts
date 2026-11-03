/**
 * gRPC を使った ILauncherClient の本番実装。
 * @grpc/proto-loader による動的 proto ロードを使用。
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import {
  ILauncherClient,
  LauncherResult,
  LauncherError,
  LauncherErrorCode,
  RunTaskParams,
  RunTaskHandle,
  RunTaskEvent,
  RunTaskErrorCode,
  RunTaskMultiParams,
  RunTaskMultiHandle,
  RunTaskMultiEvent,
  ExecInteractiveParams,
  ExecInteractiveHandle,
  ExecInteractiveEvent,
} from './launcher-client-interface';
import Config from '../config';

// ESM とビルド後の配置に依存せず、プロジェクトルートの proto を参照する。
const PROTO_PATH = path.resolve(
  Config.appRootDirectory,
  'src/proto/launcher.proto'
);

/** gRPC ステータスコードから LauncherErrorCode への変換 */
function grpcStatusToErrorCode(code: grpc.status): LauncherErrorCode {
  switch (code) {
    case grpc.status.INVALID_ARGUMENT:
      return 'INVALID_ARGUMENT';
    case grpc.status.FAILED_PRECONDITION:
      return 'FAILED_PRECONDITION';
    case grpc.status.UNAVAILABLE:
      return 'UNAVAILABLE';
    case grpc.status.DEADLINE_EXCEEDED:
      return 'DEADLINE_EXCEEDED';
    default:
      return 'UNAVAILABLE';
  }
}

/** gRPC エラーを LauncherError に変換 */
function toError(err: grpc.ServiceError): LauncherError {
  return {
    code: grpcStatusToErrorCode(err.code),
    message: err.details || err.message,
  };
}

/** proto-loader で動的生成される gRPC クライアントの RPC メソッドシグネチャ */
interface GrpcLauncherService {
  kill(
    request: any,
    callback: (err: grpc.ServiceError | null, response: any) => void
  ): void;
  runTask(request: any): grpc.ClientReadableStream<any>;
  runTaskMulti(request: any): grpc.ClientReadableStream<any>;
  execInteractive(): grpc.ClientDuplexStream<any, any>;
  close(): void;
}

/**
 * gRPC ベースの Launcher クライアント実装。
 * Unix socket または TCP でサーバに接続する。
 */
export class LauncherGrpcClient implements ILauncherClient {
  private client: GrpcLauncherService;

  constructor(address: string) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: Number,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(
      packageDefinition
    ) as any;
    const LauncherService = protoDescriptor.launcher.Launcher;

    // Unix socket の場合は unix: プレフィックスを付ける
    // '/' で始まるか、'.sock' で終わるか、'unix:' で始まるパスを Unix socket と判定
    let target: string;
    if (address.startsWith('unix:')) {
      target = address;
    } else if (address.startsWith('/') || address.endsWith('.sock')) {
      target = `unix:${path.resolve(address)}`;
    } else {
      target = address;
    }

    this.client = new LauncherService(
      target,
      grpc.credentials.createInsecure()
    ) as unknown as GrpcLauncherService;
  }

  async kill(box: string, taskId: string): Promise<LauncherResult<void>> {
    return new Promise((resolve) => {
      this.client.kill({ box, taskId }, (err: grpc.ServiceError | null) => {
        if (err) {
          resolve({ ok: false, error: toError(err) });
        } else {
          resolve({ ok: true, value: undefined });
        }
      });
    });
  }

  /** gRPC RunTask server-streaming RPC */
  async runTask(params: RunTaskParams): Promise<LauncherResult<RunTaskHandle>> {
    const request = {
      lang: params.lang,
      files: params.files.map((f) => ({ path: f.path, data: f.data })),
      totalTimeoutMs: params.totalTimeoutMs,
      phaseTimeoutMs: params.phaseTimeoutMs,
      options: params.options ?? {},
    };

    const call = this.client.runTask(request);
    return this.handleRunTaskStream(call);
  }

  /**
   * RunTask server-streaming RPC のレスポンスを RunTaskHandle に変換する。
   * 最初の started メッセージから taskId を抽出し、
   * 以降のイベントを AsyncIterable として返す。
   */
  private handleRunTaskStream(
    call: grpc.ClientReadableStream<any>
  ): Promise<LauncherResult<RunTaskHandle>> {
    return new Promise((resolve) => {
      let taskId: string | null = null;
      let resolved = false;
      const eventQueue: RunTaskEvent[] = [];
      let done = false;
      let waitingResolve:
        ((value: IteratorResult<RunTaskEvent>) => void) | null = null;

      const iterator: AsyncIterator<RunTaskEvent> = {
        next(): Promise<IteratorResult<RunTaskEvent>> {
          if (eventQueue.length > 0) {
            return Promise.resolve({ value: eventQueue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as any, done: true });
          }
          return new Promise((res) => {
            waitingResolve = res;
          });
        },
        return(): Promise<IteratorResult<RunTaskEvent>> {
          done = true;
          call.cancel();
          return Promise.resolve({ value: undefined as any, done: true });
        },
      };

      call.on('data', (msg: any) => {
        if (!resolved) {
          if (msg.event === 'started' && msg.started) {
            taskId = msg.started.taskId;
            resolved = true;
            resolve({
              ok: true,
              value: {
                taskId: taskId!,
                events: { [Symbol.asyncIterator]: () => iterator },
              },
            });
            return;
          }
          taskId = '';
          resolved = true;
          resolve({
            ok: true,
            value: {
              taskId: '',
              events: { [Symbol.asyncIterator]: () => iterator },
            },
          });
        }
        const event = this.mapRunTaskEvent(msg);
        if (event !== null) {
          if (waitingResolve) {
            waitingResolve({ value: event, done: false });
            waitingResolve = null;
          } else {
            eventQueue.push(event);
          }
        }
      });

      call.on('error', (err: grpc.ServiceError) => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: toError(err) });
        } else {
          done = true;
          if (waitingResolve) {
            waitingResolve({ value: undefined as any, done: true });
            waitingResolve = null;
          }
        }
      });

      call.on('end', () => {
        done = true;
        if (!resolved) {
          resolved = true;
          resolve({
            ok: false,
            error: {
              code: 'UNAVAILABLE',
              message: 'Stream ended without started event',
            },
          });
        }
        if (waitingResolve) {
          waitingResolve({ value: undefined as any, done: true });
          waitingResolve = null;
        }
      });
    });
  }

  /** proto メッセージを RunTaskEvent に変換 */
  private mapRunTaskEvent(msg: any): RunTaskEvent | null {
    if (msg.event === 'phaseResult' && msg.phaseResult) {
      const pr = msg.phaseResult;
      return {
        type: 'phase_result',
        phase: pr.phase,
        exitStatus: pr.exitStatus,
        timeMs: pr.timeMs,
        stdout: pr.stdout,
        stderr: pr.stderr,
        hasNextPhase: pr.hasNextPhase,
      };
    }
    if (msg.event === 'completed' && msg.completed) {
      return {
        type: 'completed',
        totalTimeMs: msg.completed.totalTimeMs,
      };
    }
    if (msg.event === 'failed' && msg.failed) {
      return {
        type: 'failed',
        phase: msg.failed.phase,
        errorCode: this.mapRunTaskErrorCode(msg.failed.errorCode),
        reason: msg.failed.reason,
      };
    }
    return null;
  }

  /** proto の RunTaskErrorCode enum 値を文字列に変換 */
  private mapRunTaskErrorCode(code: number): RunTaskErrorCode {
    switch (code) {
      case 1:
        return 'INVALID_LANG';
      case 2:
        return 'SETUP_FAILED';
      case 3:
        return 'STORE_FAILED';
      case 4:
        return 'EXEC_FAILED';
      case 5:
        return 'TIMEOUT';
      case 6:
        return 'PHASE_TIMEOUT';
      case 8:
        return 'INVALID_OPTION';
      default:
        return 'INTERNAL';
    }
  }

  /** gRPC RunTaskMulti server-streaming RPC */
  async runTaskMulti(
    params: RunTaskMultiParams
  ): Promise<LauncherResult<RunTaskMultiHandle>> {
    const request = {
      lang: params.lang,
      files: params.files.map((f) => ({ path: f.path, data: f.data })),
      totalTimeoutMs: params.totalTimeoutMs,
      phaseTimeoutMs: params.phaseTimeoutMs,
      options: params.options ?? {},
      stdinList: params.stdinList.map((s) => ({
        stdinIndex: s.stdinIndex,
        data: s.data,
      })),
    };

    const call = this.client.runTaskMulti(request);
    return this.handleRunTaskMultiStream(call);
  }

  /**
   * RunTaskMulti server-streaming RPC のレスポンスを RunTaskMultiHandle に変換する。
   * 最初の started メッセージから taskId を抽出し、
   * 以降のイベントを AsyncIterable として返す。
   */
  private handleRunTaskMultiStream(
    call: grpc.ClientReadableStream<any>
  ): Promise<LauncherResult<RunTaskMultiHandle>> {
    return new Promise((resolve) => {
      let taskId: string | null = null;
      let resolved = false;
      const eventQueue: RunTaskMultiEvent[] = [];
      let done = false;
      let waitingResolve:
        ((value: IteratorResult<RunTaskMultiEvent>) => void) | null = null;

      const iterator: AsyncIterator<RunTaskMultiEvent> = {
        next(): Promise<IteratorResult<RunTaskMultiEvent>> {
          if (eventQueue.length > 0) {
            return Promise.resolve({ value: eventQueue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as any, done: true });
          }
          return new Promise((res) => {
            waitingResolve = res;
          });
        },
        return(): Promise<IteratorResult<RunTaskMultiEvent>> {
          done = true;
          call.cancel();
          return Promise.resolve({ value: undefined as any, done: true });
        },
      };

      call.on('data', (msg: any) => {
        if (!resolved) {
          if (msg.event === 'started' && msg.started) {
            taskId = msg.started.taskId;
            resolved = true;
            resolve({
              ok: true,
              value: {
                taskId: taskId!,
                events: { [Symbol.asyncIterator]: () => iterator },
              },
            });
            return;
          }
          taskId = '';
          resolved = true;
          resolve({
            ok: true,
            value: {
              taskId: '',
              events: { [Symbol.asyncIterator]: () => iterator },
            },
          });
        }
        const event = this.mapRunTaskMultiEvent(msg);
        if (event !== null) {
          if (waitingResolve) {
            waitingResolve({ value: event, done: false });
            waitingResolve = null;
          } else {
            eventQueue.push(event);
          }
        }
      });

      call.on('error', (err: grpc.ServiceError) => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: toError(err) });
        } else {
          done = true;
          if (waitingResolve) {
            waitingResolve({ value: undefined as any, done: true });
            waitingResolve = null;
          }
        }
      });

      call.on('end', () => {
        done = true;
        if (!resolved) {
          resolved = true;
          resolve({
            ok: false,
            error: {
              code: 'UNAVAILABLE',
              message: 'Stream ended without started event',
            },
          });
        }
        if (waitingResolve) {
          waitingResolve({ value: undefined as any, done: true });
          waitingResolve = null;
        }
      });
    });
  }

  /** proto メッセージを RunTaskMultiEvent に変換 */
  private mapRunTaskMultiEvent(msg: any): RunTaskMultiEvent | null {
    if (msg.event === 'buildResult' && msg.buildResult) {
      const br = msg.buildResult;
      return {
        type: 'build_result',
        phase: br.phase,
        exitStatus: br.exitStatus,
        timeMs: br.timeMs,
        stdout: br.stdout,
        stderr: br.stderr,
        hasNextBuildPhase: br.hasNextBuildPhase,
      };
    }
    if (msg.event === 'runResult' && msg.runResult) {
      const rr = msg.runResult;
      return {
        type: 'run_result',
        stdinIndex: rr.stdinIndex,
        exitStatus: rr.exitStatus,
        timeMs: rr.timeMs,
        stdout: rr.stdout,
        stderr: rr.stderr,
        hasNextRun: rr.hasNextRun,
      };
    }
    if (msg.event === 'completed' && msg.completed) {
      return {
        type: 'completed',
        totalTimeMs: msg.completed.totalTimeMs,
      };
    }
    if (msg.event === 'failed' && msg.failed) {
      return {
        type: 'failed',
        phase: msg.failed.phase,
        errorCode: this.mapRunTaskErrorCode(msg.failed.errorCode),
        reason: msg.failed.reason,
      };
    }
    return null;
  }

  /** gRPC ExecInteractive bidirectional streaming RPC */
  async execInteractive(
    params: ExecInteractiveParams
  ): Promise<LauncherResult<ExecInteractiveHandle>> {
    const call = this.client.execInteractive();

    // Start メッセージ送信
    call.write({
      start: {
        lang: params.lang,
        files: params.files.map((f) => ({ path: f.path, data: f.data })),
        timeoutMs: params.timeoutMs,
        options: params.options ?? {},
      },
    });

    // 最初の started イベントを待機
    return new Promise((resolve) => {
      let taskId = '';
      let resolved = false;
      const eventQueue: ExecInteractiveEvent[] = [];
      let done = false;
      let waitingResolve:
        ((value: IteratorResult<ExecInteractiveEvent>) => void) | null = null;

      const iterator: AsyncIterator<ExecInteractiveEvent> = {
        next(): Promise<IteratorResult<ExecInteractiveEvent>> {
          if (eventQueue.length > 0) {
            return Promise.resolve({ value: eventQueue.shift()!, done: false });
          }
          if (done) {
            return Promise.resolve({ value: undefined as any, done: true });
          }
          return new Promise((res) => {
            waitingResolve = res;
          });
        },
        return(): Promise<IteratorResult<ExecInteractiveEvent>> {
          done = true;
          call.cancel();
          return Promise.resolve({ value: undefined as any, done: true });
        },
      };

      const pushEvent = (event: ExecInteractiveEvent) => {
        if (waitingResolve) {
          waitingResolve({ value: event, done: false });
          waitingResolve = null;
        } else {
          eventQueue.push(event);
        }
      };

      call.on('data', (msg: any) => {
        if (!resolved) {
          if (msg.event === 'started' && msg.started) {
            taskId = msg.started.taskId;
            resolved = true;
            resolve({
              ok: true,
              value: {
                taskId,
                events: { [Symbol.asyncIterator]: () => iterator },
                writeStdin: (data: string) => {
                  call.write({ stdinChunk: { data } });
                },
                closeStdin: () => {
                  call.write({ closeStdin: {} });
                },
                cancel: () => {
                  done = true;
                  call.cancel();
                  if (waitingResolve) {
                    waitingResolve({ value: undefined as any, done: true });
                    waitingResolve = null;
                  }
                },
              },
            });
            return;
          }
          // failed before started
          if (msg.event === 'failed' && msg.failed) {
            resolved = true;
            resolve({
              ok: false,
              error: {
                code: 'FAILED_PRECONDITION',
                message: msg.failed.reason || 'execution failed',
              },
            });
            return;
          }
          // compile_result before started (pass through)
          const event = this.mapExecInteractiveEvent(msg);
          if (event) {
            // Buffer for after resolve
            eventQueue.push(event);
          }
          return;
        }
        const event = this.mapExecInteractiveEvent(msg);
        if (event) {
          pushEvent(event);
        }
      });

      call.on('error', (err: grpc.ServiceError) => {
        if (!resolved) {
          resolved = true;
          resolve({ ok: false, error: toError(err) });
        } else {
          done = true;
          if (waitingResolve) {
            waitingResolve({ value: undefined as any, done: true });
            waitingResolve = null;
          }
        }
      });

      call.on('end', () => {
        done = true;
        if (!resolved) {
          resolved = true;
          resolve({
            ok: false,
            error: {
              code: 'UNAVAILABLE',
              message: 'Stream ended without started event',
            },
          });
        }
        if (waitingResolve) {
          waitingResolve({ value: undefined as any, done: true });
          waitingResolve = null;
        }
      });
    });
  }

  /** proto メッセージを ExecInteractiveEvent に変換 */
  private mapExecInteractiveEvent(msg: any): ExecInteractiveEvent | null {
    if (msg.event === 'output' && msg.output) {
      return {
        type: 'output',
        stream: msg.output.stream === 2 ? 'stderr' : 'stdout',
        data: msg.output.data,
      };
    }
    if (msg.event === 'compileResult' && msg.compileResult) {
      return {
        type: 'compile_result',
        exitStatus: msg.compileResult.exitStatus,
        timeMs: msg.compileResult.timeMs,
        stdout: msg.compileResult.stdout,
        stderr: msg.compileResult.stderr,
      };
    }
    if (msg.event === 'completed' && msg.completed) {
      return {
        type: 'completed',
        exitStatus: msg.completed.exitStatus,
        elapsedTimeMs: msg.completed.timeMs,
      };
    }
    if (msg.event === 'killed' && msg.killed) {
      return {
        type: 'killed',
        reason: msg.killed.reason,
        elapsedTimeMs: msg.killed.timeMs,
      };
    }
    if (msg.event === 'failed' && msg.failed) {
      return {
        type: 'failed',
        phase: msg.failed.phase,
        errorCode: this.mapRunTaskErrorCode(msg.failed.errorCode),
        reason: msg.failed.reason,
      };
    }
    return null;
  }

  /** gRPC channel を閉じる */
  close(): void {
    this.client.close();
  }

  /** gRPC channel を取得する（接続状態監視用） */
  getChannel(): grpc.Channel {
    return (this.client as any).getChannel();
  }
}
