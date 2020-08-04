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
  statuses: Array<{ text: string, color: string }>
}

class StaticIOShell extends React.Component<StaticIOShellProps, StaticIOShellStatus> {

  emitter?: (data: any) => void;

  constructor(props: StaticIOShellProps) {
    super(props);
    this.state = {
      stdin: '',
      stdout: '',
      statuses: [{ text: 'ready', color: 'light' }],
    };

    this.emitter = null;

    this.handleClickRun = this.handleClickRun.bind(this);
    this.handleClickKill = this.handleClickKill.bind(this);
  }

  private generateJobRun() {
    this.clearStatus();
    return { action: 'run', stdin: this.state.stdin };
  }

  private generateJobKill() {
    return { action: 'kill' };  // TODO: index.tsx側でソースコードを無駄に送っている
  }

  private recieveResult(data) {
    if (data.result) {
      if (data.result.exited) {
        let out = '';
        if (data.result.exitstatus !== 0) {
          out += data.result.err;
          out += '==========';
        }
        out += data.result.out || '';
        this.setStdout(out);
        this.addStatus('exited');
        this.emitter = null;
      }
      else {
        this.addStatus('running');
      }
    }
    else {
      // e.g. kill callback
    }
  }

  private addStatus(text: string, color = 'light') {
    this.setState(Object.assign({}, this.state, { statuses: [{ text, color }].concat(this.state.statuses) }));
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

  getStdin(): string {
    return this.state.stdin;
  }

  setStdout(value: string): void {
    this.setState(Object.assign({}, this.state, { stdout: value }));
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
          </div>
          <div className="flex_elem border">
            <TextArea value={this.state.stdin}
              onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdin: txt })))}
            />
          </div>
          <div className="flex_elem border">
            <TextArea value={this.state.stdout}
              onChange={(txt) => (this.setState(Object.assign({}, this.state, { stdout: txt })))} />
          </div>
        </div>
        <div className="flex_elem_fix">
          <StatusBar values={this.state.statuses}></StatusBar>
        </div>
      </div>
    );
  }
}

export default StaticIOShell;