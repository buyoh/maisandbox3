import React from 'react';

import CodeToolbar from './CodeToolbar'
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
          <CodeToolbar />
        </div>
        <div className="border">
          <CodeEditor ref={this.refCodeEditor} lang='c_cpp' />
        </div>
      </div>
    )
  }
}

export default CodeEditorShell;