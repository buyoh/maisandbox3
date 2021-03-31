import React from 'react';
import { Dispatch } from 'redux';

import { RootState } from '../stores';
import TextArea from '../components/Textarea';
import Button from '../components/Button';
import StatusBar from '../components/StatusBar';
import { Item as StatusBarItem } from '../components/StatusBar';
import * as Actions from '../stores/StaticIO/actions';
import { connect } from 'react-redux';
import { Annotation, ReportItem, Result } from '../../lib/type';
import * as CodeEditorActions from '../stores/CodeEditor/actions';
import { ClientSocket } from '../lib/ClientSocket';
import StatusDetail from '../components/StatusDetail';

type Runnable = (data: any) => void;

export interface ExecResult {
  color: string;
  summary: string;
  log: string;
  details: ReportItem[] | null;
}

function determineResultColor(data: Result): string {
  let summaryColor = 'light';
  if (!data.running) {
    summaryColor = 'gray';
  }
  return summaryColor;
}

// - - - - -

interface StateProps {
  stdin: string;
  stdout: string;
  errlog: string;
  statuses: Array<StatusBarItem>;
  activatedStatusKey: number;
  activatedStatusDetail: ReportItem[] | null;
  socket: ClientSocket | null;
  code: string;
  lang: string;
}

interface DispatchProps {
  updateStdin: (stdin: string) => void;
  updateStdout: (stdout: string) => void;
  activateResult: (idx: number) => void;
  addResult: (r: ExecResult) => void;
  clearResults: () => void;
  addAnnotations: (annos: Annotation[]) => void;
  clearAnnotations: () => void;
}

type ReactProps = {
  // onClickRun: () => void,
  // onClickKill: () => void,
};

type CombinedProps = ReactProps & StateProps & DispatchProps;

function mapStateToProps(state: RootState): StateProps {
  const activatedResultIndex = state.staticIO.activatedResultIndex;
  return {
    stdin: state.staticIO.stdin,
    stdout: state.staticIO.stdout,
    errlog:
      activatedResultIndex === null
        ? ''
        : state.staticIO.results[activatedResultIndex].log,
    statuses: state.staticIO.results
      .map((r, i) => ({
        color: r.color,
        text: r.summary,
        key: '' + i,
        onClick: undefined, // renderで挿入する
      }))
      .reverse(),
    activatedStatusKey:
      activatedResultIndex === null ? -1 : activatedResultIndex,
    activatedStatusDetail:
      activatedResultIndex === null
        ? null
        : state.staticIO.results[activatedResultIndex].details,
    socket: state.clientSocket.value,
    code: state.codeEditor.code,
    lang: state.codeEditor.lang,
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    updateStdin: (stdin: string) => dispatch(Actions.updateStdin(stdin)),
    updateStdout: (stdout: string) => dispatch(Actions.updateStdout(stdout)),
    activateResult: (idx: number) => dispatch(Actions.activateResult(idx)),
    addResult: (r: ExecResult) => dispatch(Actions.addResult(r)),
    clearResults: () => dispatch(Actions.removeAllResults()),
    addAnnotations: (annos: Annotation[]) =>
      dispatch(CodeEditorActions.addAnnotations(annos)),
    clearAnnotations: () => dispatch(CodeEditorActions.removeAllAnnotations()),
  };
}

interface ReactStatus {
  visibleErr: boolean;
}

export class StaticIOShell extends React.Component<CombinedProps, ReactStatus> {
  private emitter: Runnable | null; // for setd kill message

  constructor(props: CombinedProps) {
    super(props);
    this.state = {
      visibleErr: false,
    };

    this.emitter = null;

    this.handleClickToggle = this.handleClickToggle.bind(this);
    this.processResult = this.processResult.bind(this);
    this.handleClickRun = this.handleClickRun.bind(this);
    this.handleClickKill = this.handleClickKill.bind(this);
  }

  private processResult(data: Result): void {
    let errLog = '';
    let status = determineResultColor(data);
    let details = null as ReportItem[] | null;
    if (data.continue === false) {
      this.emitter = null; // disable kill
    }
    if (data.details) {
      details = [];
      for (const item of data.details) {
        switch (item.type) {
          case 'out':
            this.props.updateStdout(item.text);
            break;
          case 'log':
            errLog = item.text || '';
            break;
          case 'status':
            status = item.status;
            break;
          case 'text':
            // TODO:
            details.push(item);
            break;
          case 'param':
            // TODO:
            details.push(item);
            break;
          case 'annotation':
            this.props.addAnnotations(item.annotations);
            break;
          default:
            console.error('unknown detail type', (item as any).type);
            break;
        }
      }
    }
    if (data.summary) {
      this.props.addResult({
        color: status,
        summary: data.summary,
        log: errLog,
        details,
      });
    }
  }

  private handleClickToggle(): void {
    this.setState(
      Object.assign({}, this.state, { visibleErr: !this.state.visibleErr })
    );
  }

  private handleClickRun(): void {
    if (this.props.socket === null) return;

    this.props.clearResults();
    this.props.clearAnnotations();

    // とりあえずコンポーネント上でねじ伏せることにする
    // https://qiita.com/ryokkkke/items/d3a0375ef51448d345ed
    const emitter = this.props.socket.generateForPostExec(this.processResult);
    const data = {
      action: 'run',
      stdin: this.props.stdin,
      code: this.props.code,
      lang: this.props.lang,
    };
    emitter({ data });
    this.emitter = emitter;
  }

  private handleClickKill(): void {
    if (this.emitter) {
      this.emitter({ data: { action: 'kill' } });
    }
  }

  render(): JSX.Element {
    return (
      <div className="flex_cols">
        <div className="flex_elem flex_row">
          <div className="flex_elem_fix flex_cols">
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickRun} key="btn-run">
                run
              </Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickKill} key="btn-kill">
                kill
              </Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickToggle} key="btn-toggle-display">
                IO/Err
              </Button>
            </div>
          </div>
          {this.state.visibleErr ? (
            <div
              className="flex_elem flex_row"
              style={{ overflow: 'hidden', resize: 'vertical' }}
            >
              <TextArea
                placeholder="stderr"
                key="inp-err"
                value={this.props.errlog}
                readOnly={true}
              />
            </div>
          ) : (
            <div
              className="flex_elem flex_row"
              style={{ overflow: 'hidden', resize: 'vertical' }}
            >
              <div className="flex_elem_fix flex_cols">
                <TextArea
                  placeholder="stdin"
                  key="inp-in"
                  value={this.props.stdin}
                  resizable="horizontal"
                  onChange={this.props.updateStdin}
                />
              </div>
              <div className="flex_elem flex_cols">
                <TextArea
                  placeholder="stdout"
                  key="inp-out"
                  value={this.props.stdout}
                  onChange={this.props.updateStdout}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex_elem_fix">
          <StatusBar
            values={this.props.statuses.map((e) => ({
              ...e,
              onClick: () => this.props.activateResult(+e.key),
            }))}
            active={'' + this.props.activatedStatusKey}
          />
        </div>
        <div className="flex_elem_fix">
          {this.props.activatedStatusDetail ? (
            <StatusDetail details={this.props.activatedStatusDetail} />
          ) : (
            <></>
          )}
        </div>
      </div>
    );
  }

  forTestHandler(): {
    handleClickRun: StaticIOShell['handleClickRun'];
    handleClickKill: StaticIOShell['handleClickKill'];
    handleClickToggle: StaticIOShell['handleClickToggle'];
  } {
    return {
      handleClickRun: this.handleClickRun,
      handleClickKill: this.handleClickKill,
      handleClickToggle: this.handleClickToggle,
    };
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(StaticIOShell);
