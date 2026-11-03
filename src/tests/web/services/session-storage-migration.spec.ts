/**
 * session-storage.ts のマイグレーションテスト。
 */

import {
  migrateOldBackup,
  readSessionIndex,
  readSessionData,
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

describe('migrateOldBackup', () => {
  it('msb3-backup がない場合は null を返す', () => {
    const storage = new MemoryStorage();
    const result = migrateOldBackup(storage, 1000);
    expect(result).toBeNull();
  });

  it('正常なバックアップデータをマイグレーションする', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'msb3-backup',
      JSON.stringify({
        codeEditorShell: { code: 'puts "hello"', lang: 'ruby' },
      })
    );

    const meta = migrateOldBackup(storage, 1000);

    expect(meta).not.toBeNull();
    expect(meta!.label).toContain('ruby');

    // 旧キーが削除されている
    expect(storage.getItem('msb3-backup')).toBeNull();

    // 新セッションが作成されている
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(1);

    const data = readSessionData(storage, meta!.id);
    expect(data?.codeEditorShell.code).toBe('puts "hello"');
    expect(data?.codeEditorShell.lang).toBe('ruby');
  });

  it('壊れた JSON は msb3-backup を削除してスキップする', () => {
    const storage = new MemoryStorage();
    storage.setItem('msb3-backup', 'broken{json');

    const result = migrateOldBackup(storage, 1000);

    expect(result).toBeNull();
    expect(storage.getItem('msb3-backup')).toBeNull();
    // セッションは作成されない
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(0);
  });

  it('空オブジェクトは msb3-backup を削除してスキップする', () => {
    const storage = new MemoryStorage();
    storage.setItem('msb3-backup', JSON.stringify({}));

    const result = migrateOldBackup(storage, 1000);

    expect(result).toBeNull();
    expect(storage.getItem('msb3-backup')).toBeNull();
  });

  it('codeEditorShell の code が文字列でない場合はスキップする', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'msb3-backup',
      JSON.stringify({ codeEditorShell: { code: 123, lang: 'ruby' } })
    );

    const result = migrateOldBackup(storage, 1000);

    expect(result).toBeNull();
    expect(storage.getItem('msb3-backup')).toBeNull();
  });

  it('msb3-sessions が既に存在する場合は msb3-backup を削除するだけ', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'msb3-backup',
      JSON.stringify({
        codeEditorShell: { code: 'old code', lang: 'python' },
      })
    );
    // 既存セッションインデックス
    storage.setItem(
      'msb3-sessions',
      JSON.stringify({
        sessions: [{ id: 'existing', createdAt: 500, updatedAt: 500, label: 'Existing' }],
      })
    );

    const result = migrateOldBackup(storage, 1000);

    expect(result).toBeNull();
    // 旧キーが削除されている
    expect(storage.getItem('msb3-backup')).toBeNull();
    // 既存インデックスは変更されていない
    const index = readSessionIndex(storage);
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0].id).toBe('existing');
  });
});
