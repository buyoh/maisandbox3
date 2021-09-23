// usage:
// var cm = new CallbackManager((query) => {
//   nanika.fetch(cm.getReceiveCallback());
// });
// // task1
// cm.post(myQuery, (result) => { });
// // task2 ...

// cm.post(myQuery, (result) => { });
export class CallbackManager {
  private identifier: string;
  private counter: number;
  private sender: (data: any) => any;
  private callbacks: { [index: number]: (data: any) => any };

  constructor(sender: (data: any) => any, identifier = 'cmid') {
    this.identifier = identifier;
    this.counter = 1;
    this.sender = sender;
    this.callbacks = {};
  }

  private generateCbmId(): number {
    return this.counter++;
  }

  // siglepost, multicallbacks
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  post(data: any, callback: (data: any) => any): void {
    const cbmid = this.generateCbmId();
    data = { ...data };
    if (!data.id) data.id = {};
    data.id[this.identifier] = cbmid;
    this.callbacks[cbmid] = callback;
    this.sender.call(null, data);
  }

  // siglepost, singlecallback
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  postp(data: any): Promise<any> {
    return new Promise((resolve) => {
      const cbmid = this.generateCbmId();
      data = { ...data };
      if (!data.id) data.id = {};
      data.id[this.identifier] = cbmid;
      this.callbacks[cbmid] = resolve;
      this.sender.call(null, data);
    });
  }

  // multiposts, multicallbacks
  // 関数を返すので、ポストする時にその関数を使う
  multipost(callback: (data: any) => any): (data: any) => void {
    const cbmid = this.generateCbmId();
    this.callbacks[cbmid] = callback;
    return (data) => {
      data = { ...data };
      if (!data.id) data.id = {};
      data.id[this.identifier] = cbmid;
      this.sender.call(null, data);
    };
  }

  // continu: もう一度このcallbackを呼ぶ場合はtrue
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  handleReceive(data: any, continu = false): void {
    if (!data) {
      console.warn('CallbackManager::handleReceive: null received. reject.');
      return;
    }
    if (!data.id) {
      console.warn('CallbackManager::handleReceive: id not found. reject.');
      return;
    }
    const cbmid = data.id[this.identifier];
    if (!cbmid) {
      console.warn(
        'CallbackManager::handleReceive: id.' +
          this.identifier +
          ' not found. reject.'
      );
      return;
    }
    data.id = { ...data.id, cbmid: undefined }; // clone
    const cb = this.callbacks[cbmid];
    if (!cb) {
      console.warn(
        'CallbackManager::handleReceive: unknown id.' +
          this.identifier +
          '. reject.'
      );
      return;
    }
    if (!continu) {
      delete this.callbacks[cbmid];
    }
    cb.call(null, data);
  }

  getReceiveCallback(): (data: any, continu?: boolean) => void {
    return this.handleReceive.bind(this);
  }
}

export default CallbackManager;
