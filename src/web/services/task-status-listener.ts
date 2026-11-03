import { createStore } from 'jotai';
import { SocketInterface } from './client-socket';
import { parseTaskResult } from './parse-task-result';
import { ParsedTaskResult } from './parse-task-result';
import {
  trackedTasksAtom,
  taskResultsAtom,
  addPhaseBadgeAtom,
  updateTaskPhaseAtom,
} from '../stores/status-atoms';
import { PhaseBadge, PhaseStatus, TaskPhase, TrackedTask } from '../stores/status/types';

type JotaiStore = ReturnType<typeof createStore>;

/**
 * Socket のタスク結果イベントを購読し、trackedTasks に登録されたタスクの
 * 結果を status-atoms に書き込むリスナー。
 * ClientSocket とは独立したクラスで、ソケットの生データを受信する。
 *
 * 二重購読に関する注記:
 * ClientSocket のコンストラクタと本クラスの両方が onTaskResult を購読する。
 * - ClientSocket 経由: stdout / annotations の処理
 * - 本クラス経由: ステータスバー用のバッジ書き込み
 */
export class TaskStatusListener {
  private store: JotaiStore;
  private attached: boolean = false;

  constructor(store: JotaiStore) {
    this.store = store;
  }

  /**
   * SocketInterface のイベントを購読開始する。
   * socket の onTaskResult を listen し、trackedTasksAtom に登録済みの
   * clicmid に一致するイベントのみ処理する。
   */
  attach(socket: SocketInterface): void {
    if (this.attached) return;
    this.attached = true;

    socket.onTaskResult((data) => {
      // detach 後はイベントを無視する
      if (!this.attached) return;

      const clicmid = data.id?.clicmid;
      if (clicmid === undefined) return;

      const tracked = this.store.get(trackedTasksAtom);
      const task = tracked.find(
        (t) => t.type === 'single' && t.clicmid === clicmid
      );
      if (!task) return;

      const parsed = parseTaskResult(data);
      this.handleParsedResult(task, parsed);
    });
  }

  /** イベント購読を停止する（現在の SocketInterface は off をサポートしないため no-op） */
  detach(): void {
    this.attached = false;
  }

  /**
   * 解析済み結果を処理し、適切なバッジ追加・フェーズ更新を行う。
   *
   * - phaseName === 'completed' → "Completed" バッジを追加し phase を completed に更新
   * - isFinalError かつバッジが存在しない → 失敗バッジを追加し phase を failed に更新
   * - isFinalError かつバッジが存在する（ビルドエラー後の failed イベント）→ phase のみ failed に更新
   * - それ以外 → フェーズバッジを追加（phase は更新しない）
   */
  private handleParsedResult(task: TrackedTask, parsed: ParsedTaskResult): void {
    const phaseName =
      parsed.phase ?? this.extractPhaseName(parsed.summary);
    const isFinalError =
      !parsed.continues && parsed.status === 'error';

    if (phaseName === 'completed' && !parsed.continues) {
      const badge: PhaseBadge = {
        phase: 'completed',
        status: 'success',
        label: 'Completed',
        details: parsed.details,
      };
      this.store.set(addPhaseBadgeAtom, { taskId: task.taskId, badge });
      this.store.set(updateTaskPhaseAtom, { taskId: task.taskId, phase: 'completed' });
    } else if (isFinalError) {
      // failed イベント: バッジが未追加の場合のみバッジを作成（タイムアウト等）
      const entry = this.store
        .get(taskResultsAtom)
        .find((r) => r.taskId === task.taskId);
      const hasBadges = (entry?.badges.length ?? 0) > 0;
      if (!hasBadges) {
        const label = phaseName
          ? this.capitalize(phaseName)
          : parsed.summary || 'Failed';
        const badge: PhaseBadge = {
          phase: phaseName ?? 'failed',
          status: 'error',
          label,
          details: parsed.details,
        };
        this.store.set(addPhaseBadgeAtom, { taskId: task.taskId, badge });
      }
      this.store.set(updateTaskPhaseAtom, { taskId: task.taskId, phase: 'failed' });
    } else if (phaseName) {
      // 通常フェーズ結果: バッジを追加（phase は running のまま）
      const badge: PhaseBadge = {
        phase: phaseName,
        status: this.mapStatus(parsed.status),
        label: this.capitalize(phaseName),
        details: parsed.details,
      };
      this.store.set(addPhaseBadgeAtom, { taskId: task.taskId, badge });
    }
  }

  /**
   * summary 文字列からフェーズ名を抽出する。
   * - "result(build)" → "build"
   * - "completed" → "completed"
   * - その他 → null（フォールバック不可）
   */
  private extractPhaseName(summary: string): string | null {
    if (summary === 'completed') return 'completed';
    const match = summary.match(/^result\((\w+)\)$/);
    if (match) return match[1];
    return null;
  }

  /** サーバ側ステータス文字列を PhaseStatus に変換する */
  private mapStatus(status: string): PhaseStatus {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
      case 'red':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'started';
    }
  }

  /** 文字列の先頭を大文字にする */
  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
