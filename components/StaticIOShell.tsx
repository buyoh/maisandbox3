import React from 'react';

import TextArea from './Textarea';
import Button from './Button';
import StatusBar from './StatusBar';
import { Item as StatusBarItem } from './StatusBar';

type StaticIOShellProps = {
  onClickRun: () => void,
  onClickKill: () => void,
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

    this.handleClickToggle = this.handleClickToggle.bind(this);
  }

  addStatus(text: string, color = 'light', errlog: string | undefined, active?: boolean): void {
    const key = Math.random().toString();
    const status: StatusBarItem = {
      text,
      color,
      key,
      onClick: errlog ? (key: string) => {
        this.activateStatus(key);
        this.setErrlog(errlog);
      } : undefined
    };
    this.setState(Object.assign({}, this.state, { statuses: [status].concat(this.state.statuses) }));
    if (active)
      this.activateStatus(key);
  }

  removeAllStatuses(): void {
    this.setState(Object.assign({}, this.state, { statuses: [] }));
  }

  private activateStatus(key: string): void {
    this.setState(Object.assign({}, this.state, { activatedStatusKey: key }));
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
              <Button onClick={this.props.onClickRun} key="btn-run">run</Button>
            </div>
            <div className="flex_elem_fix">
              <Button onClick={this.props.onClickKill} key="btn-kill">kill</Button>
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