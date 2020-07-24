import React, { useEffect, ReactEventHandler } from "react";
import { CSSProperties } from 'react';

import { IdProvider } from '../components/lib/IdProvider';

import SocketIOClient from 'socket.io-client';

import Meta from '../components/style/meta';
import Header from '../components/Header';

import CodeEditor from '../components/CodeEditor';
import CodeEditorShell from '../components/CodeEditorShell'
import StaticIOShell from '../components/StaticIOShell';

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
      const callback = this.resultCallbacks[data.id];
      if (!callback) {
        console.warn('data.id was not found: ', data.id);
        return;
      }
      callback.call(null, data);
    });
  }

  private handleEmitMessage(jobs: any, callback?: (data: any) => void, id?: string): string {
    const code = this.refCodeEditor.current.getValue();
    id = id || IdProvider.nextNumber().toString();
    if (callback) this.resultCallbacks[id] = callback;
    jobs = Object.assign({}, jobs, { code });
    this.socket.emit('c2e_Exec', { data: jobs, id });
    return id;
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
