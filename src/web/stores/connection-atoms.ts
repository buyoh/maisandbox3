import { atom } from 'jotai';
import type { ConnectionStatus } from '../../interfaces/socket-events';

export type { ConnectionStatus };

/** WebSocket (Socket.IO) の接続状態 */
export const wsStatusAtom = atom<ConnectionStatus>('disconnected');

/** Applauncher (gRPC) の接続状態 */
export const launcherStatusAtom = atom<ConnectionStatus>('disconnected');
