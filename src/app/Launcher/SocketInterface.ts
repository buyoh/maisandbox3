
export type CallbackClose = (code: number, signal: NodeJS.Signals | null) => void;
export type CallbackRecieve = (data: any) => void;

export interface ISocket {
  start(): void;
  stop(): void;
  isAlive(): boolean;
  send(data: unknown): boolean;
  onClose(callback: CallbackClose): void;
  onRecieve(callback: CallbackRecieve): void;
}