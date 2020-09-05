import StaticIOShell from '../components/StaticIOShell';
import CodeEditorShell from '../components/CodeEditorShell';
import { Annotation, SubResultExec, Result } from '../lib/type';

type Runnable = (data: any) => void;
type EmitterMaker = (callback: Runnable) => Runnable;

function determineResultColor(data: Result): string {
  let summaryColor = 'gray';

  if (data.result) {
    const resultAsExec = data.result as SubResultExec;
    if (resultAsExec.exited) {
      if (resultAsExec.exitstatus !== 0) {
        summaryColor = 'warning';
      } else {
        summaryColor = 'success';
      }
    }
  }
  return summaryColor;
}

export class StaticIOShellBehavior {

  private refStaticIO: React.RefObject<StaticIOShell>;
  private refCodeEditor: React.RefObject<CodeEditorShell>;
  private emitterMaker: EmitterMaker;

  private currentEmitter: Runnable | null;
  private annotations: Annotation[];

  constructor(emitterMaker: EmitterMaker, refStaticIO: React.RefObject<StaticIOShell>, refCodeEditor: React.RefObject<CodeEditorShell>) {
    this.emitterMaker = emitterMaker;
    this.currentEmitter = null;
    this.refStaticIO = refStaticIO;
    this.refCodeEditor = refCodeEditor;
    this.annotations = [];

    this.processResult = this.processResult.bind(this);
    this.handlePostRun = this.handlePostRun.bind(this);
    this.handlePostKill = this.handlePostKill.bind(this);
  }

  private processResult(data: Result): void {
    let errLog = '';

    if (data.continue === false) {
      this.currentEmitter = null;
    }
    if (data.result) {
      const resultAsExec = data.result as SubResultExec;
      if (resultAsExec.exited) {
        if (resultAsExec.annotations) {
          this.annotations = this.annotations.concat(resultAsExec.annotations);
          this.refCodeEditor.current?.setAnnotations(this.annotations);
        }
        this.refStaticIO.current?.setStdout(resultAsExec.out || '');
        this.refStaticIO.current?.setErrlog(resultAsExec.err || '');
        errLog = resultAsExec.err || '';
      }
    }
    else {
      // e.g. kill callback
    }
    if (data.summary) {
      this.refStaticIO.current?.addStatus(
        data.summary, determineResultColor(data),
        errLog === '' ? undefined : errLog, true);
    }
  }

  handlePostRun(): void {
    const staticIO = this.refStaticIO.current;
    const codeEditor = this.refCodeEditor.current;
    if (!staticIO || !codeEditor) return;

    const stdin = staticIO.getStdin();
    const { code, lang } = codeEditor.getAllValue();
    const emitter = this.emitterMaker(this.processResult);
    this.currentEmitter = emitter;
    emitter({ action: 'run', stdin, code, lang });
  }

  handlePostKill(): void {
    if (!this.currentEmitter) return;
    this.currentEmitter({ action: 'kill' });
  }
}