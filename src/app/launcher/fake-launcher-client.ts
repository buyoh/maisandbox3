/**
 * テスト用のILauncherClientインメモリ実装。
 * runTaskのストリームを内部AsyncQueueで手動制御する。
 */
import {
  ILauncherClient,
  LauncherResult,
  RunTaskEvent,
  RunTaskHandle,
  RunTaskParams,
  RunTaskMultiEvent,
  RunTaskMultiHandle,
  RunTaskMultiParams,
  ExecInteractiveParams,
  ExecInteractiveHandle,
  ExecInteractiveEvent,
} from './launcher-client-interface';

/** ストリームにイベントを手動注入するためのキュー */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private resolvers: ((value: IteratorResult<T>) => void)[] = [];
  private closed = false;

  push(item: T): void {
    if (this.closed) return;
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.queue.push(item);
    }
  }

  close(): void {
    this.closed = true;
    for (const resolver of this.resolvers) {
      resolver({ value: undefined as any, done: true });
    }
    this.resolvers = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.queue.length > 0) {
          return Promise.resolve({
            value: this.queue.shift()!,
            done: false as const,
          });
        }
        if (this.closed) {
          return Promise.resolve({
            value: undefined as any,
            done: true as const,
          });
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }
}

/** FakeLauncherClient が管理するrunTask実行情報 */
export interface FakeRunTaskContext {
  params: RunTaskParams;
  taskId: string;
  queue: AsyncQueue<RunTaskEvent>;
}

/** FakeLauncherClient が管理するrunTaskMulti実行情報 */
export interface FakeRunTaskMultiContext {
  params: RunTaskMultiParams;
  taskId: string;
  queue: AsyncQueue<RunTaskMultiEvent>;
}

/** FakeLauncherClient が管理するexecInteractive実行情報 */
export interface FakeExecInteractiveContext {
  params: ExecInteractiveParams;
  taskId: string;
  queue: AsyncQueue<ExecInteractiveEvent>;
  /** テストから参照可能: writeStdin で書き込まれたデータ */
  stdinChunks: string[];
  /** テストから参照可能: closeStdin が呼ばれたか */
  stdinClosed: boolean;
  /** テストから参照可能: cancel が呼ばれたか */
  cancelled: boolean;
}

/**
 * テスト用のFake Launcher Client。
 * runTaskのストリームを手動制御可能。
 */
export class FakeLauncherClient implements ILauncherClient {
  private taskCounter = 0;
  /** 現在実行中のrunTaskコンテキスト（テストから参照可能） */
  activeRunTasks: Map<string, FakeRunTaskContext> = new Map();
  /** 現在実行中のrunTaskMultiコンテキスト（テストから参照可能） */
  activeRunTaskMultis: Map<string, FakeRunTaskMultiContext> = new Map();
  /** 現在実行中のexecInteractiveコンテキスト（テストから参照可能） */
  activeInteractives: Map<string, FakeExecInteractiveContext> = new Map();

  kill(_box: string, taskId: string): Promise<LauncherResult<void>> {
    const context = this.activeRunTasks.get(taskId);
    if (context) {
      context.queue.close();
    }
    const multiContext = this.activeRunTaskMultis.get(taskId);
    if (multiContext) {
      multiContext.queue.close();
    }
    const interactiveContext = this.activeInteractives.get(taskId);
    if (interactiveContext) {
      interactiveContext.queue.close();
    }
    return Promise.resolve({ ok: true, value: undefined });
  }

  runTask(params: RunTaskParams): Promise<LauncherResult<RunTaskHandle>> {
    const taskId = `task-${++this.taskCounter}`;
    const queue = new AsyncQueue<RunTaskEvent>();
    const context: FakeRunTaskContext = { params, taskId, queue };
    this.activeRunTasks.set(taskId, context);

    return Promise.resolve({
      ok: true,
      value: {
        taskId,
        events: {
          [Symbol.asyncIterator](): AsyncIterator<RunTaskEvent> {
            return queue[Symbol.asyncIterator]();
          },
        },
      },
    });
  }

  runTaskMulti(
    params: RunTaskMultiParams
  ): Promise<LauncherResult<RunTaskMultiHandle>> {
    const taskId = `task-multi-${++this.taskCounter}`;
    const queue = new AsyncQueue<RunTaskMultiEvent>();
    const context: FakeRunTaskMultiContext = { params, taskId, queue };
    this.activeRunTaskMultis.set(taskId, context);

    return Promise.resolve({
      ok: true,
      value: {
        taskId,
        events: {
          [Symbol.asyncIterator](): AsyncIterator<RunTaskMultiEvent> {
            return queue[Symbol.asyncIterator]();
          },
        },
      },
    });
  }

  execInteractive(
    params: ExecInteractiveParams
  ): Promise<LauncherResult<ExecInteractiveHandle>> {
    const taskId = `task-interactive-${++this.taskCounter}`;
    const queue = new AsyncQueue<ExecInteractiveEvent>();
    const context: FakeExecInteractiveContext = {
      params,
      taskId,
      queue,
      stdinChunks: [],
      stdinClosed: false,
      cancelled: false,
    };
    this.activeInteractives.set(taskId, context);

    return Promise.resolve({
      ok: true,
      value: {
        taskId,
        events: {
          [Symbol.asyncIterator](): AsyncIterator<ExecInteractiveEvent> {
            return queue[Symbol.asyncIterator]();
          },
        },
        writeStdin(data: string): void {
          context.stdinChunks.push(data);
        },
        closeStdin(): void {
          context.stdinClosed = true;
        },
        cancel(): void {
          context.cancelled = true;
          queue.close();
        },
      },
    });
  }
}
