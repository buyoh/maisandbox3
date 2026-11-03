/**
 * 言語情報 REST API ルート。
 * GET /api/lang-info — 全言語のメタ情報を返す
 * GET /api/lang-version/:lang — 指定言語のバージョン文字列を返す
 */
import Express from 'express';
import { ILauncherInfoClient } from '../launcher/launcher-info-client-interface';
import { LangInfo, LangVersionResult } from '../../interfaces/lang-info-types';

/** lang パラメータバリデーション用正規表現 */
const LANG_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

/** ペンディングリクエスト数上限（DoS 防止） */
const MAX_PENDING_VERSION_REQUESTS = 4;

/**
 * 言語情報 REST API をバインドする。
 * /api/lang-info と /api/lang-version/:lang を登録する。
 */
export function bindLangInfoApi(
  app: Express.Express,
  infoClient: ILauncherInfoClient
): void {
  // lang-info キャッシュ（サーバプロセス中は不変）
  let langInfoCache: LangInfo[] | null = null;
  let langInfoPromise: Promise<LangInfo[]> | null = null;

  // lang-version キャッシュ（成功時のみ格納）
  const versionCache = new Map<string, string>();
  // in-flight map（重複排除）
  const versionInFlight = new Map<string, Promise<LangVersionResult>>();

  app.get('/api/lang-info', async (_req, res) => {
    try {
      if (langInfoCache) {
        res.json({ languages: langInfoCache });
        return;
      }

      // 初回リクエスト時に gRPC を呼ぶ（重複排除）
      if (!langInfoPromise) {
        langInfoPromise = infoClient
          .getLangInfo()
          .then((result) => {
            if (!result.ok) {
              langInfoPromise = null;
              throw new Error(result.error.message);
            }
            langInfoCache = result.value;
            return result.value;
          })
          .catch((err) => {
            langInfoPromise = null;
            throw err;
          });
      }

      const info = await langInfoPromise;
      res.json({ languages: info });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/lang-version/:lang', async (req, res) => {
    const lang = req.params.lang;

    // 入力バリデーション
    if (!LANG_PATTERN.test(lang)) {
      res.status(400).json({ error: 'invalid lang parameter' });
      return;
    }

    // 言語存在チェック（lang-info キャッシュが利用可能な場合）
    if (langInfoCache && !langInfoCache.some((l) => l.lang === lang)) {
      res.status(404).json({ error: 'unknown language' });
      return;
    }

    // キャッシュヒット
    const cached = versionCache.get(lang);
    if (cached !== undefined) {
      res.json({ lang, version: cached });
      return;
    }

    // ペンディング数上限チェック
    if (
      versionInFlight.size >= MAX_PENDING_VERSION_REQUESTS &&
      !versionInFlight.has(lang)
    ) {
      res.status(429).json({ error: 'too many pending requests' });
      return;
    }

    try {
      // 重複排除: 同一言語への in-flight リクエストがあれば待機
      let promise = versionInFlight.get(lang);
      if (!promise) {
        promise = infoClient
          .getLangVersion(lang)
          .then((result) => {
            versionInFlight.delete(lang);
            if (!result.ok) {
              return { version: '', error: result.error.message };
            }
            return result.value;
          })
          .catch((err) => {
            versionInFlight.delete(lang);
            return {
              version: '',
              error: err instanceof Error ? err.message : String(err),
            };
          });
        versionInFlight.set(lang, promise);
      }

      const result = await promise;

      if (result.error) {
        // エラー応答はキャッシュしない
        res.json({ lang, version: '', error: result.error });
      } else {
        // 成功時のみキャッシュ
        versionCache.set(lang, result.version);
        res.json({ lang, version: result.version });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(502).json({ error: message });
    }
  });
}
