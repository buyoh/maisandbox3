import React from 'react';

import TextArea from './Textarea';
import Button from './Button';
import StatusBadge from './StatusBadge';

type StaticIOShellProps = {
  onEmitMessage: (job: any, callback: (data: any) => void, id?: string) => string
}

type StaticIOShellStatus = {
  stdin: string,
  stdout: string,
  statusText: string
}

class StaticIOShell extends React.Component<StaticIOShellProps, StaticIOShellStatus> {

  emitMessageId?: string;

  constructor(props: StaticIOShellProps) {
    super(props);
    this.state = {
      stdin: '',
      stdout: '',
      statusText: 'ready',
    };

    this.emitMessageId = null;

    this.handleClickRun = this.handleClickRun.bind(this);
    this.handleClickKill = this.handleClickKill.bind(this);
  }

  private generateJobRun() {
    return { action: 'run', stdin: this.state.stdin };
  }

  private generateJobKill() {
    return { action: 'kill' };  // TODO: index.tsx側でソースコードを無駄に送っている
  }

  private recieveResult(data) {
    if (data.result) {
      if (data.result.exited) {
        this.setStdout(data.result.out);
        this.setState(Object.assign({}, this.state, { statusText: 'exited' }));
        this.emitMessageId = null;
      }
      else {
        this.setState(Object.assign({}, this.state, { statusText: 'running' }));
      }
    }
    else {
      // e.g. kill callback
    }
  }

  private handleClickRun() {
    const id = this.props.onEmitMessage(this.generateJobRun(), this.recieveResult.bind(this));
    this.emitMessageId = id;
  }

  private handleClickKill() {
    const id = this.emitMessageId;
    if (!id) { return; }
    this.emitMessageId = this.props.onEmitMessage(this.generateJobKill(), null, id);
  }

  getStdin(): string {
    return this.state.stdin;
  }

  setStdout(value: string) {
    this.setState(Object.assign({}, this.state, { stdout: value }));
  }

  render() {
    return (
      <div className="flex_row">
        <div className=".flex_elem_fix">
          <Button onClick={this.handleClickRun} >run</Button>
          <Button onClick={this.handleClickKill} >kill</Button>
          <StatusBadge color={"light"}>{this.state.statusText}</StatusBadge>
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
    )
  }
}

export default StaticIOShell;