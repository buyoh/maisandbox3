import Http from 'http';
import Express from 'express';
import { bindLangInfoApi } from '../../../app/web/express-lang-info-api';
import { ILauncherInfoClient } from '../../../app/launcher/launcher-info-client-interface';
import {
  LangInfo,
  LangVersionResult,
} from '../../../interfaces/lang-info-types';
import { LauncherResult } from '../../../app/launcher/launcher-client-interface';

function createFakeInfoClient(
  overrides?: Partial<ILauncherInfoClient>
): ILauncherInfoClient {
  return {
    getLangInfo: () =>
      Promise.resolve({
        ok: true as const,
        value: [
          {
            lang: 'cpp',
            displayName: 'C++',
            options: [
              {
                key: 'std',
                type: 'enum',
                values: ['c++17', 'c++2a'],
                defaultValue: 'c++2a',
                displayName: 'C++ Standard',
              },
            ],
          },
          { lang: 'ruby', displayName: 'Ruby', options: [] },
        ],
      }),
    getLangVersion: (lang: string) =>
      Promise.resolve({
        ok: true as const,
        value: { version: `${lang} v1.0`, error: '' },
      }),
    ...overrides,
  };
}

/** Helper: start a server and return its URL + close function */
function startTestServer(client: ILauncherInfoClient): {
  url: string;
  close: () => Promise<void>;
  server: Http.Server;
} {
  const app = Express();
  bindLangInfoApi(app, client);
  const server = Http.createServer(app);
  server.listen(0); // random port
  const addr = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((r) => server.close(() => r())),
    server,
  };
}

async function fetchJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url);
  const body = res.headers.get('content-type')?.includes('json')
    ? await res.json()
    : null;
  return { status: res.status, body };
}

describe('GET /api/lang-info', () => {
  let close: () => Promise<void>;
  let url: string;

  afterEach(async () => {
    if (close) await close();
  });

  test('returns language list', async () => {
    ({ url, close } = startTestServer(createFakeInfoClient()));
    const { status, body } = await fetchJson(`${url}/api/lang-info`);
    expect(status).toBe(200);
    expect(body.languages).toHaveLength(2);
    expect(body.languages[0]).toMatchObject({
      lang: 'cpp',
      displayName: 'C++',
    });
    expect(body.languages[1]).toMatchObject({
      lang: 'ruby',
      displayName: 'Ruby',
    });
  });

  test('caches result on second call', async () => {
    let callCount = 0;
    const client = createFakeInfoClient({
      getLangInfo: () => {
        callCount++;
        return Promise.resolve({
          ok: true as const,
          value: [{ lang: 'ruby', displayName: 'Ruby', options: [] }],
        });
      },
    });
    ({ url, close } = startTestServer(client));

    await fetchJson(`${url}/api/lang-info`);
    await fetchJson(`${url}/api/lang-info`);
    expect(callCount).toBe(1);
  });

  test('returns 502 on gRPC failure', async () => {
    const client = createFakeInfoClient({
      getLangInfo: () =>
        Promise.resolve({
          ok: false as const,
          error: { code: 'UNAVAILABLE', message: 'connection refused' },
        }),
    });
    ({ url, close } = startTestServer(client));
    const { status, body } = await fetchJson(`${url}/api/lang-info`);
    expect(status).toBe(502);
    expect(body.error).toBe('connection refused');
  });
});

describe('GET /api/lang-version/:lang', () => {
  let close: () => Promise<void>;
  let url: string;

  afterEach(async () => {
    if (close) await close();
  });

  test('returns version for valid lang', async () => {
    ({ url, close } = startTestServer(createFakeInfoClient()));
    const { status, body } = await fetchJson(`${url}/api/lang-version/cpp`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ lang: 'cpp', version: 'cpp v1.0' });
  });

  test('returns 400 for invalid lang parameter', async () => {
    ({ url, close } = startTestServer(createFakeInfoClient()));
    const { status } = await fetchJson(`${url}/api/lang-version/..%2F..%2Fetc`);
    expect(status).toBe(400);
  });

  test('returns 400 for lang starting with number', async () => {
    ({ url, close } = startTestServer(createFakeInfoClient()));
    const { status } = await fetchJson(`${url}/api/lang-version/123`);
    expect(status).toBe(400);
  });

  test('returns 404 for unknown lang (with cached lang-info)', async () => {
    ({ url, close } = startTestServer(createFakeInfoClient()));
    // Warm up lang-info cache
    await fetchJson(`${url}/api/lang-info`);
    const { status } = await fetchJson(`${url}/api/lang-version/python`);
    expect(status).toBe(404);
  });

  test('caches successful version result', async () => {
    let callCount = 0;
    const client = createFakeInfoClient({
      getLangVersion: (lang: string) => {
        callCount++;
        return Promise.resolve({
          ok: true as const,
          value: { version: `${lang} cached`, error: '' },
        });
      },
    });
    ({ url, close } = startTestServer(client));

    await fetchJson(`${url}/api/lang-version/cpp`);
    await fetchJson(`${url}/api/lang-version/cpp`);
    expect(callCount).toBe(1);
  });

  test('does not cache error result', async () => {
    let callCount = 0;
    const client = createFakeInfoClient({
      getLangVersion: () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true as const,
            value: { version: '', error: 'timeout' },
          });
        }
        return Promise.resolve({
          ok: true as const,
          value: { version: 'recovered', error: '' },
        });
      },
    });
    ({ url, close } = startTestServer(client));

    const res1 = await fetchJson(`${url}/api/lang-version/cpp`);
    expect(res1.body.error).toBe('timeout');

    const res2 = await fetchJson(`${url}/api/lang-version/cpp`);
    expect(res2.body.version).toBe('recovered');
    expect(callCount).toBe(2);
  });

  test('deduplicates concurrent requests for same lang', async () => {
    let callCount = 0;
    const client = createFakeInfoClient({
      getLangVersion: (lang: string) => {
        callCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true as const,
              value: { version: `${lang} v1`, error: '' },
            });
          }, 50);
        });
      },
    });
    ({ url, close } = startTestServer(client));

    const [res1, res2] = await Promise.all([
      fetchJson(`${url}/api/lang-version/cpp`),
      fetchJson(`${url}/api/lang-version/cpp`),
    ]);
    expect(res1.body.version).toBe('cpp v1');
    expect(res2.body.version).toBe('cpp v1');
    expect(callCount).toBe(1);
  });

  test('returns 429 when pending requests exceed limit', async () => {
    // MAX_PENDING_VERSION_REQUESTS = 4
    const client = createFakeInfoClient({
      getLangVersion: (lang: string) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true as const,
              value: { version: `${lang} v1`, error: '' },
            });
          }, 200);
        });
      },
    });
    ({ url, close } = startTestServer(client));

    // Fire 5 different lang requests (exceeds limit of 4)
    const promises = ['a', 'b', 'c', 'd', 'e'].map((lang) =>
      fetchJson(`${url}/api/lang-version/${lang}`)
    );
    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);
    // At least one should be 429
    expect(statuses).toContain(429);
    // Most should be 200
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(4);
  });
});
