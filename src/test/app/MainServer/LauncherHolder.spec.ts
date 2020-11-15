import { CallbackClose, CallbackRecieve, ISocket } from '../../../app/Launcher/SocketInterface';
import LauncherHolder from '../../../app/MainServer/LauncherHolder';

class TestSocket implements ISocket {

  startMock: jest.Mock<void, any>;
  stopMock: jest.Mock<void, any>;
  isAliveMock: jest.Mock<void, any>;
  sendMock: jest.Mock<void, any>;
  onCloseCallback?: CallbackClose;
  onRecieveCallback?: CallbackRecieve;
  alive: boolean;

  constructor() {
    this.startMock = jest.fn();
    this.stopMock = jest.fn();
    this.isAliveMock = jest.fn();
    this.sendMock = jest.fn();
    this.alive = false;
  }

  start(): void {
    this.startMock();
    this.alive = true;
  }
  stop(): void {
    this.stopMock();
    this.alive = false;
  }
  isAlive(): boolean {
    this.isAliveMock();
    return this.alive;
  }
  send(data: unknown): boolean {
    this.sendMock(data);
    setTimeout(() => this.onRecieveCallback?.(data as any), 0);
    return true;
  }
  onClose(callback: CallbackClose): void {
    this.onCloseCallback = callback;
  }
  onRecieve(callback: CallbackRecieve): void {
    this.onRecieveCallback = callback;
  }

}

test('start and call and stop', (done) => {
  let socket: TestSocket | undefined;
  const holder = new LauncherHolder(10, () => true, () => (socket = new TestSocket()));

  holder.start();
  expect(socket).toBeTruthy();
  if (!socket) {
    throw new Error('socket is undefined');
  }
  expect(socket.startMock.mock.calls.length).toEqual(1);

  holder.callbackManager.postp({ msg: 'message' }).then((data) => {
    expect(data.msg).toEqual('message');
    return Promise.resolve();
  }).then(() => {
    holder.stop();
    if (!socket) return;  // never
    expect(socket.stopMock.mock.calls.length).toEqual(1);
    done();
  });
});


test('restart', (done) => {
  let socket: TestSocket | undefined;
  const holder = new LauncherHolder(5, () => true, () => (socket = new TestSocket()));

  holder.start();
  expect(socket).toBeTruthy();
  if (!socket) {
    throw new Error('socket is undefined');
  }
  expect(socket.startMock.mock.calls.length).toEqual(1);

  socket.alive = false;
  socket.onCloseCallback?.(0, null);
  // TODO: Configの依存を切らないと、exit0する
  setTimeout(() => {
    expect(socket?.isAlive()).toEqual(true);
    done();
  }, 50);
});

