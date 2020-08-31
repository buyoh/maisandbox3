import React from 'react';

import TextArea from './Textarea';
import Button from './Button';
import StatusBar from './StatusBar';
import { Item as StatusBarItem } from './StatusBar';
import { Result, SubResultExec } from '../lib/type';

type StaticIOShellProps = {
  onNeedEmitter: (callback: (data: any) => void) => (data: any) => void
}

type StaticIOShellStatus = {
  stdin: string,
  stdout: string,
  errlog: string,
  statuses: Array<StatusBarItem>,
  activatedStatusKey: string,
  visibleErr: boolean
}

class StaticIOShell extends React.Component<StaticIOShellProps, StaticIOShellStatus> {

  emitter: ((data: any) => void) | null;

  constructor(props: StaticIOShellProps) {
    super(props);
    this.state = {
      stdin: '',
      stdout: '',
      errlog: '',
      statuses: [{ text: 'ready', color: 'light', key: '' }],
      activatedStatusKey: '',
      visibleErr: false
    };

    this.emitter = null;

    this.handleClickRun = this.handleClickRun.bind(this);
    this.handleClickKill = this.handleClickKill.bind(this);
    this.handleClickToggle = this.handleClickToggle.bind(this);
  }

  private generateJobRun() {
    this.clearStatus();
    return { action: 'run', stdin: this.state.stdin };
  }

  private generateJobKill() {
    return { action: 'kill' };  // TODO: index.tsx側でソースコードを無駄に送っている
  }

  private recieveResult(data: Result) {
    let summaryColor = 'gray';
    let errLog = '';
    if (data.result) {
      const resultAsExec = data.result as SubResultExec;
      if (resultAsExec.exited) {
        if (resultAsExec.exitstatus !== 0) {
          summaryColor = 'warning';
        } else {
          summaryColor = 'success';
        }
        this.setStdout(resultAsExec.out || '');
        this.setErrlog(resultAsExec.err || '');
        errLog = resultAsExec.err || '';
        this.emitter = null;
      }
    }
    else {
      // e.g. kill callback
    }
    if (data.summary) {
      this.addStatus(data.summary, summaryColor, errLog === '' ? undefined : (key: string) => {
        this.activateStatus(key);
        this.setErrlog(errLog);
      }, true);
    }
  }

  private addStatus(text: string, color = 'light', onClick?: (key: string) => void, active?: boolean) {
    const key = Math.random().toString();
    const status: StatusBarItem = {
      text,
      color,
      key,
      onClick
    };
    this.setState(Object.assign({}, this.state, { statuses: [status].concat(this.state.statuses) }));
    if (active)
      this.activateStatus(key);
  }

  private activateStatus(key: string): void {
    this.setState(Object.assign({}, this.state, { activatedStatusKey: key }));
  }

  private clearStatus() {
    this.setState(Object.assign({}, this.state, { statuses: [] }));
  }

  private handleClickRun() {
    this.emitter = this.props.onNeedEmitter(this.recieveResult.bind(this));
    this.emitter(this.generateJobRun());
  }

  private handleClickKill() {
    const em = this.emitter;
    if (!em) { return; }
    em(this.generateJobKill());
  }

  private handleClickToggle() {
    this.setState(Object.assign({}, this.state, { visibleErr: !this.state.visibleErr }));
  }

  testApis(): { handleClickRun: () => void, handleClickKill: () => void, handleClickToggle: () => void } {
    return {
      handleClickRun: this.handleClickRun,
      handleClickKill: this.handleClickKill,
      handleClickToggle: this.handleClickToggle
    };
  }

  getStdin(): string {
    return this.state.stdin;
  }

  setStdout(value: string): void {
    this.setState(Object.assign({}, this.state, { stdout: value }));
  }

  setErrlog(value: string): void {
    this.setState(Object.assign({}, this.state, { errlog: value }));
  }

  render(): JSX.Element {
    return (
      <div className="flex_cols">
        <div className="flex_elem flex_row">
          <div className="flex_elem_fix flex_cols">
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickRun} key="btn-run">run</Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickKill} key="btn-kill">kill</Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickToggle} key="btn-toggle-display">IO/Err</Button>
            </div>
          </div>
          {
            this.state.visibleErr ? (
              <div className="flex_elem flex_row" style={{ overflow: 'hidden', resize: 'vertical' }}>
                <TextArea placeholder="stderr" key="inp-err" value={this.state.errlog} readOnly={true} />
              </div>
            ) : (<div className="flex_elem flex_row" style={{ overflow: 'hidden', resize: 'vertical' }}>
              <div className="flex_elem_fix flex_cols">
                <TextArea placeholder="stdin" key="inp-in" value={this.state.stdin} resizable='horizontal'
                  onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdin: txt })))} />
              </div>
              <div className="flex_elem flex_cols">
                <TextArea placeholder="stdout" key="inp-out" value={this.state.stdout}
                  onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdout: txt })))} />
              </div>
            </div>)
          }

        </div>
        <div className="flex_elem_fix">
          <StatusBar values={this.state.statuses} active={this.state.activatedStatusKey}></StatusBar>
        </div>
      </div>
    );
  }
}

export default StaticIOShell;