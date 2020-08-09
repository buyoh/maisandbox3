import React from 'react';

import CodeToolbar from './CodeToolbar';
import CodeEditor from './CodeEditor';
import { pullFromLocalStorage, pushToLocalStorage } from './lib/LocalStorage';

const converterKey2Style: { [key: string]: string } = {
  cpp: 'c_cpp',
  ruby: 'ruby',
  python: 'python'
};

type CodeEditorShellSerialized = {
  code: string,
  lang: string
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
    this.handleTemplatePull = this.handleTemplatePull.bind(this);
    this.handleTemplatePush = this.handleTemplatePush.bind(this);
  }

  getAllValue(): { code: string, lang: string } {
    const code = this.getCode()
      || (() => { console.warn('getCode failed: this.refCodeEditor.current may null!!'); return ''; })();
    const lang = this.state.lang;
    return { code, lang };
  }

  getCode(): string | null {
    return this.refCodeEditor.current?.getValue() || null;
  }

  setCode(code: string): void {
    this.refCodeEditor.current?.setValue(code);
  }

  setLang(lang: string): void {
    this.setState(Object.assign({}, this.state, { lang }));
  }

  serialize(): CodeEditorShellSerialized {
    return this.getAllValue();
  }

  deserialize(data: CodeEditorShellSerialized): void {
    this.setCode(data.code);
    this.setLang(data.lang);
  }


  private handleLangChange(lang: string) {
    this.setState(Object.assign({}, this.state, { lang }));
  }

  private handleTemplatePull() {
    const li = pullFromLocalStorage('templates');
    if (!li) {
      return;
    }
    if (!li[this.state.lang]) {
      return;
    }
    this.setCode(li[this.state.lang]);
  }

  private handleTemplatePush() {
    let li = pullFromLocalStorage('templates');
    if (!li) {
      li = {};
    }
    li[this.state.lang] = this.getCode();
    pushToLocalStorage('templates', li);
  }

  render(): JSX.Element {
    return (
      <div>
        <div>
          <CodeToolbar
            lang={this.state.lang}
            onLangChange={this.handleLangChange}
            onClickPull={this.handleTemplatePull}
            onClickPush={this.handleTemplatePush}
          />
        </div>
        <div className="border">
          <CodeEditor
            ref={this.refCodeEditor}
            lang={converterKey2Style[this.state.lang] || ''}
          />
        </div>
      </div>
    );
  }
}

export default CodeEditorShell;