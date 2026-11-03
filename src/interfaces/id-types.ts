/** クライアントがサーバとのコールバックを識別するための ID */
export interface ClientJobID {
  /** クライアント側で採番されるコールバック管理 ID。未指定の場合コールバックの紐付けができない */
  clicmid?: number;
}

/** サーバが Launcher とのコールバックを識別するための ID */
export interface LauncherQueryID {
  /** Launcher コールバック管理 ID。未指定の場合は未割り当て状態を示す */
  request_id?: string;
}
