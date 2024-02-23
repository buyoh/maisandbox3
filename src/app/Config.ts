// for Server Configurations only

import path from 'path';

const production = process.env.NODE_ENV === 'production';
const develop = !production;

const httpPort = parseInt(process.env.PORT || '11460');

const appRootDirectory = path.resolve(`${__dirname}/../..`);

// launcherを子プロセスとして起動するかどうか
const useChildProcess = process.env.LAUNCHER_PROCESS !== 'SOCKET';
const launcherSocketPath =
  process.env.LAUNCHER_SOCKET_PATH || process.env.PWD + '/var/launcher.sock';

// ssl対応にするかどうか
const sslConfigPath = (() => {
  const s = process.env.SSL_CONFIG_PATH;
  return s ? `${s}` : null;
})();

const frontend: 'nextjs' | 'vite' | 'static' =
  process.env.FRONTEND == 'nextjs'
    ? 'nextjs'
    : process.env.FRONTEND == 'static'
    ? 'static'
    : 'vite';

export default {
  production,
  develop,
  httpPort,
  appRootDirectory,
  useChildProcess,
  launcherSocketPath,
  sslConfigPath,
  frontend,
};
