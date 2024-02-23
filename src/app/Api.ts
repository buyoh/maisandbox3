// ----------------------------------------------------------------------------

export interface ConnectionHandler {
  disconnect(): void;
  // TODO: インターフェースの見直し(any?)
  queryExec(rawData: any, callback: (data: any) => void): void;
}

export interface ConnectionHandlerFactory {
  createConnectionHandler(socketId: string): ConnectionHandler;
}
