import React from 'react';

import CodeEditor from './CodeEditor'

type CodeEditorShelllProps = {
}

class CodeEditorShell extends React.Component<CodeEditorShelllProps, {}> {

  refCodeEditor: React.RefObject<CodeEditor>;

  constructor(props: CodeEditorShelllProps) {
    super(props);
    this.state = {};

    this.refCodeEditor = React.createRef();
    this.getValue = this.getValue.bind(this);
  }

  getValue(): string {
    return this.refCodeEditor.current.getValue();
  }

  render() {
    return (
      <div>
        <div>
          <select>
            <option>Ruby</option>
          </select>
        </div>
        <div className="border">
          <CodeEditor ref={this.refCodeEditor} lang='ruby' />
        </div>
      </div>
    )
  }
}

export default CodeEditorShell;