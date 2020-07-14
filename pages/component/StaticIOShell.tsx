import React from 'react';

import TextArea from './Textarea';
import Button from './Button';

type StaticIOShellProps = {
  onEmitMessage: (job: any, callback: (data: any) => void) => boolean
}

class StaticIOShell extends React.Component<StaticIOShellProps, { stdin: string, stdout: string }> {
  constructor(props: StaticIOShellProps) {
    super(props);
    this.state = { stdin: '', stdout: '' };

    this.handleClickRun = this.handleClickRun.bind(this);
  }

  private generateJob() {
    return { stdin: this.state.stdin };
  }

  private emitJob() {
    const success = this.props.onEmitMessage(this.generateJob(), this.recieveResult.bind(this));
  }

  private recieveResult(data) {
    this.setStdout(data.result.out);
  }

  private handleClickRun() {
    this.emitJob();
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