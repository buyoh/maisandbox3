/**
 * fetch ベースの LangInfoService 実装。
 * サーバの REST API (/api/lang-info, /api/lang-version/:lang) を呼び出す。
 */
import type {
  LangInfo,
  LangVersionResult,
} from '../../interfaces/lang-info-types';
import { LangInfoService } from './service-interfaces';

/**
 * REST API ベースの LangInfoService を作成する。
 * サーバ側でキャッシュが管理されるため、クライアント側ではキャッシュしない。
 */
export function createFetchLangInfoService(): LangInfoService {
  return {
    async fetchLangInfo(): Promise<LangInfo[]> {
      const res = await fetch('/api/lang-info');
      if (!res.ok) {
        throw new Error(`GET /api/lang-info failed: ${res.status}`);
      }
      const data = await res.json();
      return data.languages;
    },

    async fetchLangVersion(lang: string): Promise<LangVersionResult> {
      const res = await fetch(`/api/lang-version/${encodeURIComponent(lang)}`);
      if (!res.ok) {
        if (res.status === 404) {
          return { version: '', error: 'unknown language' };
        }
        if (res.status === 429) {
          return { version: '', error: 'too many requests, try again later' };
        }
        return { version: '', error: `request failed: ${res.status}` };
      }
      const data = await res.json();
      return {
        version: data.version || '',
        error: data.error || '',
      };
    },
  };
}
