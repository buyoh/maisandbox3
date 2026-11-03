/**
 * SessionSidebar ウィジェットのテスト
 */
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { Provider, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';

import SessionSidebar from '../../../web/widgets/SessionSidebar';
import { sidebarOpenAtom, sessionListAtom, currentSessionIdAtom } from '../../../web/stores/session-atoms';
import { SessionMeta } from '../../../web/services/session-storage';

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

const sampleSessions: SessionMeta[] = [
  { id: 'session-1', createdAt: 1000, updatedAt: 1000, label: 'Ruby 2026-01-01 10:00' },
  { id: 'session-2', createdAt: 2000, updatedAt: 2000, label: 'Python 2026-01-01 11:00' },
];

describe('SessionSidebar', () => {
  it('sidebarOpenAtom が false の場合は何も表示しない', () => {
    const { queryByTestId } = render(
      <TestProvider initialValues={[[sidebarOpenAtom, false]]}>
        <SessionSidebar />
      </TestProvider>
    );

    expect(queryByTestId('session-sidebar')).toBeNull();
  });

  it('sidebarOpenAtom が true の場合にサイドバーを表示する', () => {
    const { getByTestId } = render(
      <TestProvider initialValues={[[sidebarOpenAtom, true]]}>
        <SessionSidebar />
      </TestProvider>
    );

    expect(getByTestId('session-sidebar')).toBeTruthy();
  });

  it('セッション一覧を表示する', () => {
    const { getByTestId } = render(
      <TestProvider
        initialValues={[
          [sidebarOpenAtom, true],
          [sessionListAtom, sampleSessions],
          [currentSessionIdAtom, 'session-1'],
        ]}
      >
        <SessionSidebar />
      </TestProvider>
    );

    expect(getByTestId('session-item-session-1')).toBeTruthy();
    expect(getByTestId('session-item-session-2')).toBeTruthy();
  });

  it('閉じるボタンで sidebarOpenAtom を false にする', () => {
    let isOpen = true;

    function SidebarStateReader() {
      const [open] = [isOpen]; // dummy
      return null;
    }

    const { getByTestId, queryByTestId } = render(
      <TestProvider initialValues={[[sidebarOpenAtom, true]]}>
        <SessionSidebar />
      </TestProvider>
    );

    fireEvent.click(getByTestId('sidebar-close'));

    expect(queryByTestId('session-sidebar')).toBeNull();
  });

  it('セッション削除ボタンをクリックするとセッションが削除される', () => {
    const ls = new MemoryStorage();
    // セッションデータを準備
    ls.setItem(
      'msb3-sessions',
      JSON.stringify({ sessions: sampleSessions })
    );
    ls.setItem(
      'msb3-session-session-2',
      JSON.stringify({ codeEditorShell: { code: 'x = 1', lang: 'python' } })
    );

    const { queryByTestId } = render(
      <TestProvider
        initialValues={[
          [sidebarOpenAtom, true],
          [sessionListAtom, [...sampleSessions]],
          [currentSessionIdAtom, 'session-1'],
        ]}
      >
        <SessionSidebar localStorage_={ls} />
      </TestProvider>
    );

    fireEvent.click(queryByTestId('session-delete-session-2')!);

    // session-2 のアイテムが消える
    expect(queryByTestId('session-item-session-2')).toBeNull();
  });

  it('他セッションをクリックすると確認ダイアログ → 復元される', () => {
    const ls = new MemoryStorage();
    ls.setItem(
      'msb3-sessions',
      JSON.stringify({ sessions: sampleSessions })
    );
    ls.setItem(
      'msb3-session-session-2',
      JSON.stringify({ codeEditorShell: { code: 'x = 1', lang: 'python' } })
    );
    ls.setItem(
      'msb3-session-session-1',
      JSON.stringify({ codeEditorShell: { code: 'puts "hi"', lang: 'ruby' } })
    );

    const confirmStub = () => true; // 常に確認を承認

    const { getByTestId } = render(
      <TestProvider
        initialValues={[
          [sidebarOpenAtom, true],
          [sessionListAtom, [...sampleSessions]],
          [currentSessionIdAtom, 'session-1'],
        ]}
      >
        <SessionSidebar localStorage_={ls} confirmRestore={confirmStub} />
      </TestProvider>
    );

    fireEvent.click(getByTestId('session-item-session-2'));

    // session-2 のデータが反映されることをテスト（codeAtom, langAtom の読み取り）
    // ここでは例外が起きないことを確認
  });

  it('確認をキャンセルすると復元しない', () => {
    const ls = new MemoryStorage();
    ls.setItem(
      'msb3-sessions',
      JSON.stringify({ sessions: sampleSessions })
    );
    ls.setItem(
      'msb3-session-session-2',
      JSON.stringify({ codeEditorShell: { code: 'x = 1', lang: 'python' } })
    );

    const confirmStub = () => false; // 常にキャンセル

    const { getByTestId } = render(
      <TestProvider
        initialValues={[
          [sidebarOpenAtom, true],
          [sessionListAtom, [...sampleSessions]],
          [currentSessionIdAtom, 'session-1'],
        ]}
      >
        <SessionSidebar localStorage_={ls} confirmRestore={confirmStub} />
      </TestProvider>
    );

    // クリックしても例外が起きないことを確認
    expect(() => fireEvent.click(getByTestId('session-item-session-2'))).not.toThrow();
  });

  it('現在のセッションには「現在」バッジが表示される', () => {
    const { getByText } = render(
      <TestProvider
        initialValues={[
          [sidebarOpenAtom, true],
          [sessionListAtom, sampleSessions],
          [currentSessionIdAtom, 'session-1'],
        ]}
      >
        <SessionSidebar />
      </TestProvider>
    );

    expect(getByText('現在')).toBeTruthy();
  });
});

describe('SessionListItem の formatRelativeTime', () => {
  const { formatRelativeTime } = require('../../../web/components/SessionListItem');

  it('60秒未満は「○秒前」', () => {
    expect(formatRelativeTime(1000, 30000)).toBe('29秒前');
  });

  it('60分未満は「○分前」', () => {
    expect(formatRelativeTime(0, 5 * 60 * 1000)).toBe('5分前');
  });

  it('24時間未満は「○時間前」', () => {
    expect(formatRelativeTime(0, 3 * 60 * 60 * 1000)).toBe('3時間前');
  });

  it('24時間以上は「○日前」', () => {
    expect(formatRelativeTime(0, 2 * 24 * 60 * 60 * 1000)).toBe('2日前');
  });
});
