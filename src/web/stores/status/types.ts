import type { ReportItem } from '../../../interfaces/result-types';

/** タスク実行結果の表示データ。StatusBar と StatusDetail に渡される。 */
export interface ExecResult {
  color: string;
  summary: string;
  log: string;
  details: ReportItem[] | null;
}

/** ExecResult にストア内で一意な ID を付与した型 */
export type StoredExecResult = ExecResult & { id: number };

// --- 新しいステータス管理の型 ---

/** フェーズの進行状態 */
export type PhaseStatus = 'started' | 'success' | 'error' | 'warning';

/**
 * 個別フェーズのバッジデータ。
 * TaskStatusEntry.badges の各要素として時系列順に蓄積される。
 */
export interface PhaseBadge {
  /** フェーズ名（例: "build", "run", "completed"） */
  phase: string;
  /** バッジの状態 */
  status: PhaseStatus;
  /** 表示用テキスト（例: "Build", "Run (exit=1)"） */
  label: string;
  /**
   * 詳細レポート項目。展開時に表示される。
   * stdout ('out') は含めず、stderr ('log'→'text'), 'param', 'text' のみ保持する。
   * undefined の場合は詳細情報なし。
   */
  details: ReportItem[] | null;
}

/** 追跡中タスクの登録情報。実行フックが登録する。 */
export interface TrackedTask {
  /** ストア内で一意なタスク識別子 */
  taskId: number;
  /** ClientSocket 側の clicmid（socket イベントの紐付けに使用）。multi / interactive 時は未使用 */
  clicmid: number | null;
  /** タスクの種類 */
  type: 'single' | 'multi' | 'interactive';
}

/** タスクの進行状態 */
export type TaskPhase = 'running' | 'completed' | 'failed' | 'killed';

/**
 * タスクの状態エントリ。
 * 実行フックが registerTaskAtom で登録し、各イベントで addPhaseBadgeAtom を通じて更新する。
 */
export interface TaskStatusEntry {
  /** ストア内で一意なタスク識別子 */
  taskId: number;
  /** タスクの種類 */
  type: 'single' | 'multi' | 'interactive';
  /** 全体の進行状態 */
  phase: TaskPhase;
  /** フェーズごとのバッジ一覧（時系列順）。実行開始直後は空配列 */
  badges: PhaseBadge[];
}

/** registerTaskAtom に渡す引数 */
export interface RegisterTaskParams {
  /** 単一タスクの場合は clicmid を指定。multi / interactive は null */
  clicmid: number | null;
  type: 'single' | 'multi' | 'interactive';
}

/** addPhaseBadgeAtom に渡す引数 */
export interface AddPhaseBadgeParams {
  taskId: number;
  badge: PhaseBadge;
}

/** updateTaskPhaseAtom に渡す引数 */
export interface UpdateTaskPhaseParams {
  taskId: number;
  phase: TaskPhase;
}
