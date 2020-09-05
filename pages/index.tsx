import React from 'react';

import SocketIOClient from 'socket.io-client';

import Meta from '../components/style/meta';
import Header from '../components/Header';

import CodeEditorShell from '../components/CodeEditorShell';
import StaticIOShell from '../components/StaticIOShell';
import { StaticIOShellBehavior } from '../behavior/StaticIOShellBehavior';
import { CoreBehavior } from '../behavior/CoreBehavior';
import { BackupBehavior } from '../behavior/BackupBehavior';
import { ClientSocket } from '../components/lib/ClientSocket';

type IndexState = {
}

export default class Index extends React.Component<{}, IndexState> {

  private refIOEditor: React.RefObject<StaticIOShell>;
  private refCodeEditor: React.RefObject<CodeEditorShell>;
  private coreBehavior: CoreBehavior;
  private backupBehavior: BackupBehavior;
  private staticIOShellBehavior: StaticIOShellBehavior;

  constructor(props: {}) {
    super(props);
    this.state = {};
    this.refIOEditor = React.createRef();
    this.refCodeEditor = React.createRef();

    this.handleLoad = this.handleLoad.bind(this);
    this.handleUnload = this.handleUnload.bind(this);

    this.coreBehavior = new CoreBehavior();
    this.backupBehavior = new BackupBehavior(this.refCodeEditor);
    this.staticIOShellBehavior = new StaticIOShellBehavior(
      this.coreBehavior.handleEmitMessage, this.refIOEditor, this.refCodeEditor);
  }

  componentDidMount(): void {
    window.addEventListener('beforeunload', this.handleUnload);
    this.handleLoad();
  }

  componentWillUnmount(): void {
    window.removeEventListener('beforeunload', this.handleUnload);
    this.handleUnload();  // call twice?
  }

  private handleLoad(): void {
    this.coreBehavior.setClientSocket(new ClientSocket(SocketIOClient()));
    this.backupBehavior.handlePageLoad();
  }

  private handleUnload(): void {
    this.backupBehavior.handlePageUnLoad();
  }

  render(): JSX.Element {
    return (
      <div>
        <Meta />
        <Header />
        <main>
          <div className="flex_row">
            <div className="flex_elem">
              <CodeEditorShell ref={this.refCodeEditor} />
            </div>
          </div>

          <div>
            <StaticIOShell ref={this.refIOEditor}
              onClickRun={this.staticIOShellBehavior.handlePostRun}
              onClickKill={this.staticIOShellBehavior.handlePostKill} />
          </div>
        </main>
      </div>
    );
  }
}
