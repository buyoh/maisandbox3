import React from 'react';

import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { RootState } from '../stores';
import CodeToolbar from '../components/CodeToolbar';
import CodeEditor from '../components/CodeEditor';
import { pullFromLocalStorage, pushToLocalStorage } from '../lib/LocalStorage';
import { Annotation } from '../../lib/type';
import * as Actions from '../stores/CodeEditor/actions';
import { CodeEditorActionTypes } from '../stores/CodeEditor/types';

const converterKey2Style: { [key: string]: string } = {
  cpp: 'c_cpp',
  ruby: 'ruby',
  python: 'python',
  clay: 'c_cpp'
};

type CodeEditorShellSerialized = {
  code: string,
  lang: string
}

type StateProps = {
  code: string
}

type DispatchProps = {
  updateCode: (code: string) => CodeEditorActionTypes
}

type ReactProps = {

}

type CombinedProps = ReactProps & StateProps & DispatchProps;


function mapStateToProps(state: RootState): StateProps {
  return {
    code: state.codeEditor.code
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    updateCode: (code: string) => dispatch(Actions.updateKeyword(code))
  };
}


// TODO:
type CodeEditorShellState = {
  lang: string,
  annotations: Annotation[]
}

class CodeEditorShell extends React.Component<CombinedProps, CodeEditorShellState> {

  refCodeEditor: React.RefObject<CodeEditor>;

  constructor(props: CombinedProps) {
    super(props);
    this.state = {
      lang: 'cpp',
      annotations: []
    };

    this.refCodeEditor = React.createRef();
    this.getAllValue = this.getAllValue.bind(this);
    this.setAnnotations = this.setAnnotations.bind(this);
    this.serialize = this.serialize.bind(this);
    this.deserialize = this.deserialize.bind(this);
    this.handleLangChange = this.handleLangChange.bind(this);
    this.handleTemplatePull = this.handleTemplatePull.bind(this);
    this.handleTemplatePush = this.handleTemplatePush.bind(this);
  }

  private getCode(): string | null {
    return this.props.code;
  }

  private setCode(code: string): void {
    this.props.updateCode(code);
  }

  private setLang(lang: string): void {
    this.setState(Object.assign({}, this.state, { lang }));
  }

  getAllValue(): { code: string, lang: string } {
    const code = this.getCode()
      || (() => { console.warn('getCode failed: this.refCodeEditor.current may null!!'); return ''; })();
    const lang = this.state.lang;
    return { code, lang };
  }

  setAnnotations(annotations: Annotation[]): void {
    this.setState(Object.assign({}, this.state, { annotations }));
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
            value={this.props.code}
            onChange={this.props.updateCode}
            ref={this.refCodeEditor}
            lang={converterKey2Style[this.state.lang] || ''}
            annotations={this.state.annotations}
          />
        </div>
      </div>
    );
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(mapStateToProps, mapDispatchToProps)(CodeEditorShell);
