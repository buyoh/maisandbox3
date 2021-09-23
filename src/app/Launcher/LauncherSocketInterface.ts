export type CallbackClose = (
  code: number | null,
  signal: NodeJS.Signals | null
) => void;
export type CallbackReceive = (data: any) => void;

export interface ISocket {
  start(): void;
  stop(): void;
  isAlive(): boolean;
  send(data: unknown): boolean;
  onClose(callback: CallbackClose): void;
  onReceive(callback: CallbackReceive): void;
}
