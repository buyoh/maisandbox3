import React from 'react';

import SocketIOClient from 'socket.io-client';

import Meta from '../components/style/meta';
import Header from '../components/Header';

import CodeEditorShell from '../components/CodeEditorShell';
import StaticIOShell from '../components/StaticIOShell';
import { ClientSocket } from '../components/lib/ClientSocket';
import { pullFromLocalStorage, pushToLocalStorage } from '../components/lib/LocalStorage';
import { Annotation } from '../lib/type';

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
  return pullFromLocalStorage('backup');
}

function pushBackupData(data: any): void {
  pushToLocalStorage('backup', data);
}

export default class extends React.Component<{}, IndexState> {

  private socket: ClientSocket | null;
  private refIOEditor: React.RefObject<StaticIOShell>;
  private refCodeEditor: React.RefObject<CodeEditorShell>;
  private backupIntervalTimerId: number | null;
  // private backupHandler: BackupHandler;

  constructor(props: {}) {
    super(props);
    this.state = {
    };
    this.socket = null;
    this.refIOEditor = React.createRef();
    this.refCodeEditor = React.createRef();
    this.backupIntervalTimerId = null;
    // this.backupHandler = new BackupHandler();

    this.handleEmitMessage = this.handleEmitMessage.bind(this);
    this.handleLoad = this.handleLoad.bind(this);
    this.handleUnload = this.handleUnload.bind(this);
    this.handleIntervalBackup = this.handleIntervalBackup.bind(this);
    this.pullBackup = this.pullBackup.bind(this);
    this.pushBackup = this.pushBackup.bind(this);
    this.setAnnotations = this.setAnnotations.bind(this);
  }

  componentDidMount(): void {
    window.addEventListener('beforeunload', this.handleUnload);
    this.handleLoad();
    this.backupIntervalTimerId = window.setInterval(this.handleIntervalBackup, 60 * 1000);
  }

  componentWillUnmount(): void {
    window.removeEventListener('beforeunload', this.handleUnload);
    if (this.backupIntervalTimerId !== null)
      window.clearInterval(this.backupIntervalTimerId);
    this.backupIntervalTimerId = null;
  }

  private handleLoad(): void {
    this.socket = new ClientSocket(SocketIOClient());
    this.pullBackup();
  }

  private handleUnload(): void {
    this.pushBackup();
  }

  private handleIntervalBackup(): void {
    this.pushBackup();
  }

  private pullBackup() {
    let data = pullBackupData();
    if (!data) data = {};
    if (data['codeEditorShell'])
      this.refCodeEditor.current?.deserialize(data['codeEditorShell']);

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
      const d = this.refCodeEditor.current?.serialize();
      if (d === undefined)
        delete data['codeEditorShell'];
      else
        data['codeEditorShell'] = d;
    }
    pushBackupData(data);
  }

  // wrapper of generateForPostExec
  private handleEmitMessage(callback: (data: any) => void): (data: any) => void {
    const editorValues = this.refCodeEditor.current?.getAllValue();  // TODO: refactor this
    const post = this.socket?.generateForPostExec(callback);
    if (editorValues === undefined || post === undefined) {
      console.warn('handleEmitMessage failed: something is not initialized');
      return () => { return; };
    }
    const emitter = (data: any) => {
      data = Object.assign({}, data, editorValues);
      post({ data });
    };
    return emitter;
  }

  private setAnnotations(annotatios: Annotation[]): void {
    // TODO: refactor this as Accessor
    this.refCodeEditor.current?.setAnnotations(annotatios);
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
            <StaticIOShell ref={this.refIOEditor} onNeedEmitter={this.handleEmitMessage} annotationSetter={this.setAnnotations} />
          </div>
        </main>
      </div>
    );
  }
}
