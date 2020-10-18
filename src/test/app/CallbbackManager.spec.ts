import CallbackManager from '../../lib/CallbackManager';

test('simple post', (done) => {
  let myCallback: ((data: any) => void) | null = null;
  const cm = new CallbackManager((data) => {
    setTimeout(() => {
      expect(myCallback).not.toBeNull();
      if (myCallback)
        myCallback(data);
    }, data.delay || 0);
  });
  myCallback = cm.getRecieveCallback();

  cm.post({ msg: 100, delay: 0 }, (data) => {
    expect(data.msg).toEqual(100);  // keep data
    expect(data.cbmid).not.toBeInstanceOf(Number);  // cbmid hidden
    expect(data.cbmid).toBeFalsy();  // cbmid hidden
    done();
  });
});

test('twice post', (done) => {
  let myCallback: ((data: any) => void) | null = null;
  const cm = new CallbackManager((data) => {
    setTimeout(() => {
      if (myCallback)
        myCallback(data);
    }, data.delay || 0);
  });
  myCallback = cm.getRecieveCallback();

  let counter = 0;
  cm.post({ msg: 100, delay: 10 }, (data) => {
    expect(data.msg).toEqual(100);
    if (++counter == 2) done();
  });
  cm.post({ msg: 200, delay: 20 }, (data) => {
    expect(data.msg).toEqual(200);
    if (++counter == 2) done();
  });
});

test('twice post cross', (done) => {
  let myCallback: ((data: any) => void) | null = null;
  const cm = new CallbackManager((data) => {
    setTimeout(() => {
      if (myCallback)
        myCallback(data);
    }, data.delay || 0);
  });
  myCallback = cm.getRecieveCallback();

  let counter = 0;
  cm.post({ msg: 100, delay: 20 }, (data) => {
    expect(data.msg).toEqual(100);
    if (++counter == 2) done();
  });
  cm.post({ msg: 200, delay: 10 }, (data) => {
    expect(data.msg).toEqual(200);
    if (++counter == 2) done();
  });
});

test('simple promise post', (done) => {
  let myCallback: ((data: any) => void) | null = null;
  const cm = new CallbackManager((data) => {
    setTimeout(() => {
      if (myCallback)
        myCallback(data);
    }, data.delay || 0);
  });
  myCallback = cm.getRecieveCallback();

  (async () => {
    const d1 = await cm.postp({ msg: 100, delay: 0 });
    expect(d1.msg).toEqual(100);
    const d2 = await cm.postp({ msg: 200, delay: 0 });
    expect(d2.msg).toEqual(200);
    done();
  })();
});

test('post2, recv1', (done) => {
  let myCallback: ((data: any) => void) | null = null;
  let sendCount = 0;
  let sum = 0;

  const cm = new CallbackManager((data) => {
    sum += data.val;

    if (++sendCount == 2)
      setTimeout(() => {
        if (myCallback)
          myCallback({ sum, id: data.id });
      }, data.delay || 0);
  });
  myCallback = cm.getRecieveCallback();

  const poster = cm.multipost((data) => {
    expect(sum).toEqual(3);  // call sender successfully
    expect(data.sum).toEqual(3);  // check keep data
    done();
  });

  poster({ val: 1 });
  poster({ val: 2 });
});

test('post2, recv2', (done) => {
  let myCallback: ((data: any, continu: boolean) => void) | null = null;
  let sendCount = 0;
  let sum = 0;

  const cm = new CallbackManager((data) => {
    sum += data.val;

    if (++sendCount == 2) {
      setTimeout(() => {
        if (myCallback)
          myCallback({ sum, idx: 0, id: data.id }, true);
      }, 0);
      setTimeout(() => {
        if (myCallback)
          myCallback({ sum, idx: 1, id: data.id }, false);
      }, 20);
    }
  });
  myCallback = cm.getRecieveCallback();

  let cntCallback = 0;
  const poster = cm.multipost((data) => {
    expect(sum).toEqual(3);  // call sender successfully
    expect(data.sum).toEqual(3);  // check keep data
    expect(data.idx).toEqual(cntCallback);  // lazy callback successfully
    ++cntCallback;
    if (cntCallback == 2)
      done();
  });

  poster({ val: 1 });
  poster({ val: 2 });
});
