import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { ClientSocket } from '../services/client-socket';
import type {
  SocketInterface,
  ConnectionEventSource,
} from '../services/client-socket';
import type {
  RunSingleTaskRequest,
  KillRequest,
  RunInteractiveTaskRequest,
  InteractiveStdinRequest,
  InteractiveCloseStdinRequest,
} from '../../interfaces/query-types';
import type {
  TaskResult,
  InteractiveOutputData,
} from '../../interfaces/result-types';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LauncherStatusPayload,
} from '../../interfaces/socket-events';

class TypedSocket implements SocketInterface {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    this.socket = socket;
  }

  emitRunSingleTask(data: RunSingleTaskRequest): void {
    this.socket.emit('runSingleTask', data);
  }

  emitKill(data: KillRequest): void {
    this.socket.emit('kill', data);
  }

  onTaskResult(handler: (data: TaskResult) => void): void {
    this.socket.on('taskResult', handler);
  }

  emitRunInteractiveTask(data: RunInteractiveTaskRequest): void {
    this.socket.emit('runInteractiveTask', data);
  }

  emitInteractiveStdin(data: InteractiveStdinRequest): void {
    this.socket.emit('interactiveStdin', data);
  }

  emitInteractiveCloseStdin(data: InteractiveCloseStdinRequest): void {
    this.socket.emit('interactiveCloseStdin', data);
  }

  onInteractiveOutput(handler: (data: InteractiveOutputData) => void): void {
    this.socket.on('interactiveOutput', handler);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

class TypedConnectionEventSource implements ConnectionEventSource {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;

  constructor(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    this.socket = socket;
  }

  onConnect(handler: () => void): void {
    this.socket.on('connect', handler);
  }

  onDisconnect(handler: () => void): void {
    this.socket.on('disconnect', handler);
  }

  onLauncherStatus(handler: (data: LauncherStatusPayload) => void): void {
    this.socket.on('launcherStatus', handler);
  }

  offAll(): void {
    this.socket.removeAllListeners('connect');
    this.socket.removeAllListeners('disconnect');
    this.socket.removeAllListeners('launcherStatus');
  }
}

/** SocketFactory の戻り値 */
export interface SocketFactoryResult {
  socket: SocketInterface;
  events: ConnectionEventSource;
}

/** デフォルトの Socket 接続ファクトリ */
function defaultSocketFactory(): SocketFactoryResult {
  const socket = io();
  return {
    socket: new TypedSocket(socket),
    events: new TypedConnectionEventSource(socket),
  };
}

export interface UseSocketOptions {
  /** テスト用: Socket ファクトリを差し替え可能にする */
  factory?: () => SocketFactoryResult;
}

/** useSocket の戻り値 */
export interface UseSocketResult {
  clientSocket: ClientSocket | null;
  events: ConnectionEventSource | null;
  /** TaskStatusListener 用の raw SocketInterface */
  socketInterface: SocketInterface | null;
}

/**
 * Socket.IO 接続を管理する Custom Hook。
 * マウント時に接続を確立し、アンマウント時に切断する。
 */
export function useSocket(options?: UseSocketOptions): UseSocketResult {
  const [clientSocket, setClientSocket] = useState<ClientSocket | null>(null);
  const [events, setEvents] = useState<ConnectionEventSource | null>(null);
  const [socketInterface, setSocketInterface] =
    useState<SocketInterface | null>(null);

  useEffect(() => {
    const factory = options?.factory ?? defaultSocketFactory;
    const result = factory();
    setClientSocket(new ClientSocket(result.socket));
    setEvents(result.events);
    setSocketInterface(result.socket);

    return () => {
      result.socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { clientSocket, events, socketInterface };
}
