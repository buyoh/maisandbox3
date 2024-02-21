import React from 'react';
import { Dispatch } from 'redux';

import { RootState } from '../stores';
import TextArea from '../components/Textarea';
import Button from '../components/Button';
import * as Actions from '../stores/StaticIO/actions';
import * as StatusActions from '../stores/Status/actions';
import { connect } from 'react-redux';
import { Query, QueryInit, QueryInitInfoFileStdin } from '../../interfaces/QueryTypes';
import { Annotation, ReportItem, Result } from '../../interfaces/ResultTypes';
import * as CodeEditorActions from '../stores/CodeEditor/actions';
import { ClientSocket } from '../lib/ClientSocket';
import { ExecResult } from './StatusShell';

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
  socket: ClientSocket | null;
  code: string;
  lang: string;
}

interface DispatchProps {
  updateStdin: (stdin: string) => void;
  updateStdout: (stdout: string) => void;
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
  const activatedResultIndex = state.status.activatedResultIndex;
  return {
    stdin: state.staticIO.stdin,
    stdout: state.staticIO.stdout,
    errlog:
      activatedResultIndex === null
        ? ''
        : state.status.results[activatedResultIndex].log,
    socket: state.clientSocket.value,
    code: state.codeEditor.code,
    lang: state.codeEditor.lang,
  };
}

function mapDispatchToProps(dispatch: Dispatch): DispatchProps {
  return {
    updateStdin: (stdin: string) => dispatch(Actions.updateStdin(stdin)),
    updateStdout: (stdout: string) => dispatch(Actions.updateStdout(stdout)),
    addResult: (r: ExecResult) => dispatch(StatusActions.addResult(r)),
    clearResults: () => dispatch(StatusActions.removeAllResults()),
    addAnnotations: (annos: Annotation[]) =>
      dispatch(CodeEditorActions.addAnnotations(annos)),
    clearAnnotations: () => dispatch(CodeEditorActions.removeAllAnnotations()),
  };
}

interface ReactStatus {
  visibleErr: boolean;
}

export class StaticIOShell extends React.Component<CombinedProps, ReactStatus> {
  private emitter: ((data: Query) => void) | null; // for setd kill message

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
            // TODO: 仮？ 適切な配置場所に関してアイデアなし。
            details.push({
              type: 'text',
              title: 'stderr',
              text: item.text,
            });
            // TODO: 消す
            errLog = item.text;
            break;
          case 'status':
            status = item.status;
            break;
          case 'text':
            details.push(item);
            break;
          case 'param':
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

    // 非同期処理どう扱う？
    // とりあえずコンポーネント上でねじ伏せることにする
    // https://qiita.com/ryokkkke/items/d3a0375ef51448d345ed
    this.emitter = this.props.socket.generateForPostExec(this.processResult);
    const info = {
      type: 'filestdin',
      code: this.props.code,
      stdin: this.props.stdin,
    } as QueryInitInfoFileStdin;
    const data = {
      action: 'init',
      lang: this.props.lang,
      info,
    } as QueryInit;
    this.emitter(data);
  }

  private handleClickKill(): void {
    if (this.emitter) {
      this.emitter({ action: 'kill' });
    }
  }

  render(): JSX.Element {
    return (
      <div className="flex-column">
        <div className="flex-elem flex-row">
          <div className="flex-elem-fix flex-column">
            <div className="flex-elem-fix">
              <Button
                data-testid="button-run"
                onClick={this.handleClickRun}
                key="btn-run"
              >
                run
              </Button>
            </div>
            <div className="flex-elem-fix">
              <Button
                data-testid="button-kill"
                onClick={this.handleClickKill}
                key="btn-kill"
              >
                kill
              </Button>
            </div>
            <div className="flex-elem-fix">
              {/* TODO: 消す */}
              <Button
                data-testid="button-toggle-display"
                onClick={this.handleClickToggle}
                key="btn-toggle-display"
              >
                IO/Err
              </Button>
            </div>
          </div>
          {this.state.visibleErr ? (
            <div
              className="flex-elem flex-row"
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
              className="flex-elem flex-row"
              style={{ overflow: 'hidden', resize: 'vertical' }} // TODO: 全画面形式に変更したため、画面最下部の要素がresizeableだと変な操作感になる
            >
              <div className="flex-elem-fix flex-column">
                <TextArea
                  placeholder="stdin"
                  key="inp-in"
                  value={this.props.stdin}
                  resizable="horizontal"
                  onChange={this.props.updateStdin}
                />
              </div>
              <div className="flex-elem flex-column">
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
      </div>
    );
  }
}

export default connect<StateProps, DispatchProps, ReactProps, RootState>(
  mapStateToProps,
  mapDispatchToProps
)(StaticIOShell);
