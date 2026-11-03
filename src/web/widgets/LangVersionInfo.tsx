import React from 'react';
import { useAtomValue } from 'jotai';
import { useLangVersion } from '../hooks/use-lang-version';
import { defaultLangInfoService } from '../services/service-provider';
import { langAtom } from '../stores/code-editor-atoms';

export interface LangVersionInfoProps {
  lang: string;
}

/** バージョン情報表示ウィジェット。クリックでバージョン文字列をオンデマンド取得・表示する。 */
export default function LangVersionInfo({
  lang,
}: LangVersionInfoProps): JSX.Element {
  const { expanded, toggle, loading, version, error } = useLangVersion(
    lang,
    defaultLangInfoService
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={toggle}
        style={{ fontSize: '0.85em', padding: '1px 4px', cursor: 'pointer' }}
      >
        ℹ version
      </button>
      {expanded && (
        <span style={{ fontSize: '0.85em' }}>
          {loading && <span style={{ color: '#888' }}>Loading...</span>}
          {!loading && error && (
            <span style={{ color: 'red' }}>Failed: {error}</span>
          )}
          {!loading && !error && version && <span>{version}</span>}
        </span>
      )}
    </span>
  );
}

/** 接続用ラッパー。langAtom を自動取得する。 */
export function LangVersionInfoConnected(): JSX.Element {
  const lang = useAtomValue(langAtom);
  return <LangVersionInfo lang={lang} />;
}
