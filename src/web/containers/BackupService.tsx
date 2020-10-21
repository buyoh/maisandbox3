import React from 'react';
import { Dispatch } from 'redux';
import { RootState } from '../stores';
import { connect } from 'react-redux';
import * as CodeEditorActions from '../stores/CodeEditor/actions';
import { pullFromLocalStorage, pushToLocalStorage } from '../lib/LocalStorage';

function pullBackupData(): any {
  return pullFromLocalStorage('backup');
}

function pushBackupData(data: any): void {
  pushToLocalStorage('backup', data);
}

// - - - - -

type StateProps = {
  lang: string;
  code: string;
};

interface DispatchProps {
  updateLang: (lang: string) => void;
  updateCode: (code: string) => void;
}

type ReactProps = {};

type CombinedProps = ReactProps & StateProps & DispatchProps;

function mapStateToProps(state: RootState): StateProps {
  return {
    lang: state.codeEditor.lang,
    code: state.codeEditor.code,
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    updateLang: (lang: string) => dispatch(CodeEditorActions.updateLang(lang)),
    updateCode: (code: string) => dispatch(CodeEditorActions.updateCode(code)),
  };
}

type ReactState = {};

class BackupService extends React.Component<CombinedProps, ReactState> {
  private timerId: number | null;

  constructor(props: CombinedProps) {
    super(props);
    this.state = {};
    this.storeBackup = this.storeBackup.bind(this);
    this.timerId = null;
  }

  componentDidMount(): void {
    window.addEventListener('beforeunload', this.storeBackup);
    this.timerId = window.setInterval(() => {
      this.storeBackup();
    }, 60 * 1000);
    this.restoreBackup();
  }

  componentWillUnmount(): void {
    window.removeEventListener('beforeunload', this.storeBackup);
    this.storeBackup(); // call twice?
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private restoreBackup(): void {
    let data = pullBackupData();
    if (!data) data = {};
    if (data['codeEditorShell']) {
      this.props.updateCode(data.codeEditorShell.code);
      this.props.updateLang(data.codeEditorShell.lang);
    }
  }

  private storeBackup(): void {
    let data = pullBackupData();
    if (!data) data = {};
    {
      const cds = {
        code: this.props.code,
        lang: this.props.lang,
      };
      data['codeEditorShell'] = cds;
    }
    pushBackupData(data);
  }

  render(): JSX.Element {
    return <></>;
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(BackupService);
