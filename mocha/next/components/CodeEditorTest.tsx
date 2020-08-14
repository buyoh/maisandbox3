import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import { assert } from 'chai';
//@ts-ignore
import jsdom from 'mocha-jsdom';

import CodeEditor from '../../../components/CodeEditor';

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

describe('CodeEditor', () => {
  global.document = jsdom({
    url: 'http://localhost'
  });

  it('render CodeEditor', () => {
    const refEditor = React.createRef<CodeEditor>();
    const codeEditor = (<CodeEditor ref={refEditor} lang='ruby' />);
    act(() => {
      render(codeEditor, container);
      refEditor.current?.setValue('hello\nworld\n');
    });
    assert.equal(refEditor.current?.getValue(), 'hello\nworld\n', 'setValue / getValue failed');
  });
});