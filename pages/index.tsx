import React from "react";

import SocketIOClient from 'socket.io-client';

import Meta from '../components/style/meta';
import Header from '../components/Header';

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


function pullBackupData(): any {
  const s = localStorage.getItem('msb3_backup');
  try {
    return JSON.parse(s);
  }
  catch (e) {
    return null;
  }
}

function pushBackupData(data: any): any {
  const j = JSON.stringify(data);
  localStorage.setItem('msb3_backup', j);
}

export default class extends React.Component<{}, IndexState> {

  private socket: ClientSocket;
  private refIOEditor: React.RefObject<StaticIOShell>;
  private refCodeEditor: React.RefObject<CodeEditorShell>;
  private backupIntervalTimerId: number;
  // private backupHandler: BackupHandler;

  constructor(props) {
    super(props);
    this.state = {
    };
    this.socket = null;
    this.refIOEditor = React.createRef();
    this.refCodeEditor = React.createRef();
    // this.backupHandler = new BackupHandler();

    this.handleEmitMessage = this.handleEmitMessage.bind(this);
    this.handleLoad = this.handleLoad.bind(this);
    this.handleUnload = this.handleUnload.bind(this);
    this.handleIntervalBackup = this.handleIntervalBackup.bind(this);
    this.pullBackup = this.pullBackup.bind(this);
    this.pushBackup = this.pushBackup.bind(this);
  }

  componentDidMount() {
    window.addEventListener("beforeunload", this.handleUnload);
    this.handleLoad();
    this.backupIntervalTimerId = window.setInterval(this.handleIntervalBackup, 60 * 1000);
  }

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.handleUnload);
    window.clearInterval(this.backupIntervalTimerId);
  }

  private handleLoad() {
    this.socket = new ClientSocket(SocketIOClient());
    this.pullBackup();
  }

  private handleUnload() {
    this.pushBackup();
  }

  private handleIntervalBackup() {
    this.pushBackup();
  }

  private pullBackup() {
    let data = pullBackupData();
    if (!data) data = {};
    if (data['codeEditorShell'])
      this.refCodeEditor.current.deserialize(data['codeEditorShell']);

  }

  private pushBackup() {
    let data = pullBackupData();
    if (!data) data = {};
    {
      // note: BackupHandlerを作って使おうとして辞めた理由
      // this.refCodeEditor.currentがタイミングによって別のオブジェクトに置き換わる
      // 可能性がある（よく調べてはないので、無いかもしれない）。
      // なので、関数型を渡すだけはNGで、正しく実装するならば、
      // 「現在のserialize関数を取得する関数」を渡す必要がある。
      // BackupHandlerをそう書き直しても良いけど…
      const d = this.refCodeEditor.current.serialize();
      if (d === undefined)
        delete data['codeEditorShell'];
      else
        data['codeEditorShell'] = d;
    }
    pushBackupData(data);
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
