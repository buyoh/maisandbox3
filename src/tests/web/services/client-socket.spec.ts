import {
  ClientSocket,
  SocketInterface,
  TaskHandle,
} from '../../../web/services/client-socket';
import { TaskResult } from '../../../interfaces/result-types';
import { RunSingleTaskRequest } from '../../../interfaces/query-types';

class StubSocket implements SocketInterface {
  emittedRunSingleTask: RunSingleTaskRequest[] = [];
  emittedKill: { id?: Record<string, number | undefined> }[] = [];
  disconnected = false;
  private taskResultHandler: ((data: TaskResult) => void) | null = null;

  emitRunSingleTask(data: RunSingleTaskRequest): void {
    this.emittedRunSingleTask.push(data);
  }

  emitKill(data: { id?: Record<string, number | undefined> }): void {
    this.emittedKill.push(data);
  }

  onTaskResult(handler: (data: TaskResult) => void): void {
    this.taskResultHandler = handler;
  }

  emitRunInteractiveTask(): void {}
  emitInteractiveStdin(): void {}
  emitInteractiveCloseStdin(): void {}
  onInteractiveOutput(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  // テストヘルパー: サーバからのレスポンスをシミュレート
  simulateTaskResult(data: TaskResult): void {
    this.taskResultHandler?.(data);
  }
}

describe('ClientSocket', () => {
  let stub: StubSocket;
  let clientSocket: ClientSocket;

  beforeEach(() => {
    stub = new StubSocket();
    clientSocket = new ClientSocket(stub);
  });

  test('runSingleTask emits with id', () => {
    const onResult = jest.fn();
    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: 'puts 1', stdin: '' } },
      onResult
    );

    expect(stub.emittedRunSingleTask).toHaveLength(1);
    const sent = stub.emittedRunSingleTask[0];
    expect(sent.lang).toBe('ruby');
    expect(sent.info).toEqual({ type: 'filestdin', code: 'puts 1', stdin: '' });
    expect(sent.id).toBeDefined();
    expect(sent.id?.clicmid).toBeGreaterThan(0);
  });

  test('taskResult routes to correct callback', () => {
    const onResult = jest.fn();
    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: '', stdin: '' } },
      onResult
    );

    const sentId = stub.emittedRunSingleTask[0].id;
    stub.simulateTaskResult({
      id: sentId,
      success: true,
      summary: 'ok',
      continue: false,
    });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, summary: 'ok' })
    );
  });

  test('continue=true keeps callback registered', () => {
    const onResult = jest.fn();
    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: '', stdin: '' } },
      onResult
    );

    const sentId = stub.emittedRunSingleTask[0].id;

    // First response with continue=true
    stub.simulateTaskResult({
      id: sentId,
      success: true,
      summary: 'running',
      continue: true,
      running: true,
    });
    expect(onResult).toHaveBeenCalledTimes(1);

    // Second response with continue=false
    stub.simulateTaskResult({
      id: sentId,
      success: true,
      summary: 'done',
      continue: false,
    });
    expect(onResult).toHaveBeenCalledTimes(2);

    // Third call should be ignored (callback removed)
    stub.simulateTaskResult({
      id: sentId,
      success: true,
      summary: 'extra',
      continue: false,
    });
    expect(onResult).toHaveBeenCalledTimes(2);
  });

  test('TaskHandle.kill() emits kill with same id', () => {
    const onResult = jest.fn();
    const handle: TaskHandle = clientSocket.runSingleTask(
      { lang: 'cpp', info: { type: 'filestdin', code: '', stdin: '' } },
      onResult
    );

    const sentId = stub.emittedRunSingleTask[0].id;
    handle.kill();

    expect(stub.emittedKill).toHaveLength(1);
    expect(stub.emittedKill[0].id).toEqual(sentId);
  });

  test('multiple tasks are independent', () => {
    const onResult1 = jest.fn();
    const onResult2 = jest.fn();

    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: '1', stdin: '' } },
      onResult1
    );
    clientSocket.runSingleTask(
      { lang: 'cpp', info: { type: 'filestdin', code: '2', stdin: '' } },
      onResult2
    );

    const id1 = stub.emittedRunSingleTask[0].id;
    const id2 = stub.emittedRunSingleTask[1].id;
    expect(id1).not.toEqual(id2);

    stub.simulateTaskResult({ id: id2, success: true, summary: 'cpp done' });
    expect(onResult1).not.toHaveBeenCalled();
    expect(onResult2).toHaveBeenCalledTimes(1);

    stub.simulateTaskResult({ id: id1, success: true, summary: 'ruby done' });
    expect(onResult1).toHaveBeenCalledTimes(1);
  });

  test('taskResult without id is ignored', () => {
    const onResult = jest.fn();
    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: '', stdin: '' } },
      onResult
    );

    stub.simulateTaskResult({ success: false, summary: 'no id' });
    expect(onResult).not.toHaveBeenCalled();
  });

  test('disconnect() disconnects underlying socket and clears callbacks', () => {
    const onResult = jest.fn();
    clientSocket.runSingleTask(
      { lang: 'ruby', info: { type: 'filestdin', code: '', stdin: '' } },
      onResult
    );

    clientSocket.disconnect();

    expect(stub.disconnected).toBe(true);

    // After disconnect, results should not be routed
    const sentId = stub.emittedRunSingleTask[0].id;
    stub.simulateTaskResult({ id: sentId, success: true, summary: 'late' });
    expect(onResult).not.toHaveBeenCalled();
  });
});
