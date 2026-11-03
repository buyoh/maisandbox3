import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import {
  MultiStdioService,
  MultiStdioHandle,
} from '../services/service-interfaces';
import { codeAtom, langAtom } from '../stores/code-editor-atoms';
import {
  stdinListAtom,
  multiBuildResultAtom,
  multiRunResultsAtom,
  multiRunningAtom,
} from '../stores/multi-stdio-atoms';
import {
  registerTaskAtom,
  addPhaseBadgeAtom,
  updateTaskPhaseAtom,
} from '../stores/status-atoms';

/** useMultiTaskExecution フックの戻り値 */
export interface UseMultiTaskExecutionReturn {
  run(): void;
  kill(): void;
  running: boolean;
}

/**
 * Multi-stdio 実行のカスタムフック。
 * サービスを引数で受け取り、実行・kill・状態を管理する。
 * ステータスバーへの結果書き込みは addPhaseBadgeAtom / updateTaskPhaseAtom を直接操作する。
 */
export function useMultiTaskExecution(
  service: MultiStdioService
): UseMultiTaskExecutionReturn {
  const handleRef = useRef<MultiStdioHandle | null>(null);
  const taskIdRef = useRef<number | null>(null);
  const code = useAtomValue(codeAtom);
  const lang = useAtomValue(langAtom);
  const stdinList = useAtomValue(stdinListAtom);
  const setBuildResult = useSetAtom(multiBuildResultAtom);
  const setRunResults = useSetAtom(multiRunResultsAtom);
  const setRunning = useSetAtom(multiRunningAtom);
  const running = useAtomValue(multiRunningAtom);
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
    // 前回のハンドルを破棄
    handleRef.current?.dispose();
    handleRef.current = null;

    // 結果クリア
    setBuildResult(null);
    setRunResults([]);
    setRunning(true);

    // ステータスバー用にタスク登録
    const taskId = registerTask({ clicmid: null, type: 'multi' });
    taskIdRef.current = taskId;

    const totalCount = stdinList.length;
    let passedCount = 0;
    let runCount = 0;
    let buildFailed = false;

    const handle = service.run(lang, code, stdinList);
    handleRef.current = handle;

    handle.onBuildResult((result) => {
      setBuildResult(result);
      // taskId をクロージャでキャプチャし stale ref を回避する
      const exitOk = result.exitStatus === 0;
      store.set(addPhaseBadgeAtom, {
        taskId,
        badge: {
          phase: result.phase,
          status: exitOk ? 'success' : 'error',
          label: exitOk
            ? `${capitalize(result.phase)}`
            : `${capitalize(result.phase)} (exit=${result.exitStatus})`,
          details:
            result.stderr
              ? [{ type: 'text' as const, title: 'stderr', text: result.stderr }]
              : null,
        },
      });
      if (!exitOk) {
        buildFailed = true;
        store.set(updateTaskPhaseAtom, { taskId, phase: 'failed' });
      }
    });

    handle.onRunResult((result) => {
      setRunResults((prev) => [...prev, result]);
      if (result.exitStatus === 0) passedCount++;
      runCount++;
      const exitOk = result.exitStatus === 0;
      store.set(addPhaseBadgeAtom, {
        taskId,
        badge: {
          phase: 'run',
          status: exitOk ? 'success' : 'warning',
          label: exitOk
            ? `Run ${runCount}`
            : `Run ${runCount} (exit=${result.exitStatus})`,
          details:
            result.stderr
              ? [{ type: 'text' as const, title: 'stderr', text: result.stderr }]
              : null,
        },
      });
    });

    handle.onComplete(() => {
      handleRef.current = null;
      setRunning(false);

      if (buildFailed) {
        // ビルド失敗時は summary バッジを追加しない（build バッジで表現済み）
        taskIdRef.current = null;
        return;
      }

      const allPassed = passedCount === totalCount;
      store.set(addPhaseBadgeAtom, {
        taskId,
        badge: {
          phase: 'summary',
          status: allPassed ? 'success' : 'warning',
          label: `${passedCount}/${totalCount} passed`,
          details: null,
        },
      });
      store.set(updateTaskPhaseAtom, {
        taskId,
        phase: allPassed ? 'completed' : 'failed',
      });
      taskIdRef.current = null;
    });
  }, [
    service,
    lang,
    code,
    stdinList,
    setBuildResult,
    setRunResults,
    setRunning,
    registerTask,
    store,
  ]);

  const kill = useCallback(() => {
    handleRef.current?.kill();
    handleRef.current = null;
    setRunning(false);
    if (taskIdRef.current !== null) {
      store.set(addPhaseBadgeAtom, {
        taskId: taskIdRef.current,
        badge: {
          phase: 'killed',
          status: 'error',
          label: 'Killed',
          details: null,
        },
      });
      store.set(updateTaskPhaseAtom, {
        taskId: taskIdRef.current,
        phase: 'killed',
      });
      taskIdRef.current = null;
    }
  }, [setRunning, store]);

  return { run, kill, running };
}

/** 文字列の先頭を大文字にする */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
