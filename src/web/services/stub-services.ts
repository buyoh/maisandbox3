import type {
  InteractiveOutputChunk,
  InteractiveCompleteResult,
} from '../../interfaces/interactive-types';
import type {
  BuildPhaseResult,
  MultiRunResult,
} from '../../interfaces/multi-stdio-types';
import type {
  LangInfo,
  LangVersionResult,
} from '../../interfaces/lang-info-types';
import {
  InteractiveService,
  InteractiveHandle,
  MultiStdioService,
  MultiStdioHandle,
  LangInfoService,
} from './service-interfaces';

const DUMMY_VERSION_MAP: Record<string, string> = {
  cpp: '(stub) gcc 13.3.0',
  ruby: '(stub) ruby 3.2.0',
  clay: '(stub) clay 1.0 / gcc 13.3.0',
};

const DUMMY_INTERACTIVE_OUTPUT = '> Hello from stub!\n> Enter input:\n';

const DUMMY_LANG_INFO: LangInfo[] = [
  {
    lang: 'cpp',
    displayName: 'C++',
    options: [
      {
        key: 'std',
        type: 'enum',
        values: ['c++14', 'c++17', 'c++2a', 'c++23'],
        defaultValue: 'c++2a',
        displayName: 'C++ Standard',
      },
    ],
  },
  {
    lang: 'ruby',
    displayName: 'Ruby',
    options: [],
  },
  {
    lang: 'clay',
    displayName: 'CLay',
    options: [
      {
        key: 'std',
        type: 'enum',
        values: ['c++14', 'c++17'],
        defaultValue: 'c++14',
        displayName: 'C++ Standard (build phase)',
      },
    ],
  },
];

/** スタブ InteractiveService を作成する。ダミーデータで動作するテスト・開発用実装。 */
export function createStubInteractiveService(): InteractiveService {
  return {
    start(_lang: string, _code: string): InteractiveHandle {
      let outputHandler: ((data: InteractiveOutputChunk) => void) | null = null;
      let completeHandler:
        ((result: InteractiveCompleteResult) => void) | null = null;
      const timers: ReturnType<typeof setTimeout>[] = [];
      let disposed = false;

      // 500ms 後にダミー出力を配信
      timers.push(
        setTimeout(() => {
          if (disposed) return;
          outputHandler?.({ stream: 'stdout', data: DUMMY_INTERACTIVE_OUTPUT });
        }, 500)
      );

      return {
        onOutput(handler: (data: InteractiveOutputChunk) => void): void {
          outputHandler = handler;
        },
        onComplete(handler: (result: InteractiveCompleteResult) => void): void {
          completeHandler = handler;
        },
        writeStdin(data: string): void {
          if (disposed) return;
          // エコーバック
          outputHandler?.({ stream: 'stdout', data: data + '\n' });
        },
        closeStdin(): void {
          if (disposed) return;
          // 300ms 後に完了
          timers.push(
            setTimeout(() => {
              if (disposed) return;
              completeHandler?.({ exitStatus: 0, timeMs: 800 });
            }, 300)
          );
        },
        kill(): void {
          if (disposed) return;
          timers.forEach(clearTimeout);
          completeHandler?.({ exitStatus: -1, timeMs: 0 });
        },
        dispose(): void {
          disposed = true;
          timers.forEach(clearTimeout);
        },
      };
    },
  };
}

/** スタブ MultiStdioService を作成する。ダミーデータで動作するテスト・開発用実装。 */
export function createStubMultiStdioService(): MultiStdioService {
  return {
    run(_lang: string, _code: string, stdinList: string[]): MultiStdioHandle {
      let buildHandler: ((result: BuildPhaseResult) => void) | null = null;
      let runHandler: ((result: MultiRunResult) => void) | null = null;
      let completeHandlerFn: (() => void) | null = null;
      const timers: ReturnType<typeof setTimeout>[] = [];
      let disposed = false;

      // 200ms 後にビルド結果を配信
      timers.push(
        setTimeout(() => {
          if (disposed) return;
          buildHandler?.({
            phase: 'build',
            exitStatus: 0,
            timeMs: 50,
            stdout: '',
            stderr: '',
          });

          // その後 stdin ごとに 100ms 間隔で結果を配信
          stdinList.forEach((_, index) => {
            timers.push(
              setTimeout(
                () => {
                  if (disposed) return;
                  runHandler?.({
                    stdinIndex: index,
                    exitStatus: 0,
                    timeMs: 20 + index * 10,
                    stdout: `stub output for stdin #${index + 1}`,
                    stderr: '',
                  });

                  // 最後の stdin の結果後に complete
                  if (index === stdinList.length - 1) {
                    timers.push(
                      setTimeout(() => {
                        if (disposed) return;
                        completeHandlerFn?.();
                      }, 50)
                    );
                  }
                },
                (index + 1) * 100
              )
            );
          });
        }, 200)
      );

      return {
        onBuildResult(handler: (result: BuildPhaseResult) => void): void {
          buildHandler = handler;
        },
        onRunResult(handler: (result: MultiRunResult) => void): void {
          runHandler = handler;
        },
        onComplete(handler: () => void): void {
          completeHandlerFn = handler;
        },
        kill(): void {
          if (disposed) return;
          timers.forEach(clearTimeout);
        },
        dispose(): void {
          disposed = true;
          timers.forEach(clearTimeout);
        },
      };
    },
  };
}

/** スタブ LangInfoService を作成する。ダミーデータで動作するテスト・開発用実装。 */
export function createStubLangInfoService(): LangInfoService {
  return {
    fetchLangInfo(): Promise<LangInfo[]> {
      return Promise.resolve(DUMMY_LANG_INFO);
    },
    fetchLangVersion(lang: string): Promise<LangVersionResult> {
      return new Promise((resolve) => {
        setTimeout(() => {
          const version = DUMMY_VERSION_MAP[lang] || `(stub) ${lang} unknown`;
          resolve({ version, error: '' });
        }, 300);
      });
    },
  };
}
