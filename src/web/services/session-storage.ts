/**
 * マルチセッション localStorage バックアップのセッション管理ロジック。
 * 各サービス関数は Storage オブジェクトを引数で受け取り、
 * デフォルトは window.localStorage を使用する。
 * エラーは戻り値 null で返す。QuotaExceededError 等のシステムエラーのみ例外として伝搬する。
 */

/** セッション一覧のメタ情報。msb3-sessions に保存される。 */
export interface SessionIndex {
  sessions: SessionMeta[];
}

/** セッション1件分のメタ情報 */
export interface SessionMeta {
  id: string;
  /** セッション作成時刻（Date.now() の number 値） */
  createdAt: number;
  /** 最終保存時刻（Date.now() の number 値）。LRU 削除の基準 */
  updatedAt: number;
  /** ユーザーが識別しやすいラベル（自動生成: 言語名 + 日時）。作成時のスナップショット */
  label: string;
}

/** セッション本体データ。msb3-session-{id} に保存される。 */
export interface SessionData {
  codeEditorShell: {
    code: string;
    lang: string;
  };
}

const KEY_INDEX = 'msb3-sessions';
const KEY_SESSION_PREFIX = 'msb3-session-';
const KEY_OLD_BACKUP = 'msb3-backup';
const MAX_SESSIONS = 10;
const MAX_QUOTA_RETRY = 3;

// --- ユーティリティ ---

/** UUID v4 を生成する。Secure Context では crypto.randomUUID を使用し、非対応環境はフォールバック */
export function generateUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // フォールバック: crypto.getRandomValues ベースの UUID v4
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40;
  arr[8] = (arr[8] & 0x3f) | 0x80;
  return [...arr]
    .map((b, i) =>
      [4, 6, 8, 10].includes(i)
        ? '-' + b.toString(16).padStart(2, '0')
        : b.toString(16).padStart(2, '0')
    )
    .join('');
}

/** localStorage から JSON を読み込む。失敗時は null */
function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** localStorage に JSON を書き込む */
function writeJson<T>(storage: Storage, key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value));
}

// --- セッションインデックス操作 ---

/** SessionIndex を読み込む。存在しない / 壊れた場合は空インデックスを返す */
export function readSessionIndex(storage: Storage): SessionIndex {
  const parsed = readJson<SessionIndex>(storage, KEY_INDEX);
  if (parsed && Array.isArray(parsed.sessions)) {
    return parsed;
  }
  return { sessions: [] };
}

/** SessionIndex を書き込む */
function writeSessionIndex(storage: Storage, index: SessionIndex): void {
  writeJson(storage, KEY_INDEX, index);
}

// --- セッションデータ操作 ---

/** セッションデータを読み込む。存在しない / 壊れた場合は null */
export function readSessionData(
  storage: Storage,
  sessionId: string
): SessionData | null {
  return readJson<SessionData>(storage, KEY_SESSION_PREFIX + sessionId);
}

/** セッションデータを書き込む */
function writeSessionData(
  storage: Storage,
  sessionId: string,
  data: SessionData
): void {
  writeJson(storage, KEY_SESSION_PREFIX + sessionId, data);
}

/** セッションデータを削除する */
function removeSessionData(storage: Storage, sessionId: string): void {
  storage.removeItem(KEY_SESSION_PREFIX + sessionId);
}

// --- LRU 削除 ---

/**
 * インデックス内で最も古い updatedAt を持つ、自セッション以外のセッション ID を返す。
 * 見つからない場合は null。
 */
function findOldestOtherSession(
  sessions: SessionMeta[],
  currentId: string
): string | null {
  const others = sessions.filter((s) => s.id !== currentId);
  if (others.length === 0) return null;
  others.sort((a, b) => a.updatedAt - b.updatedAt);
  return others[0].id;
}

/** セッションをインデックスから削除し、データも削除する */
function evictSession(
  storage: Storage,
  index: SessionIndex,
  targetId: string
): SessionIndex {
  removeSessionData(storage, targetId);
  return {
    sessions: index.sessions.filter((s) => s.id !== targetId),
  };
}

// --- 公開 API ---

/**
 * セッションを登録またはメタ情報を更新する。
 * 上限を超える場合は最も古い他セッションを LRU 削除する。
 * 楽観的マージ: 最新のインデックスを再読み込みしてから更新する。
 *
 * @param storage - 使用する Storage オブジェクト
 * @param sessionId - 登録するセッション ID
 * @param label - 表示ラベル（新規作成時のみ使用される）
 * @param now - 現在時刻（Date.now()）
 * @returns 確定した SessionMeta
 */
export function registerSession(
  storage: Storage,
  sessionId: string,
  label: string,
  now: number
): SessionMeta {
  // 楽観的マージ: 最新インデックスを再読み込み
  let index = readSessionIndex(storage);

  const existing = index.sessions.find((s) => s.id === sessionId);
  let meta: SessionMeta;

  if (existing) {
    // updatedAt のみ更新
    meta = { ...existing, updatedAt: now };
    index = {
      sessions: index.sessions.map((s) => (s.id === sessionId ? meta : s)),
    };
  } else {
    meta = { id: sessionId, createdAt: now, updatedAt: now, label };
    // 上限チェック: 超える場合は最も古い他セッションを削除
    while (index.sessions.length >= MAX_SESSIONS) {
      const oldest = findOldestOtherSession(index.sessions, sessionId);
      if (!oldest) break;
      index = evictSession(storage, index, oldest);
    }
    index = { sessions: [...index.sessions, meta] };
  }

  writeSessionIndex(storage, index);
  return meta;
}

/**
 * セッションデータを保存し、インデックスの updatedAt を更新する。
 * QuotaExceededError 時は古いセッションを削除してリトライする（最大 MAX_QUOTA_RETRY 回）。
 *
 * @returns 保存に成功した場合 true、スキップした場合 false
 */
export function saveSession(
  storage: Storage,
  sessionId: string,
  data: SessionData,
  now: number
): boolean {
  for (let attempt = 0; attempt < MAX_QUOTA_RETRY; attempt++) {
    try {
      writeSessionData(storage, sessionId, data);

      // インデックスの updatedAt を更新（楽観的マージ）
      const index = readSessionIndex(storage);
      const updated = {
        sessions: index.sessions.map((s) =>
          s.id === sessionId ? { ...s, updatedAt: now } : s
        ),
      };
      writeSessionIndex(storage, updated);
      return true;
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        // 最も古い他セッションを削除してリトライ
        const index = readSessionIndex(storage);
        const oldest = findOldestOtherSession(index.sessions, sessionId);
        if (oldest) {
          const newIndex = evictSession(storage, index, oldest);
          writeSessionIndex(storage, newIndex);
        } else {
          // 削除対象なし → 諦める
          console.warn('[session-storage] quota exceeded, no session to evict');
          return false;
        }
      } else {
        throw e;
      }
    }
  }
  console.warn('[session-storage] quota exceeded after retries, skipping save');
  return false;
}

/** QuotaExceededError の判定 */
function isQuotaExceededError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  );
}

/**
 * セッションを削除する（インデックス + データ）。
 * 楽観的マージで最新インデックスを使用する。
 */
export function deleteSession(storage: Storage, sessionId: string): void {
  const index = readSessionIndex(storage);
  const updated = evictSession(storage, index, sessionId);
  writeSessionIndex(storage, updated);
}

/**
 * 孤立した msb3-session-* キーをクリーンアップする。
 * インデックスに存在しない msb3-session-* キーを全て削除する。
 */
export function cleanupOrphanedSessions(storage: Storage): void {
  const index = readSessionIndex(storage);
  const knownIds = new Set(index.sessions.map((s) => s.id));

  const orphanKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(KEY_SESSION_PREFIX)) {
      const id = key.slice(KEY_SESSION_PREFIX.length);
      if (!knownIds.has(id)) {
        orphanKeys.push(key);
      }
    }
  }

  for (const key of orphanKeys) {
    storage.removeItem(key);
  }
}

/**
 * 旧バックアップ（msb3-backup）を新セッション形式にマイグレーションする。
 * msb3-sessions が既に存在する場合は msb3-backup の削除のみ行う。
 *
 * @returns マイグレーションした SessionMeta（新規作成時）または null（スキップ時）
 */
export function migrateOldBackup(
  storage: Storage,
  now: number
): SessionMeta | null {
  const oldRaw = storage.getItem(KEY_OLD_BACKUP);
  if (oldRaw === null) return null;

  // 必ず旧キーを削除する
  storage.removeItem(KEY_OLD_BACKUP);

  // msb3-sessions が既に存在する場合は msb3-backup を削除するだけ
  const existingIndex = readJson<SessionIndex>(storage, KEY_INDEX);
  if (existingIndex && Array.isArray(existingIndex.sessions)) {
    return null;
  }

  // 旧データを解析
  let oldData: unknown = null;
  try {
    oldData = JSON.parse(oldRaw);
  } catch {
    // 壊れた JSON → スキップ
    return null;
  }

  const codeEditorShell =
    oldData !== null &&
    typeof oldData === 'object' &&
    'codeEditorShell' in oldData
      ? (oldData as { codeEditorShell: unknown }).codeEditorShell
      : null;

  if (
    !codeEditorShell ||
    typeof codeEditorShell !== 'object' ||
    !('code' in codeEditorShell) ||
    !('lang' in codeEditorShell) ||
    typeof (codeEditorShell as { code: unknown }).code !== 'string' ||
    typeof (codeEditorShell as { lang: unknown }).lang !== 'string'
  ) {
    // 空オブジェクトや不正データ → スキップ
    return null;
  }

  const { code, lang } = codeEditorShell as { code: string; lang: string };

  const sessionId = generateUUID();
  const label = `${lang} (migrated)`;
  const meta = registerSession(storage, sessionId, label, now);

  writeSessionData(storage, sessionId, {
    codeEditorShell: { code, lang },
  });

  return meta;
}
