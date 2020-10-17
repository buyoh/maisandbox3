// for Server Configurations only

const production = process.env.NODE_ENV === 'production';
const develop = !production;

const httpPort = parseInt(process.env.PORT || '11460');

// launcherを子プロセスとして起動するかどうか
const useChildProcess = process.env.LAUNCHER_PROCESS !== 'SOCKET';
const launcherSocketPath = process.env.LAUNCHER_SOCKET_PATH || process.env.PWD + '/var/launcher.sock';

export default {
  production,
  develop,
  httpPort,
  useChildProcess,
  launcherSocketPath
};