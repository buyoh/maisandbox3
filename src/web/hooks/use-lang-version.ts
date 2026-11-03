import { useState, useEffect, useCallback } from 'react';
import { LangInfoService } from '../services/service-interfaces';

/** useLangVersion フックの戻り値 */
export interface UseLangVersionReturn {
  expanded: boolean;
  toggle(): void;
  loading: boolean;
  version: string;
  error: string;
}

/**
 * バージョン取得のカスタムフック。
 * expanded=true かつ version 未取得の場合に service.fetchLangVersion を呼ぶ。
 * lang が変わるとリセットされる。
 */
export function useLangVersion(
  lang: string,
  service: LangInfoService
): UseLangVersionReturn {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');

  // lang が変わったらリセット
  useEffect(() => {
    setExpanded(false);
    setVersion('');
    setError('');
  }, [lang]);

  // expanded=true になったら fetch
  useEffect(() => {
    if (!expanded || version || error) return;
    let cancelled = false;
    setLoading(true);
    service.fetchLangVersion(lang).then((result) => {
      if (cancelled) return;
      setLoading(false);
      setVersion(result.version);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, lang, service, version, error]);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return { expanded, toggle, loading, version, error };
}
