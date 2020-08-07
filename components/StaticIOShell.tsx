import React from 'react';

import TextArea from './Textarea';
import Button from './Button';
import StatusBar from './StatusBar';

type StaticIOShellProps = {
  onNeedEmitter: (callback: (data: any) => void) => (data: any) => void
}

type StaticIOShellStatus = {
  stdin: string,
  stdout: string,
  errlog: string,
  statuses: Array<{ text: string, color: string, key: string }>,
  visibleErr: boolean
}

class StaticIOShell extends React.Component<StaticIOShellProps, StaticIOShellStatus> {

  emitter?: (data: any) => void;

  constructor(props: StaticIOShellProps) {
    super(props);
    this.state = {
      stdin: '',
      stdout: '',
      errlog: '',
      statuses: [{ text: 'ready', color: 'light', key: '' }],
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

  private recieveResult(data) {
    let summaryColor = 'gray';
    if (data.result) {
      if (data.result.exited) {
        if (data.result.exitstatus !== 0) {
          summaryColor = 'warning';
        } else {
          summaryColor = 'success';
        }
        this.setStdout(data.result.out || '');
        this.setErrlog(data.result.err || '');
        this.emitter = null;
      }
    }
    else {
      // e.g. kill callback
    }
    if (data.summary)
      this.addStatus(data.summary, summaryColor);
  }

  private addStatus(text: string, color = 'light') {
    this.setState(Object.assign({}, this.state, { statuses: [{ text, color, key: Math.random().toString() }].concat(this.state.statuses) }));
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
              <Button onClick={this.handleClickRun} >run</Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickKill} >kill</Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.handleClickToggle} >IO/Err</Button>
            </div>
          </div>
          {
            this.state.visibleErr ? (
              <div className="flex_elem flex_row">
                <TextArea placeholder="stderr" value={this.state.errlog} readOnly={true} />
              </div>
            ) : (<div className="flex_elem flex_row">
              <div className="flex_elem_fix flex_cols" style={{ overflow: 'hidden', resize: 'both' }}>
                <TextArea placeholder="stdin" value={this.state.stdin}
                  onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdin: txt })))} />
              </div>
              <div className="flex_elem flex_cols">
                <TextArea placeholder="stdout" value={this.state.stdout}
                  onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdout: txt })))} />
              </div>
            </div>)
          }

        </div>
        <div className="flex_elem_fix">
          <StatusBar values={this.state.statuses}></StatusBar>
        </div>
      </div>
    );
  }
}

export default StaticIOShell;