import { atom } from 'jotai';
import {
  ExecResult,
  StoredExecResult,
  TrackedTask,
  TaskStatusEntry,
  RegisterTaskParams,
  AddPhaseBadgeParams,
  UpdateTaskPhaseParams,
  PhaseStatus,
} from './status/types';

export const resultsAtom = atom<StoredExecResult[]>([]);
export const activatedResultIndexAtom = atom<number | null>(null);
const nextResultIdAtom = atom(0);

/**
 * 結果追加の write-only atom。
 * results 追加 + activatedResultIndex 更新 + nextResultId インクリメントを
 * 不可分に実行する。
 */
export const addResultAtom = atom(null, (get, set, result: ExecResult) => {
  const id = get(nextResultIdAtom);
  const results = get(resultsAtom);
  set(resultsAtom, [...results, { ...result, id }]);
  set(activatedResultIndexAtom, results.length);
  set(nextResultIdAtom, id + 1);
});

/**
 * 全結果クリアの write-only atom。
 * nextResultId はリセットしない（ID の一意性を保証するため）。
 */
export const clearResultsAtom = atom(null, (_get, set) => {
  set(activatedResultIndexAtom, null);
  set(resultsAtom, []);
});

/** activatedResultIndex を直接設定する write-only atom */
export const activateResultAtom = atom(null, (_get, set, index: number) => {
  set(activatedResultIndexAtom, index);
});

/** アクティブな結果の errlog を取得する derived atom */
export const activeErrlogAtom = atom((get) => {
  const index = get(activatedResultIndexAtom);
  const results = get(resultsAtom);
  if (index === null || index >= results.length) return '';
  return results[index].log;
});

// --- 新しいステータス管理 atom ---

/** PhaseStatus をバッジ色文字列に変換する */
export function phaseStatusToColor(status: PhaseStatus): string {
  switch (status) {
    case 'success':
      return 'success';
    case 'error':
      return 'red';
    case 'warning':
      return 'warning';
    case 'started':
      return 'light';
  }
}

/** タスク ID のカウンター */
const nextTaskIdAtom = atom(1);

/** 追跡中タスク一覧 */
export const trackedTasksAtom = atom<TrackedTask[]>([]);

/** タスク結果の蓄積 */
export const taskResultsAtom = atom<TaskStatusEntry[]>([]);

/** アクティブなタスクのインデックス */
export const activeTaskIndexAtom = atom<number | null>(null);

/** アクティブなバッジのインデックス（タスク内での位置）。null は未選択 */
export const activeBadgeIndexAtom = atom<number | null>(null);

/**
 * タスクタイプごとの最新 taskId。
 * registerTaskAtom が呼ばれるたびに、対応するタイプを上書き更新する。
 * null はそのタイプのタスクが未登録であることを示す。
 */
export const latestTaskIdByTypeAtom = atom<
  Record<'single' | 'multi' | 'interactive', number | null>
>({
  single: null,
  multi: null,
  interactive: null,
});

/**
 * PanelGroup で現在選択されているタブキー。
 * 初期値は pages/index.tsx の tabs[0].key（'file stdio'）と一致させること。
 * タブの並び順変更時は初期値も同期して変更する必要がある。
 */
export const activePanelTabAtom = atom<string>('file stdio');

/**
 * タスク登録の write-only atom。
 * TrackedTask を追加し、初期状態の TaskStatusEntry を taskResultsAtom に追加する。
 * 登録された taskId を返す。
 */
export const registerTaskAtom = atom(
  null,
  (get, set, params: RegisterTaskParams): number => {
    const taskId = get(nextTaskIdAtom);
    set(nextTaskIdAtom, taskId + 1);

    const tracked: TrackedTask = {
      taskId,
      clicmid: params.clicmid,
      type: params.type,
    };
    set(trackedTasksAtom, [...get(trackedTasksAtom), tracked]);

    const entry: TaskStatusEntry = {
      taskId,
      type: params.type,
      phase: 'running',
      badges: [],
    };
    const results = get(taskResultsAtom);
    set(taskResultsAtom, [...results, entry]);
    set(activeTaskIndexAtom, results.length);
    set(activeBadgeIndexAtom, null);

    // タイプごとの最新 taskId を更新
    const prev = get(latestTaskIdByTypeAtom);
    set(latestTaskIdByTypeAtom, { ...prev, [params.type]: taskId });

    return taskId;
  }
);

/**
 * フェーズバッジ追加の write-only atom。
 * taskId で特定したエントリの badges 末尾にバッジを追加する。
 */
export const addPhaseBadgeAtom = atom(
  null,
  (get, set, params: AddPhaseBadgeParams) => {
    const results = get(taskResultsAtom);
    const index = results.findIndex((r) => r.taskId === params.taskId);
    if (index === -1) return;

    const updated = {
      ...results[index],
      badges: [...results[index].badges, params.badge],
    };
    const newResults = [...results];
    newResults[index] = updated;
    set(taskResultsAtom, newResults);
  }
);

/**
 * タスクフェーズ更新の write-only atom。
 * taskId で特定したエントリの phase のみを更新する。
 */
export const updateTaskPhaseAtom = atom(
  null,
  (get, set, params: UpdateTaskPhaseParams) => {
    const results = get(taskResultsAtom);
    const index = results.findIndex((r) => r.taskId === params.taskId);
    if (index === -1) return;

    const updated = { ...results[index], phase: params.phase };
    const newResults = [...results];
    newResults[index] = updated;
    set(taskResultsAtom, newResults);
  }
);

/** 全タスク結果クリアの write-only atom。明示的なユーザ操作時のみ使用する。 */
export const clearTaskResultsAtom = atom(null, (_get, set) => {
  set(trackedTasksAtom, []);
  set(taskResultsAtom, []);
  set(activeTaskIndexAtom, null);
  set(activeBadgeIndexAtom, null);
  set(latestTaskIdByTypeAtom, { single: null, multi: null, interactive: null });
});

/**
 * アクティブなタスクの errlog を取得する derived atom。
 * 常に最新の single タイプタスクの errlog を返す。
 * StaticIOShell が file stdio の実行結果として表示する。
 */
export const activeTaskErrlogAtom = atom((get) => {
  const latestByType = get(latestTaskIdByTypeAtom);
  const singleId = latestByType['single'];
  if (singleId === null) return '';
  const results = get(taskResultsAtom);
  const entry = results.find((r) => r.taskId === singleId);
  if (!entry) return '';
  // 最後のバッジから順に stderr の details を探す
  for (let i = entry.badges.length - 1; i >= 0; i--) {
    const details = entry.badges[i].details;
    if (!details) continue;
    for (const d of details) {
      if (d.type === 'text' && d.title === 'stderr') {
        return d.text;
      }
    }
  }
  return '';
});

/** activeTaskIndex を直接設定する write-only atom */
export const activateTaskAtom = atom(null, (_get, set, index: number) => {
  set(activeTaskIndexAtom, index);
});
