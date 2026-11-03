import { QueryInitInfo } from '../../interfaces/query-types';

/** 言語タスクの実行ライフサイクルを表すインターフェース */
export interface TaskInterface {
  /** 実行中のタスクを強制停止する */
  kill(): void;
  /** タスクの実行を非同期に開始する */
  startAsync(data: QueryInitInfo): Promise<void>;
}
