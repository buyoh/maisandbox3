import React, { useEffect, ReactEventHandler } from "react";
import { CSSProperties } from 'react';

import { IdProvider } from './component/lib/IdProvider';

import SocketIOClient from 'socket.io-client';

import Meta from './component/style/meta';
import Header from './component/Header';

import CodeEditor from './component/CodeEditor';
import CodeEditorShell from './component/CodeEditorShell'
import StaticIOShell from './component/StaticIOShell';

// const RowFlexStyle: CSSProperties = {
//   display: 'flex',
//   flexDirection: 'row'
// };

// const RowFlexElemStyle: CSSProperties = {
//   flex: '1'
// }

type IndexState = {
}

export default class extends React.Component<{}, IndexState> {

  socket: SocketIOClient.Socket;
  refIOEditor: React.RefObject<StaticIOShell>;
  refCodeEditor: React.RefObject<CodeEditorShell>;
  resultCallbacks: any;

  constructor(props) {
    super(props);
    this.state = {
    };
    this.socket = null;
    this.resultCallbacks = {};  // note: 削除しないので溜まっていく
    this.refIOEditor = React.createRef();
    this.refCodeEditor = React.createRef();

    this.handleEmitMessage = this.handleEmitMessage.bind(this);
  }

  componentDidMount() {
    this.socket = SocketIOClient();
    this.socket.on('connected', () => {
      console.log('connected');
    });
    this.socket.on('mypong', (data) => {
      console.log('mypong', data);
    });
    this.socket.on('s2c_ResultExec', (data) => {
      console.log('resultexec', data);
      const cb = this.resultCallbacks[data.id]?.call(null, data);
    });
  }

  private handleEmitMessage(jobs: any, callback: (data: any) => void): boolean {
    const code = this.refCodeEditor.current.getValue();
    const id = IdProvider.nextNumber().toString();
    this.resultCallbacks[id] = callback;
    jobs = Object.assign({}, jobs, { code });
    this.socket.emit('c2e_Exec', { data: jobs, id });
    // TODO: how to use callback? need identifier
    return true;
  }

  render() {
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
            <StaticIOShell ref={this.refIOEditor} onEmitMessage={this.handleEmitMessage} />
          </div>
        </main>
      </div>
    )
  }
}
