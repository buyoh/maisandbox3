import React, { useEffect, ReactEventHandler } from "react";
import { CSSProperties } from 'react';

import SocketIOClient from 'socket.io-client';

import Meta from './component/style/meta';
import Header from './component/Header';

import CodeEditor from './component/CodeEditor';
import StaticIOEditor from './component/StaticIOEditor';

// const RowFlexStyle: CSSProperties = {
//   display: 'flex',
//   flexDirection: 'row'
// };

// const RowFlexElemStyle: CSSProperties = {
//   flex: '1'
// }

type IndexState = {
  stdin: string,
  stdout: string,
  editingCode: string,
}

export default class extends React.Component<{}, IndexState> {

  socket: SocketIOClient.Socket;
  refIOEditor: React.RefObject<StaticIOEditor>;

  constructor(props) {
    super(props);
    this.state = {
      editingCode: '',
      stdin: '',
      stdout: ''
    };
    this.socket = null;
    this.refIOEditor = React.createRef();

    this.handleUpdateCode = this.handleUpdateCode.bind(this);
    this.handleClick = this.handleClick.bind(this);
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
      console.log('resultexec', data.data);
      this.refIOEditor.current.setStdout(data.data.result.out);
    });
  }

  handleClick(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    // this.socket.emit('myping', { data: 'hello2' });
    const code = this.state.editingCode;
    const stdin = this.refIOEditor.current.getStdin();
    this.socket.emit('c2e_Exec', { data: { code, stdin } });
    console.log(stdin);
  }

  handleUpdateCode(v: string) {
    this.setState(Object.assign({}, this.state, { editingCode: v }));
  }

  render() {
    return (
      <div>
        <Meta />
        <Header />
        <main>
          <div className="flex_row">
            <div className="border flex_elem">
              <CodeEditor ref="codeEditor" lang="ruby" value={this.state.editingCode} onChange={this.handleUpdateCode} />
            </div>
          </div>

          <div>
            <button onClick={this.handleClick}>run</button>
          </div>
          <div>
            <StaticIOEditor ref={this.refIOEditor} />
          </div>
        </main>
      </div>
    )
  }
}
