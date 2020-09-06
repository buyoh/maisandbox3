// import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
// import { act } from 'react-dom/test-utils';
// import { assert } from 'chai';
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
configure({ adapter: new Adapter() });

//@ts-ignore
import jsdom from 'mocha-jsdom';

// import StaticIOShell from '../../../components/StaticIOShell';

let container: Element | null = null;
beforeEach(() => {
  // setup a DOM element as a render target
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  // cleanup on exiting
  if (container) {
    unmountComponentAtNode(container);
    container.remove();
    container = null;
  }
});

describe('StaticIOShell', () => {
  global.document = jsdom({
    url: 'http://localhost'
  });

  it('emit run', () => {
    // NOTE: obsoleted.
    // 参考実装の為にコメントとして残してある。
    // // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const handlerOnNeedEmitter = (_: (data: any) => void) => {
    //   return (data: any) => {
    //     assert.hasAllKeys(data, { action: 'run', stdin: '' }, 'check emitted data');
    //     done();
    //     return;
    //   };
    // };

    // const ref = React.createRef<StaticIOShell>();
    // // eslint-disable-next-line @typescript-eslint/no-empty-function
    // const codeEditor = (<StaticIOShell ref={ref} onNeedEmitter={handlerOnNeedEmitter} annotationSetter={() => { }} />);
    // // const wrapper = shallow(codeEditor);
    // act(() => {
    //   render(codeEditor, container);
    //   // ref.current?.setValue('hello\nworld\n');
    // });
    // const apis = ref.current?.testApis();
    // apis?.handleClickRun.call(ref.current);
    // // assert.isAbove(wrapper.find({ key: 'btn-run' }).length, 0, 'btn-run exists');
    // // assert.equal(ref.current?.getValue(), 'hello\nworld\n', 'setValue / getValue failed');
  });
});