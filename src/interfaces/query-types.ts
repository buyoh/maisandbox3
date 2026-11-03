import { ClientJobID } from './id-types';

/** ファイル+標準入力でコードを実行するクエリ情報 */
export interface QueryInitInfoFileStdin {
  type: 'filestdin';
  code: string;
  stdin: string;
}

/** 複数の標準入力に対してビルド1回+実行N回を行うクエリ情報 */
export interface QueryInitInfoMultiStdin {
  type: 'multistdin';
  code: string;
  /** 複数の標準入力テキスト。各要素が1回の run に対応する。 */
  stdinList: string[];
}

/** クエリ実行情報の全バリエーション */
export type QueryInitInfo = QueryInitInfoFileStdin | QueryInitInfoMultiStdin;

/** runSingleTask イベントのリクエストデータ */
export interface RunSingleTaskRequest {
  /** クライアントがコールバックを識別するための ID。未指定の場合サーバはエラーを返す */
  id?: ClientJobID;
  lang: string;
  info: QueryInitInfo;
  /** 言語オプション。省略時はサーバ側でデフォルト値が適用される。 */
  options?: Record<string, string>;
}

/** kill イベントのリクエストデータ */
export interface KillRequest {
  /** 停止対象のタスクを特定する ID。未指定の場合は何も行わない */
  id?: ClientJobID;
}

// --- Interactive Mode ---

/** インタラクティブ実行のリクエスト */
export interface RunInteractiveTaskRequest {
  id?: ClientJobID;
  lang: string;
  code: string;
  /** 言語オプション。省略時はデフォルト。 */
  options?: Record<string, string>;
}

/** インタラクティブ stdin 送信リクエスト */
export interface InteractiveStdinRequest {
  id?: ClientJobID;
  data: string;
}

/** インタラクティブ stdin 終了リクエスト */
export interface InteractiveCloseStdinRequest {
  id?: ClientJobID;
}

// --- deprecated aliases ---

/** @deprecated RunSingleTaskRequest を使用 */
export type QueryInit = RunSingleTaskRequest;
/** @deprecated KillRequest を使用 */
export type QueryKill = KillRequest;
/** @deprecated RunSingleTaskRequest | KillRequest を使用 */
export type Query = RunSingleTaskRequest | KillRequest;
