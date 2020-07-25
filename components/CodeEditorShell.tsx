import React from 'react';

import CodeToolbar from './CodeToolbar'
import CodeEditor from './CodeEditor'

const converterKey2Style = {
  cpp: 'c_cpp',
  ruby: 'ruby',
  python: 'python'
}

type CodeEditorShellProps = {
}

type CodeEditorShellState = {
  lang: string
}

class CodeEditorShell extends React.Component<CodeEditorShellProps, CodeEditorShellState> {

  refCodeEditor: React.RefObject<CodeEditor>;

  constructor(props: CodeEditorShellProps) {
    super(props);
    this.state = {
      lang: 'cpp'
    };

    this.refCodeEditor = React.createRef();
    this.getAllValue = this.getAllValue.bind(this);
    this.handleLangChange = this.handleLangChange.bind(this);
  }

  getAllValue(): { code: string, lang: string } {
    const code = this.refCodeEditor.current.getValue();
    const lang = this.state.lang;
    return { code, lang };
  }

  private handleLangChange(lang: string) {
    this.setState(Object.assign({}, this.state, { lang }));
  }

  render() {
    return (
      <div>
        <div>
          <CodeToolbar
            lang={this.state.lang}
            onLangChange={this.handleLangChange}
          />
        </div>
        <div className="border">
          <CodeEditor
            ref={this.refCodeEditor}
            lang={converterKey2Style[this.state.lang]}
          />
        </div>
      </div>
    )
  }
}

export default CodeEditorShell;