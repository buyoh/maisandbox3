import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import { useLangVersion } from '../../../web/hooks/use-lang-version';
import { LangInfoService } from '../../../web/services/service-interfaces';

function createTestLangInfoService(options?: {
  version?: string;
  error?: string;
  delay?: number;
}): LangInfoService {
  return {
    fetchLangInfo: () => Promise.resolve([]),
    fetchLangVersion: (_lang: string) =>
      new Promise((resolve) => {
        const fn = () =>
          resolve({
            version: options?.version ?? '(test) 1.0',
            error: options?.error ?? '',
          });
        if (options?.delay) {
          setTimeout(fn, options.delay);
        } else {
          fn();
        }
      }),
  };
}

function TestHarness({
  lang,
  service,
}: {
  lang: string;
  service: LangInfoService;
}) {
  const { expanded, toggle, loading, version, error } = useLangVersion(
    lang,
    service
  );
  return (
    <div>
      <button data-testid="toggle" onClick={toggle} />
      <span data-testid="expanded">{String(expanded)}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="version">{version}</span>
      <span data-testid="error">{error}</span>
    </div>
  );
}

describe('useLangVersion', () => {
  it('初期状態では expanded=false, version 空', () => {
    const service = createTestLangInfoService();
    const { getByTestId } = render(
      <Provider>
        <TestHarness lang="cpp" service={service} />
      </Provider>
    );

    expect(getByTestId('expanded').textContent).toBe('false');
    expect(getByTestId('version').textContent).toBe('');
  });

  it('toggle で expanded=true になり、バージョンを取得する', async () => {
    const service = createTestLangInfoService({ version: '(test) gcc 13' });
    const { getByTestId } = render(
      <Provider>
        <TestHarness lang="cpp" service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('toggle').click();
    });
    expect(getByTestId('expanded').textContent).toBe('true');

    await waitFor(() => {
      expect(getByTestId('version').textContent).toBe('(test) gcc 13');
    });
  });

  it('エラー時は error フィールドが設定される', async () => {
    const service = createTestLangInfoService({
      version: '',
      error: 'timeout',
    });
    const { getByTestId } = render(
      <Provider>
        <TestHarness lang="cpp" service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('toggle').click();
    });

    await waitFor(() => {
      expect(getByTestId('error').textContent).toBe('timeout');
    });
  });

  it('lang が変わると expanded=false にリセットされる', async () => {
    const service = createTestLangInfoService({ version: '(test) 1.0' });
    const { getByTestId, rerender } = render(
      <Provider>
        <TestHarness lang="cpp" service={service} />
      </Provider>
    );

    act(() => {
      getByTestId('toggle').click();
    });
    await waitFor(() => {
      expect(getByTestId('version').textContent).toBe('(test) 1.0');
    });

    rerender(
      <Provider>
        <TestHarness lang="ruby" service={service} />
      </Provider>
    );

    expect(getByTestId('expanded').textContent).toBe('false');
    expect(getByTestId('version').textContent).toBe('');
  });
});
