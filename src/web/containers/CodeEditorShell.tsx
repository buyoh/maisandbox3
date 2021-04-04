import React from 'react';

import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { RootState } from '../stores';
import CodeToolbar from '../components/CodeToolbar';
import CodeEditor from '../components/CodeEditor';
import { pullFromLocalStorage, pushToLocalStorage } from '../lib/LocalStorage';
import { Annotation } from '../../lib/ResultTypes';
import * as Actions from '../stores/CodeEditor/actions';
import { CodeEditorActionTypes } from '../stores/CodeEditor/types';

const converterKey2Style: { [key: string]: string } = {
  cpp: 'c_cpp',
  ruby: 'ruby',
  python: 'python',
  clay: 'c_cpp',
};

interface StateProps {
  code: string;
  lang: string;
  annotations: Annotation[];
}

interface DispatchProps {
  updateCode: (code: string) => CodeEditorActionTypes;
  updateLang: (lang: string) => CodeEditorActionTypes;
}

type ReactProps = {};

type CombinedProps = ReactProps & StateProps & DispatchProps;

function mapStateToProps(state: RootState): StateProps {
  return {
    code: state.codeEditor.code,
    lang: state.codeEditor.lang,
    annotations: state.codeEditor.annotations,
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    updateCode: (code: string) => dispatch(Actions.updateCode(code)),
    updateLang: (lang: string) => dispatch(Actions.updateLang(lang)),
  };
}

type ReactState = {};

class CodeEditorShell extends React.Component<CombinedProps, ReactState> {
  refCodeEditor: React.RefObject<CodeEditor>;

  constructor(props: CombinedProps) {
    super(props);
    this.state = {};

    this.refCodeEditor = React.createRef();
    this.setAnnotations = this.setAnnotations.bind(this);
    this.handleTemplatePull = this.handleTemplatePull.bind(this);
    this.handleTemplatePush = this.handleTemplatePush.bind(this);
  }

  setAnnotations(annotations: Annotation[]): void {
    this.setState(Object.assign({}, this.state, { annotations }));
  }

  private handleTemplatePull() {
    const li = pullFromLocalStorage('templates');
    if (!li) {
      return;
    }
    if (!li[this.props.lang]) {
      return;
    }
    this.props.updateCode(li[this.props.lang]);
  }

  private handleTemplatePush() {
    let li = pullFromLocalStorage('templates');
    if (!li) {
      li = {};
    }
    li[this.props.lang] = this.props.code;
    pushToLocalStorage('templates', li);
  }

  render(): JSX.Element {
    return (
      <div>
        <div>
          <CodeToolbar
            lang={this.props.lang}
            onLangChange={this.props.updateLang}
            onClickPull={this.handleTemplatePull}
            onClickPush={this.handleTemplatePush}
          />
        </div>
        <div className="border">
          <CodeEditor
            value={this.props.code}
            onChange={this.props.updateCode}
            ref={this.refCodeEditor}
            lang={converterKey2Style[this.props.lang] || ''}
            annotations={this.props.annotations}
          />
        </div>
      </div>
    );
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(CodeEditorShell);
