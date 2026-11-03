/**
 * use-session-backup.ts のユニットテスト。
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';

import { useSessionBackup } from '../../../web/hooks/use-session-backup';
import { codeAtom, langAtom } from '../../../web/stores/code-editor-atoms';
import { currentSessionIdAtom, sessionListAtom } from '../../../web/stores/session-atoms';
import { readSessionData, readSessionIndex } from '../../../web/services/session-storage';

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

// --- テストヘルパー ---

function TestProvider({
  initialValues,
  children,
}: {
  initialValues?: Array<[any, any]>;
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <HydrateAtoms initialValues={initialValues || []}>{children}</HydrateAtoms>
    </Provider>
  );
}

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: Array<[any, any]>;
  children: React.ReactNode;
}) {
  useHydrateAtoms(initialValues);
  return <>{children}</>;
}

function BackupHost({
  ls,
  ss,
}: {
  ls: Storage;
  ss: Storage;
}) {
  useSessionBackup(ls, ss);
  return null;
}

// --- テスト ---

describe('useSessionBackup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('セッション ID を生成して currentSessionIdAtom に設定する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let sessionId: string | undefined;

    function Reader() {
      sessionId = useAtomValue(currentSessionIdAtom);
      return null;
    }

    render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
        <Reader />
      </TestProvider>
    );

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
  });

  it('同一 sessionStorage を使用した場合、同じセッション ID を再利用する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    let id1: string | undefined;
    let id2: string | undefined;

    function Reader1() {
      id1 = useAtomValue(currentSessionIdAtom);
      return null;
    }
    function Reader2() {
      id2 = useAtomValue(currentSessionIdAtom);
      return null;
    }

    const { unmount } = render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
        <Reader1 />
      </TestProvider>
    );
    unmount();

    render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
        <Reader2 />
      </TestProvider>
    );

    expect(id1).toBe(id2);
  });

  it('マウント時に既存セッションデータを復元する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    // セッション ID を事前設定
    ss.setItem('msb3-session-id', 'test-session');
    // セッションデータを事前保存
    ls.setItem(
      'msb3-session-test-session',
      JSON.stringify({
        codeEditorShell: { code: 'puts "restored"', lang: 'ruby' },
      })
    );
    // インデックスを設定
    ls.setItem(
      'msb3-sessions',
      JSON.stringify({
        sessions: [{ id: 'test-session', createdAt: 1000, updatedAt: 1000, label: 'Test' }],
      })
    );

    let codeVal = '';
    let langVal = '';

    function Reader() {
      codeVal = useAtomValue(codeAtom);
      langVal = useAtomValue(langAtom);
      return null;
    }

    render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
        <Reader />
      </TestProvider>
    );

    expect(codeVal).toBe('puts "restored"');
    expect(langVal).toBe('ruby');
  });

  it('アンマウント時にデータを保存する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    const { unmount } = render(
      <TestProvider
        initialValues={[
          [codeAtom, 'my code'],
          [langAtom, 'python'],
        ]}
      >
        <BackupHost ls={ls} ss={ss} />
      </TestProvider>
    );

    const sessionId = ss.getItem('msb3-session-id')!;
    unmount();

    const data = readSessionData(ls, sessionId);
    expect(data?.codeEditorShell.code).toBe('my code');
    expect(data?.codeEditorShell.lang).toBe('python');
  });

  it('beforeunload イベントでデータを保存する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    render(
      <TestProvider
        initialValues={[
          [codeAtom, 'hello world'],
          [langAtom, 'cpp'],
        ]}
      >
        <BackupHost ls={ls} ss={ss} />
      </TestProvider>
    );

    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    const sessionId = ss.getItem('msb3-session-id')!;
    const data = readSessionData(ls, sessionId);
    expect(data?.codeEditorShell.code).toBe('hello world');
    expect(data?.codeEditorShell.lang).toBe('cpp');
  });

  it('60秒間隔でデータを保存する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    render(
      <TestProvider
        initialValues={[
          [codeAtom, 'interval-code'],
          [langAtom, 'ruby'],
        ]}
      >
        <BackupHost ls={ls} ss={ss} />
      </TestProvider>
    );

    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    const sessionId = ss.getItem('msb3-session-id')!;
    const data = readSessionData(ls, sessionId);
    expect(data?.codeEditorShell.code).toBe('interval-code');
  });

  it('セッション一覧を sessionListAtom に設定する', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    let sessions: any[] = [];

    function Reader() {
      sessions = useAtomValue(sessionListAtom);
      return null;
    }

    render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
        <Reader />
      </TestProvider>
    );

    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('旧バックアップ（msb3-backup）をマイグレーションする', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    ls.setItem(
      'msb3-backup',
      JSON.stringify({ codeEditorShell: { code: 'old code', lang: 'ruby' } })
    );

    render(
      <TestProvider>
        <BackupHost ls={ls} ss={ss} />
      </TestProvider>
    );

    // 旧キーが削除されている
    expect(ls.getItem('msb3-backup')).toBeNull();
    // 新セッションが作成されている
    const index = readSessionIndex(ls);
    expect(index.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it('マウント後にコードを変更しても beforeunload で最新値が保存される（stale closure 検証）', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();

    let capturedSetCode: ((v: string) => void) | null = null;

    function CodeCapture() {
      const { useSetAtom: _useSetAtom } = require('jotai') as typeof import('jotai');
      capturedSetCode = _useSetAtom(codeAtom);
      return null;
    }

    render(
      <TestProvider initialValues={[[codeAtom, 'initial code']]}>
        <BackupHost ls={ls} ss={ss} />
        <CodeCapture />
      </TestProvider>
    );

    // マウント後にコードを変更
    act(() => {
      capturedSetCode?.('updated code after mount');
    });

    // beforeunload を発火
    act(() => {
      window.dispatchEvent(new Event('beforeunload'));
    });

    const sessionId = ss.getItem('msb3-session-id')!;
    const data = readSessionData(ls, sessionId);
    // ref を使っているので stale closure にならず最新値が保存される
    expect(data?.codeEditorShell.code).toBe('updated code after mount');
  });
});
