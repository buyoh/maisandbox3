import Config from '../Config';
import { ChildProcessLauncherSocket } from './ChildProcessLauncherSocket';
import { ISocket } from './LauncherSocketInterface';
import { SocketLauncherSocket } from './SocketLauncherSocket';

const UseChildProcess = Config.useChildProcess;
const UnixSocketPath = Config.launcherSocketPath;

export function createLauncherSocket(): ISocket {
  if (UseChildProcess) return new ChildProcessLauncherSocket();
  return new SocketLauncherSocket(UnixSocketPath);
}
