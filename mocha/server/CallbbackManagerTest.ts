import CallbackManager from '../../lib/CallbackManager';
import { assert } from 'chai';

/* eslint-env mocha */

describe('CallbackManagerTest', () => {

  it('simple post', (done) => {
    let myCallback: (data: any) => void;
    const cm = new CallbackManager((data) => {
      setTimeout(() => {
        myCallback(data);
      }, data.delay || 0);
    })
    myCallback = cm.getRecieveCallback();

    cm.post({ msg: 100, delay: 0 }, (data) => {
      assert.equal(data.msg, 100, "keep data");
      assert.isNotNumber(data.cbmid, "cbmid hidden");
      assert.isTrue(!data.cbmid, "cbmid hidden");
      done();
    });
  });

  it('twice post', (done) => {
    let myCallback: (data: any) => void;
    const cm = new CallbackManager((data) => {
      setTimeout(() => {
        myCallback(data);
      }, data.delay || 0);
    })
    myCallback = cm.getRecieveCallback();

    let counter = 0;
    cm.post({ msg: 100, delay: 10 }, (data) => {
      assert.equal(data.msg, 100, "keep data");
      if (++counter == 2) done();
    });
    cm.post({ msg: 200, delay: 20 }, (data) => {
      assert.equal(data.msg, 200, "keep data");
      if (++counter == 2) done();
    });
  });

  it('twice post cross', (done) => {
    let myCallback: (data: any) => void;
    const cm = new CallbackManager((data) => {
      setTimeout(() => {
        myCallback(data);
      }, data.delay || 0);
    })
    myCallback = cm.getRecieveCallback();

    let counter = 0;
    cm.post({ msg: 100, delay: 20 }, (data) => {
      assert.equal(data.msg, 100, "keep data");
      if (++counter == 2) done();
    });
    cm.post({ msg: 200, delay: 10 }, (data) => {
      assert.equal(data.msg, 200, "keep data");
      if (++counter == 2) done();
    });
  });

  it('simple promise post', (done) => {
    let myCallback: (data: any) => void;
    const cm = new CallbackManager((data) => {
      setTimeout(() => {
        myCallback(data);
      }, data.delay || 0);
    })
    myCallback = cm.getRecieveCallback();

    (async () => {
      const d1 = await cm.postp({ msg: 100, delay: 0 });
      assert.equal(d1.msg, 100, "keep data");
      const d2 = await cm.postp({ msg: 200, delay: 0 });
      assert.equal(d2.msg, 200, "keep data");
      done();
    })();
  });

  it('post2, recv1', (done) => {
    let myCallback: (data: any) => void;
    let sendCount = 0;
    let sum = 0;

    const cm = new CallbackManager((data) => {
      sum += data.val;

      if (++sendCount == 2)
        setTimeout(() => {
          myCallback({ sum, id: data.id });
        }, data.delay || 0);
    })
    myCallback = cm.getRecieveCallback();

    const poster = cm.multipost((data) => {
      assert.equal(sum, 3, "call sender successfully");
      assert.equal(data.sum, 3, "check keep data");
      done();
    });

    poster({ val: 1 });
    poster({ val: 2 });
  });

  it('post2, recv2', (done) => {
    let myCallback: (data: any, continu: boolean) => void;
    let sendCount = 0;
    let sum = 0;

    const cm = new CallbackManager((data) => {
      sum += data.val;

      if (++sendCount == 2) {
        setTimeout(() => {
          myCallback({ sum, idx: 0, id: data.id }, true);
        }, 0);
        setTimeout(() => {
          myCallback({ sum, idx: 1, id: data.id }, false);
        }, 20);
      }
    })
    myCallback = cm.getRecieveCallback();

    let cntCallback = 0;
    const poster = cm.multipost((data) => {
      assert.equal(sum, 3, "call sender successfully");
      assert.equal(data.sum, 3, "check keep data");
      assert.equal(data.idx, cntCallback, "lazy callback successfully");
      ++cntCallback;
      if (cntCallback == 2)
        done();
    });

    poster({ val: 1 });
    poster({ val: 2 });
  });
});
