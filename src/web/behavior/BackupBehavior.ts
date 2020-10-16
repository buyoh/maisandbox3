import CodeEditorShell from '../components/CodeEditorShell';
import { pullFromLocalStorage, pushToLocalStorage } from '../lib/LocalStorage';


function pullBackupData(): any {
  return pullFromLocalStorage('backup');
}

function pushBackupData(data: any): void {
  pushToLocalStorage('backup', data);
}


export class BackupBehavior {

  private refCodeEditor: React.RefObject<CodeEditorShell>;
  private backupIntervalTimerId: number | null;

  constructor(refCodeEditor: React.RefObject<CodeEditorShell>) {
    this.refCodeEditor = refCodeEditor;

    this.backupIntervalTimerId = null;
    this.handlePageLoad = this.handlePageLoad.bind(this);
    this.handlePageUnLoad = this.handlePageUnLoad.bind(this);
  }

  private pullBackup(): void {
    let data = pullBackupData();
    if (!data) data = {};
    if (data['codeEditorShell'])
      this.refCodeEditor.current?.deserialize(data['codeEditorShell']);
  }

  private pushBackup(): void {
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
      if (d !== undefined)
        data['codeEditorShell'] = d;
    }
    pushBackupData(data);
  }


  handlePageLoad(): void {
    this.pullBackup();
    this.backupIntervalTimerId = window.setInterval(() => { this.pushBackup(); }, 60 * 1000);
  }

  handlePageUnLoad(): void {

    if (this.backupIntervalTimerId !== null) {
      this.pushBackup();
      window.clearInterval(this.backupIntervalTimerId);
    }
    this.backupIntervalTimerId = null;
  }

}