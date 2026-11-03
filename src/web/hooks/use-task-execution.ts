import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import { stdinAtom, stdoutAtom } from '../stores/static-io-atoms';
import {
  registerTaskAtom,
  addPhaseBadgeAtom,
  updateTaskPhaseAtom,
} from '../stores/status-atoms';
import {
  codeAtom,
  langAtom,
  addAnnotationsAtom,
  clearAnnotationsAtom,
} from '../stores/code-editor-atoms';
import type { QueryInitInfoFileStdin } from '../../interfaces/query-types';
import type { TaskResult } from '../../interfaces/result-types';
import { ClientSocket } from '../services/client-socket';
import type { TaskHandle } from '../services/client-socket';
import { parseTaskResult } from '../services/parse-task-result';

/** useTaskExecution フックの戻り値。タスクの実行・停止・状態を提供する */
export interface UseTaskExecutionReturn {
  /** タスクを実行する。socket 未接続時は何もしない */
  run(): void;
  /** 実行中タスクを kill する */
  kill(): void;
  /** タスク実行中かどうか */
  running: boolean;
}

/**
 * タスクの実行・kill・結果処理を担うカスタムフック。
 * Socket 経由でタスクを実行し、結果を各 atom に振り分ける。
 * ステータスバーへの結果書き込みは TaskStatusListener が担当するため、
 * 本フックは stdout / annotations の更新のみ行う。
 */
export function useTaskExecution(
  socket: ClientSocket | null
): UseTaskExecutionReturn {
  const stdin = useAtomValue(stdinAtom);
  const code = useAtomValue(codeAtom);
  const lang = useAtomValue(langAtom);
  const setStdout = useSetAtom(stdoutAtom);
  const registerTask = useSetAtom(registerTaskAtom);
  const addAnnotations = useSetAtom(addAnnotationsAtom);
  const clearAnnotations = useSetAtom(clearAnnotationsAtom);
  const store = useStore();

  const taskHandleRef = useRef<TaskHandle | null>(null);
  const taskIdRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);

  // アンマウント時にタスクを停止してリソースリークを防ぐ
  useEffect(() => {
    return () => {
      taskHandleRef.current?.kill();
      taskHandleRef.current = null;
    };
  }, []);

  const processResult = useCallback(
    (data: TaskResult): void => {
      const parsed = parseTaskResult(data);

      if (!parsed.continues) {
        taskHandleRef.current = null;
        setRunning(false);
      }

      if (parsed.stdout !== null) {
        setStdout(parsed.stdout);
      }

      if (parsed.annotations.length > 0) {
        addAnnotations(parsed.annotations);
      }
    },
    [setStdout, addAnnotations]
  );

  const run = useCallback(() => {
    if (socket === null) return;

    // 前回タスクが残っている場合は kill してリークを防ぐ
    taskHandleRef.current?.kill();
    taskHandleRef.current = null;

    clearAnnotations();

    const info: QueryInitInfoFileStdin = {
      type: 'filestdin',
      code,
      stdin,
    };

    const handle = socket.runSingleTask({ lang, info }, processResult);
    taskHandleRef.current = handle;

    // ステータスバー用にタスクを登録（表示は TaskStatusListener が担当）
    const taskId = registerTask({ clicmid: handle.clicmid, type: 'single' });
    taskIdRef.current = taskId;
    setRunning(true);
  }, [
    socket,
    code,
    stdin,
    lang,
    clearAnnotations,
    processResult,
    registerTask,
  ]);

  const kill = useCallback(() => {
    taskHandleRef.current?.kill();
    taskHandleRef.current = null;
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
  }, [store]);

  return { run, kill, running };
}
