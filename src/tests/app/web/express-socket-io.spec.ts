import Http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, Socket as ClientSocketIO } from 'socket.io-client';
import { bindSocketIOToExpress } from '../../../app/web/express-socket-io';
import {
  ConnectionHandler,
  ConnectionHandlerFactory,
} from '../../../app/connection-handler';
import {
  RunSingleTaskRequest,
  KillRequest,
} from '../../../interfaces/query-types';
import { TaskResult } from '../../../interfaces/result-types';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../interfaces/socket-events';

// ---------------------------------------------------------------------------
// Stub
// ---------------------------------------------------------------------------

class StubConnectionHandler implements ConnectionHandler {
  disconnected = false;
  receivedRunSingleTask: {
    request: RunSingleTaskRequest;
    callback: (data: TaskResult) => void;
  }[] = [];
  receivedKill: KillRequest[] = [];

  disconnect(): void {
    this.disconnected = true;
  }

  async runSingleTask(
    request: RunSingleTaskRequest,
    callback: (data: TaskResult) => void
  ): Promise<void> {
    this.receivedRunSingleTask.push({ request, callback });
  }

  kill(request: KillRequest): void {
    this.receivedKill.push(request);
  }

  async runInteractiveTask(): Promise<void> {}
  interactiveStdin(): void {}
  interactiveCloseStdin(): void {}
}

class StubConnectionHandlerFactory implements ConnectionHandlerFactory {
  handlers: StubConnectionHandler[] = [];

  createConnectionHandler(_socketId: string): ConnectionHandler {
    const handler = new StubConnectionHandler();
    this.handlers.push(handler);
    return handler;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('express-socket-io', () => {
  let httpServer: Http.Server;
  let factory: StubConnectionHandlerFactory;
  let client: ClientSocketIO<ServerToClientEvents, ClientToServerEvents>;
  let port: number;

  beforeEach((done) => {
    factory = new StubConnectionHandlerFactory();
    httpServer = Http.createServer();
    bindSocketIOToExpress(factory, httpServer).then(() => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
        }
        client = ioClient(`http://localhost:${port}`, {
          transports: ['websocket'],
        });
        client.on('connect', () => {
          // ConnectionHandler が作成されるまで少し待つ
          setTimeout(done, 50);
        });
      });
    });
  });

  afterEach((done) => {
    client.disconnect();
    httpServer.close(() => done());
  });

  test('valid runSingleTask forwards to ConnectionHandler', (done) => {
    const request: RunSingleTaskRequest = {
      id: { clicmid: 1 },
      lang: 'ruby',
      info: { type: 'filestdin', code: 'puts 1', stdin: '' },
    };

    client.emit('runSingleTask', request);

    setTimeout(() => {
      expect(factory.handlers).toHaveLength(1);
      const handler = factory.handlers[0];
      expect(handler.receivedRunSingleTask).toHaveLength(1);
      expect(handler.receivedRunSingleTask[0].request).toEqual(request);
      done();
    }, 100);
  });

  test('runSingleTask callback emits taskResult to client', (done) => {
    const request: RunSingleTaskRequest = {
      id: { clicmid: 2 },
      lang: 'ruby',
      info: { type: 'filestdin', code: '', stdin: '' },
    };

    client.on('taskResult', (data: TaskResult) => {
      expect(data.id).toEqual({ clicmid: 2 });
      expect(data.success).toBe(true);
      expect(data.summary).toBe('done');
      done();
    });

    client.emit('runSingleTask', request);

    setTimeout(() => {
      const handler = factory.handlers[0];
      handler.receivedRunSingleTask[0].callback({
        id: { clicmid: 2 },
        success: true,
        summary: 'done',
      });
    }, 100);
  });

  test('invalid runSingleTask returns error with id', (done) => {
    client.on('taskResult', (data: TaskResult) => {
      expect(data.success).toBe(false);
      expect(data.summary).toBe('Invalid request');
      expect(data.id).toEqual({ clicmid: 99 });
      done();
    });

    // lang がないため validation に失敗する
    client.emit('runSingleTask', {
      id: { clicmid: 99 },
      info: { type: 'filestdin' },
    } as any);
  });

  test('invalid runSingleTask without id returns error with undefined id', (done) => {
    client.on('taskResult', (data: TaskResult) => {
      expect(data.success).toBe(false);
      expect(data.summary).toBe('Invalid request');
      expect(data.id).toBeUndefined();
      done();
    });

    // null はバリデーションに失敗し、id も抽出できない
    client.emit('runSingleTask', 'not-an-object' as any);
  });

  test('valid kill forwards to ConnectionHandler', (done) => {
    const killReq: KillRequest = { id: { clicmid: 5 } };

    // まず runSingleTask で handler を作る
    client.emit('runSingleTask', {
      id: { clicmid: 5 },
      lang: 'ruby',
      info: { type: 'filestdin', code: '', stdin: '' },
    });

    setTimeout(() => {
      client.emit('kill', killReq);
      setTimeout(() => {
        const handler = factory.handlers[0];
        expect(handler.receivedKill).toHaveLength(1);
        expect(handler.receivedKill[0]).toEqual(killReq);
        done();
      }, 100);
    }, 100);
  });

  test('invalid kill returns error with id', (done) => {
    client.on('taskResult', (data: TaskResult) => {
      expect(data.success).toBe(false);
      expect(data.summary).toBe('Invalid request');
      done();
    });

    client.emit('kill', 'invalid' as any);
  });

  test('disconnect triggers ConnectionHandler.disconnect()', (done) => {
    setTimeout(() => {
      expect(factory.handlers).toHaveLength(1);
      const handler = factory.handlers[0];

      client.disconnect();

      setTimeout(() => {
        expect(handler.disconnected).toBe(true);
        done();
      }, 100);
    }, 50);
  });
});
