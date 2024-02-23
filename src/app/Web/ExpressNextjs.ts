import Express from 'express';
import Next from 'next';
import Config from '../Config';

export async function bindNextjsToExpress(
  express: Express.Express
): Promise<void> {
  const appNext = Next({ dev: Config.develop });
  await appNext.prepare();

  const requestHandler = appNext.getRequestHandler();
  express.all('*', (req: Express.Request, res: Express.Response) => {
    return requestHandler(req, res);
  });
}
