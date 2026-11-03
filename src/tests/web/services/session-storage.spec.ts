/**
 * session-storage.ts のユニットテスト。
 * インメモリ Storage スタブを依存性注入して実行する（localStorage へのアクセスなし）。
 */

import {
  readSessionIndex,
  registerSession,
  saveSession,
  deleteSession,
  cleanupOrphanedSessions,
  readSessionData,
  generateUUID,
  SessionIndex,
  SessionMeta,
} from '../../../web/services/session-storage';

// --- インメモリ Storage スタブ ---

class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// --- テスト ---

describe('generateUUID', () => {
  it('UUID v4 形式の文字列を生成する', () => {
    const id = generateUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('毎回異なる ID を生成する', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateUUID()));
    expect(ids.size).toBe(10);
  });
});

describe('readSessionIndex', () => {
  it('空の Storage は空のインデックスを返す', () => {
    const storage = new MemoryStorage();
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(0);
  });

  it('壊れた JSON は空のインデックスを返す', () => {
    const storage = new MemoryStorage();
    storage.setItem('msb3-sessions', 'invalid json{');
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(0);
  });

  it('有効なインデックスを読み込む', () => {
    const storage = new MemoryStorage();
    const data: SessionIndex = {
      sessions: [
        { id: 'abc', createdAt: 1000, updatedAt: 2000, label: 'Test' },
      ],
    };
    storage.setItem('msb3-sessions', JSON.stringify(data));
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0].id).toBe('abc');
  });
});

describe('registerSession', () => {
  it('新規セッションをインデックスに追加する', () => {
    const storage = new MemoryStorage();
    const meta = registerSession(storage, 'session-1', 'Ruby 2026-01-01', 1000);

    expect(meta.id).toBe('session-1');
    expect(meta.label).toBe('Ruby 2026-01-01');
    expect(meta.createdAt).toBe(1000);
    expect(meta.updatedAt).toBe(1000);

    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(1);
  });

  it('既存セッションの updatedAt を更新する（label は変更しない）', () => {
    const storage = new MemoryStorage();
    registerSession(storage, 'session-1', 'Ruby 2026-01-01', 1000);
    const meta = registerSession(storage, 'session-1', 'New Label', 2000);

    expect(meta.updatedAt).toBe(2000);
    expect(meta.label).toBe('Ruby 2026-01-01'); // label 変更なし

    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(1); // 重複追加なし
  });

  it('上限 10 件を超えた場合、最も古い他セッションを削除する', () => {
    const storage = new MemoryStorage();
    // 10 件登録（id-1 が最古）
    for (let i = 1; i <= 10; i++) {
      registerSession(storage, `id-${i}`, `Label ${i}`, i * 100);
    }

    // 11 件目を登録
    registerSession(storage, 'id-11', 'Label 11', 1100);

    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(10);
    // 最古の id-1 が削除されている
    expect(index.sessions.find((s) => s.id === 'id-1')).toBeUndefined();
    // id-11 が存在する
    expect(index.sessions.find((s) => s.id === 'id-11')).toBeDefined();
  });

  it('自セッションを削除対象にしない（自分だけが残る）', () => {
    const storage = new MemoryStorage();
    // 10 件登録
    for (let i = 1; i <= 10; i++) {
      registerSession(storage, `id-${i}`, `Label ${i}`, i * 100);
    }

    // id-1 を再登録（古い updatedAt を持つが自セッション）
    registerSession(storage, 'id-1', 'Label 1', 1100);

    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(10);
    // id-1 は自セッションなので残る
    expect(index.sessions.find((s) => s.id === 'id-1')).toBeDefined();
  });
});

describe('saveSession', () => {
  it('セッションデータを保存する', () => {
    const storage = new MemoryStorage();
    registerSession(storage, 'session-1', 'Test', 1000);

    const result = saveSession(
      storage,
      'session-1',
      { codeEditorShell: { code: 'puts "hello"', lang: 'ruby' } },
      2000
    );

    expect(result).toBe(true);

    const data = readSessionData(storage, 'session-1');
    expect(data?.codeEditorShell.code).toBe('puts "hello"');
    expect(data?.codeEditorShell.lang).toBe('ruby');
  });

  it('インデックスの updatedAt を更新する', () => {
    const storage = new MemoryStorage();
    registerSession(storage, 'session-1', 'Test', 1000);

    saveSession(
      storage,
      'session-1',
      { codeEditorShell: { code: '', lang: 'ruby' } },
      3000
    );

    const index = readSessionIndex(storage);
    expect(index.sessions[0].updatedAt).toBe(3000);
  });

  it('QuotaExceededError 時に古いセッションを削除してリトライする', () => {
    const storage = new MemoryStorage();
    // 2件のセッションを登録（session-old が最古）
    registerSession(storage, 'session-old', 'Old', 100);
    registerSession(storage, 'session-1', 'New', 1000);

    // セッションデータも書き込んでおく
    const inner = storage.setItem.bind(storage);
    let writeCount = 0;
    storage.setItem = (key: string, value: string) => {
      writeCount++;
      if (writeCount === 1) {
        // 最初のセッションデータ書き込みで QuotaExceededError を投げる
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      }
      inner(key, value);
    };

    const result = saveSession(
      storage,
      'session-1',
      { codeEditorShell: { code: 'code', lang: 'python' } },
      2000
    );

    expect(result).toBe(true);
    // session-old が削除されている
    const index = readSessionIndex(storage);
    expect(index.sessions.find((s) => s.id === 'session-old')).toBeUndefined();
  });
});

describe('deleteSession', () => {
  it('セッションをインデックスから削除し、データも削除する', () => {
    const storage = new MemoryStorage();
    registerSession(storage, 'session-1', 'Test', 1000);
    saveSession(
      storage,
      'session-1',
      { codeEditorShell: { code: 'x', lang: 'ruby' } },
      1000
    );

    deleteSession(storage, 'session-1');

    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(0);
    expect(readSessionData(storage, 'session-1')).toBeNull();
  });

  it('存在しないセッション ID を削除しても エラーにならない', () => {
    const storage = new MemoryStorage();
    expect(() => deleteSession(storage, 'nonexistent')).not.toThrow();
  });
});

describe('cleanupOrphanedSessions', () => {
  it('インデックスにないセッションデータを削除する', () => {
    const storage = new MemoryStorage();
    // 孤立セッションデータを直接書き込む
    storage.setItem('msb3-session-orphan', JSON.stringify({ codeEditorShell: { code: '', lang: 'ruby' } }));
    // インデックスは空のまま

    cleanupOrphanedSessions(storage);

    expect(storage.getItem('msb3-session-orphan')).toBeNull();
  });

  it('インデックスに存在するセッションデータは削除しない', () => {
    const storage = new MemoryStorage();
    registerSession(storage, 'valid-session', 'Test', 1000);
    saveSession(
      storage,
      'valid-session',
      { codeEditorShell: { code: 'x', lang: 'ruby' } },
      1000
    );

    cleanupOrphanedSessions(storage);

    expect(readSessionData(storage, 'valid-session')).not.toBeNull();
  });
});
