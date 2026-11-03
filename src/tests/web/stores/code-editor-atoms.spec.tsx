import React from 'react';
import { render, act } from '@testing-library/react';
import { Provider, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import {
  codeAtom,
  langAtom,
  annotationsAtom,
  addAnnotationsAtom,
  clearAnnotationsAtom,
} from '../../../web/stores/code-editor-atoms';
import { Annotation } from '../../../interfaces/result-types';

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

describe('code-editor-atoms', () => {
  describe('addAnnotationsAtom', () => {
    it('appends annotations to existing list', () => {
      let annotations: Annotation[] = [];

      function TestComponent() {
        annotations = useAtomValue(annotationsAtom);
        return null;
      }

      let addAnnotations: (a: Annotation[]) => void;
      function Trigger() {
        addAnnotations = useSetAtom(addAnnotationsAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addAnnotations([{ row: 1, column: 0, type: 'error', text: 'err1' }]);
      });
      expect(annotations).toHaveLength(1);

      act(() => {
        addAnnotations([{ row: 2, column: 0, type: 'warning', text: 'warn1' }]);
      });
      expect(annotations).toHaveLength(2);
      expect(annotations[0].text).toBe('err1');
      expect(annotations[1].text).toBe('warn1');
    });
  });

  describe('clearAnnotationsAtom', () => {
    it('clears all annotations', () => {
      let annotations: Annotation[] = [];

      function TestComponent() {
        annotations = useAtomValue(annotationsAtom);
        return null;
      }

      let addAnnotations: (a: Annotation[]) => void;
      let clearAnnotations: () => void;
      function Trigger() {
        addAnnotations = useSetAtom(addAnnotationsAtom);
        clearAnnotations = useSetAtom(clearAnnotationsAtom);
        return null;
      }

      render(
        <TestProvider>
          <TestComponent />
          <Trigger />
        </TestProvider>
      );

      act(() => {
        addAnnotations([{ row: 1, column: 0, type: 'error', text: 'err1' }]);
      });
      expect(annotations).toHaveLength(1);

      act(() => {
        clearAnnotations();
      });
      expect(annotations).toHaveLength(0);
    });
  });
});
