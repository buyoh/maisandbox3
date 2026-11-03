import Express from 'express';
import Http from 'http';
import Fs from 'fs';
import Path from 'path';
// import { createServer as createViteServer } from 'vite';
// production では vite は devDependencies なので、import() で遅延ロードする。
async function createViteServer(options: any) {
  const viteModule = await import('vite');
  return viteModule.createServer(options);
}
import Config from '../config';

/**
 * Vite dev server をミドルウェアモードで Express にバインドする。
 * HMR WebSocket は httpServer 上で動作し、アプリケーションと同一ポートを共有する。
 */
export async function bindViteDevToExpress(
  express: Express.Express,
  httpServer: Http.Server
): Promise<void> {
  if (!Config.develop) {
    throw new Error('bindViteDevToExpress: Config.develop is not true');
  }
  const cwd = process.cwd();
  const viteServer = await createViteServer({
    root: cwd,
    logLevel: 'info',
    server: {
      middlewareMode: true,
      ws: {
        server: httpServer,
        path: '/__vite_hmr',
      },
    },
  });
  express.use(viteServer.middlewares);

  express.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;

      const html = await Fs.promises.readFile(
        Path.resolve(cwd, 'index.html'),
        'utf-8'
      );

      res
        .status(200)
        .set({ 'Content-Type': 'text/html' })
        .end(await viteServer.transformIndexHtml(url, html));
    } catch (e) {
      if (e instanceof Error) {
        if (viteServer) {
          viteServer.ssrFixStacktrace(e);
        }
        console.warn(e.stack);
      }
      res.status(500).end('Internal Server Error');
    }
  });
}
