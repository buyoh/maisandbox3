import React, { useEffect, ReactEventHandler } from "react";
import { CSSProperties } from 'react';

import { IdProvider } from '../components/lib/IdProvider';

import SocketIOClient from 'socket.io-client';

import Meta from '../components/style/meta';
import Header from '../components/Header';

import CodeEditor from '../components/CodeEditor';
import CodeEditorShell from '../components/CodeEditorShell'
import StaticIOShell from '../components/StaticIOShell';
import { ClientSocket } from "../components/lib/ClientSocket";

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

  socket: ClientSocket;
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
    this.socket = new ClientSocket(SocketIOClient());
  }

  private handleEmitMessage(callback: (data: any) => void): (data: any) => void {
    const editorValues = this.refCodeEditor.current.getAllValue();
    const post = this.socket.generateForPostExec(callback);
    const emitter = (data: any) => {
      data = Object.assign({}, data, editorValues);
      post({ data });
    };
    return emitter;
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
            <StaticIOShell ref={this.refIOEditor} onNeedEmitter={this.handleEmitMessage} />
          </div>
        </main>
      </div>
    )
  }
}
