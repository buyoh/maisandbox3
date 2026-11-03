import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import LangVersionInfo from '../../../web/widgets/LangVersionInfo';
import { LangInfoService } from '../../../web/services/service-interfaces';

// テスト用スタブ: 即座にレスポンスを返す
jest.mock('../../../web/services/service-provider', () => ({
  defaultLangInfoService: {
    fetchLangInfo: () => Promise.resolve([]),
    fetchLangVersion: (lang: string) =>
      Promise.resolve({ version: `(test) ${lang} 1.0`, error: '' }),
  },
}));

describe('LangVersionInfo', () => {
  it('初期状態ではバージョン情報が非表示', () => {
    const { queryByText, getByText } = render(
      <Provider>
        <LangVersionInfo lang="cpp" />
      </Provider>
    );
    expect(getByText('ℹ version')).toBeTruthy();
    expect(queryByText('(test)')).toBeNull();
  });

  it('[ℹ version] クリック後にバージョンが表示される', async () => {
    const { getByText } = render(
      <Provider>
        <LangVersionInfo lang="cpp" />
      </Provider>
    );

    act(() => {
      fireEvent.click(getByText('ℹ version'));
    });

    await waitFor(() => {
      expect(getByText('(test) cpp 1.0')).toBeTruthy();
    });
  });

  it('再度クリックで折りたたむ', async () => {
    const { getByText, queryByText } = render(
      <Provider>
        <LangVersionInfo lang="ruby" />
      </Provider>
    );

    act(() => {
      fireEvent.click(getByText('ℹ version'));
    });
    await waitFor(() => {
      expect(getByText('(test) ruby 1.0')).toBeTruthy();
    });

    act(() => {
      fireEvent.click(getByText('ℹ version'));
    });
    expect(queryByText('(test) ruby 1.0')).toBeNull();
  });
});
