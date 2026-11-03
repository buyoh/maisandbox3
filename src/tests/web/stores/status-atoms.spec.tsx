import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import {
  resultsAtom,
  activatedResultIndexAtom,
  addResultAtom,
  clearResultsAtom,
  activateResultAtom,
  activeErrlogAtom,
} from '../../../web/stores/status-atoms';
import { StoredExecResult } from '../../../web/stores/status/types';

/** テスト用: atom に初期値を注入する Provider ラッパー */
function TestProvider({
  initialValues,
  children,
}: {
  initialValues?: Array<[any, any]>;
  children: React.ReactNode;
}) {
  return (
    <Provider>
      <HydrateAtoms initialValues={initialValues || []}>
        {children}
      </HydrateAtoms>
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

describe('status-atoms', () => {
  describe('addResultAtom', () => {
    it('assigns unique id to each added result', () => {
      let results: StoredExecResult[] = [];

      function TestComponent() {
        results = useAtomValue(resultsAtom);
        return null;
      }

      let addResult: (r: any) => void;
      function Trigger() {
        const set = useSetAtom(addResultAtom);
        addResult = set;
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addResult({ color: 'success', summary: 'OK', log: '', details: null });
      });
      expect(results[0].id).toBe(0);

      act(() => {
        addResult({ color: 'error', summary: 'NG', log: 'err', details: null });
      });
      expect(results[1].id).toBe(1);
    });

    it('updates activatedResultIndex to the newly added result', () => {
      let index: number | null = null;

      function TestComponent() {
        index = useAtomValue(activatedResultIndexAtom);
        return null;
      }

      let addResult: (r: any) => void;
      function Trigger() {
        const set = useSetAtom(addResultAtom);
        addResult = set;
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addResult({ color: 'success', summary: 'OK', log: '', details: null });
      });
      expect(index).toBe(0);

      act(() => {
        addResult({ color: 'error', summary: 'NG', log: '', details: null });
      });
      expect(index).toBe(1);
    });
  });

  describe('clearResultsAtom', () => {
    it('clears results and activatedResultIndex but keeps nextResultId', () => {
      let results: StoredExecResult[] = [];
      let index: number | null = null;

      function TestComponent() {
        results = useAtomValue(resultsAtom);
        index = useAtomValue(activatedResultIndexAtom);
        return null;
      }

      let addResult: (r: any) => void;
      let clearResults: () => void;
      function Trigger() {
        addResult = useSetAtom(addResultAtom);
        clearResults = useSetAtom(clearResultsAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addResult({ color: 'success', summary: 'OK', log: '', details: null });
        addResult({ color: 'error', summary: 'NG', log: '', details: null });
      });

      act(() => {
        clearResults();
      });

      expect(results).toHaveLength(0);
      expect(index).toBeNull();

      // After clear, new results should get unique ids (not restart from 0)
      act(() => {
        addResult({ color: 'info', summary: 'new', log: '', details: null });
      });
      expect(results[0].id).toBe(2);
    });
  });

  describe('activateResultAtom', () => {
    it('sets activatedResultIndex', () => {
      let index: number | null = null;

      function TestComponent() {
        index = useAtomValue(activatedResultIndexAtom);
        return null;
      }

      let activate: (i: number) => void;
      function Trigger() {
        activate = useSetAtom(activateResultAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        activate(2);
      });
      expect(index).toBe(2);
    });
  });

  describe('activeErrlogAtom', () => {
    it('returns empty string when no result is activated', () => {
      let errlog = '';

      function TestComponent() {
        errlog = useAtomValue(activeErrlogAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
        </TestProvider>
      );

      expect(errlog).toBe('');
    });

    it('returns log of the activated result', () => {
      let errlog = '';

      function TestComponent() {
        errlog = useAtomValue(activeErrlogAtom);
        return null;
      }

      let addResult: (r: any) => void;
      function Trigger() {
        addResult = useSetAtom(addResultAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addResult({
          color: 'success',
          summary: 'OK',
          log: 'hello error',
          details: null,
        });
      });
      expect(errlog).toBe('hello error');
    });
  });
});
