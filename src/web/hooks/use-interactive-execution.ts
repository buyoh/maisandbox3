import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import {
  InteractiveService,
  InteractiveHandle,
} from '../services/service-interfaces';
import { codeAtom, langAtom } from '../stores/code-editor-atoms';
import {
  interactiveRunningAtom,
  interactiveStdinClosedAtom,
  interactiveInputAtom,
  appendInteractiveOutputAtom,
  clearInteractiveOutputAtom,
} from '../stores/interactive-atoms';
import {
  registerTaskAtom,
  addPhaseBadgeAtom,
  updateTaskPhaseAtom,
} from '../stores/status-atoms';

/** useInteractiveExecution フックの戻り値 */
export interface UseInteractiveExecutionReturn {
  run(): void;
  kill(): void;
  flush(): void;
  closeStdin(): void;
  running: boolean;
  stdinClosed: boolean;
}

/**
 * インタラクティブ実行のカスタムフック。
 * サービスを引数で受け取り、実行・入力送信・終了を管理する。
 */
export function useInteractiveExecution(
  service: InteractiveService
): UseInteractiveExecutionReturn {
  const handleRef = useRef<InteractiveHandle | null>(null);
  const taskIdRef = useRef<number | null>(null);
  const code = useAtomValue(codeAtom);
  const lang = useAtomValue(langAtom);
  const input = useAtomValue(interactiveInputAtom);
  const setInput = useSetAtom(interactiveInputAtom);
  const setRunning = useSetAtom(interactiveRunningAtom);
  const setStdinClosed = useSetAtom(interactiveStdinClosedAtom);
  const appendOutput = useSetAtom(appendInteractiveOutputAtom);
  const clearOutput = useSetAtom(clearInteractiveOutputAtom);
  const running = useAtomValue(interactiveRunningAtom);
  const stdinClosed = useAtomValue(interactiveStdinClosedAtom);
  const registerTask = useSetAtom(registerTaskAtom);
  const store = useStore();

  // アンマウント時にリソースを解放
  useEffect(() => {
    return () => {
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  const run = useCallback(() => {
    // 前回のハンドルを破棄（dispose がコールバックをクリアするより先に taskId をクリアして競合を防ぐ）
    taskIdRef.current = null;
    handleRef.current?.dispose();
    handleRef.current = null;

    clearOutput();
    setRunning(true);
    setStdinClosed(false);

    // ステータスバー用にタスクを登録
    const taskId = registerTask({ clicmid: null, type: 'interactive' });
    taskIdRef.current = taskId;

    const handle = service.start(lang, code);
    handleRef.current = handle;

    handle.onOutput((chunk) => {
      const prefix = chunk.stream === 'stderr' ? '[stderr] ' : '';
      appendOutput(prefix + chunk.data);
    });

    handle.onBuildResult((result) => {
      const currentTaskId = taskIdRef.current;
      if (currentTaskId === null) return;
      const exitOk = result.exitStatus === 0;
      store.set(addPhaseBadgeAtom, {
        taskId: currentTaskId,
        badge: {
          phase: result.phase,
          status: exitOk ? 'success' : 'error',
          label: exitOk
            ? capitalize(result.phase)
            : `${capitalize(result.phase)} (exit=${result.exitStatus})`,
          details: result.details,
        },
      });
      if (!exitOk) {
        store.set(updateTaskPhaseAtom, { taskId: currentTaskId, phase: 'failed' });
        // ビルド失敗時は complete バッジを追加しない
        taskIdRef.current = null;
      }
    });

    handle.onComplete((result) => {
      handle.dispose();
      handleRef.current = null;
      setRunning(false);
      const currentTaskId = taskIdRef.current;
      if (currentTaskId === null) return;
      taskIdRef.current = null;
      const isKilled = result.phase === 'killed';
      // phase が 'completed' でも未設定でもない場合はシステムエラー（failed イベント等）
      const isNormalComplete = result.phase === 'completed' || result.phase == null;
      if (isKilled) {
        // サーバ起因の強制終了（タイムアウト等）
        store.set(addPhaseBadgeAtom, {
          taskId: currentTaskId,
          badge: { phase: 'killed', status: 'error', label: 'Killed', details: null },
        });
        store.set(updateTaskPhaseAtom, { taskId: currentTaskId, phase: 'killed' });
      } else if (!isNormalComplete) {
        // サーバ起因のシステムエラー（ランナー起動失敗等）
        store.set(addPhaseBadgeAtom, {
          taskId: currentTaskId,
          badge: { phase: result.phase!, status: 'error', label: 'Failed', details: null },
        });
        store.set(updateTaskPhaseAtom, { taskId: currentTaskId, phase: 'failed' });
      } else {
        const exitOk = result.exitStatus === 0;
        store.set(addPhaseBadgeAtom, {
          taskId: currentTaskId,
          badge: {
            phase: 'completed',
            status: exitOk ? 'success' : 'warning',
            label: exitOk ? 'Completed' : `Completed (exit=${result.exitStatus})`,
            details: null,
          },
        });
        store.set(updateTaskPhaseAtom, {
          taskId: currentTaskId,
          phase: exitOk ? 'completed' : 'failed',
        });
      }
    });
  }, [
    service,
    lang,
    code,
    clearOutput,
    setRunning,
    setStdinClosed,
    appendOutput,
    registerTask,
    store,
  ]);

  const kill = useCallback(() => {
    const currentTaskId = taskIdRef.current;
    // onComplete が kill 後に呼ばれても badge を追加しないよう先にクリアする
    taskIdRef.current = null;
    const handle = handleRef.current;
    handleRef.current = null;
    handle?.kill();
    handle?.dispose();
    setRunning(false);
    if (currentTaskId !== null) {
      store.set(addPhaseBadgeAtom, {
        taskId: currentTaskId,
        badge: {
          phase: 'killed',
          status: 'error',
          label: 'Killed',
          details: null,
        },
      });
      store.set(updateTaskPhaseAtom, {
        taskId: currentTaskId,
        phase: 'killed',
      });
    }
  }, [store, setRunning]);

  const flush = useCallback(() => {
    if (!handleRef.current || !input) return;
    handleRef.current.writeStdin(input);
    setInput('');
  }, [input, setInput]);

  const closeStdin = useCallback(() => {
    if (!handleRef.current) return;
    handleRef.current.closeStdin();
    setStdinClosed(true);
  }, [setStdinClosed]);

  return { run, kill, flush, closeStdin, running, stdinClosed };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
