/**
 * E2E テスト用 Go launcher プロセス管理。
 * beforeAll / afterAll で使用する。
 */
import { ChildProcess, spawn, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { LauncherGrpcClient } from '../../../../app/launcher/launcher-grpc-client';

/** ソケット出現待ちの最大時間（ミリ秒） */
const STARTUP_TIMEOUT_MS = 10000;
/** ソケットファイルの存在チェック間隔（ミリ秒） */
const POLL_INTERVAL_MS = 50;
/** stop 時 SIGTERM 後のプロセス終了待ち最大時間（ミリ秒） */
const STOP_TIMEOUT_MS = 3000;

const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');
const LAUNCHER_BINARY = path.resolve(
  PROJECT_ROOT,
  'deps/applauncher-go/build/launcher'
);

/** Go launcher バイナリが存在するか */
export function hasLauncherBinary(): boolean {
  return fs.existsSync(LAUNCHER_BINARY);
}

/** コマンドが利用可能かチェック（シェルを経由しない安全な実装） */
export function hasCommand(cmd: string): boolean {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export class GoLauncherFixture {
  private process: ChildProcess | null = null;
  private _socketPath: string;
  private workdir: string;
  private baseDir: string;
  private client: LauncherGrpcClient | null = null;
  private stderrChunks: Buffer[] = [];

  constructor(opts?: { workdir?: string }) {
    // socket パス長を短くするため id を 4 バイト(8文字) に抑える
    const id = crypto.randomBytes(4).toString('hex');
    this.baseDir = path.resolve(PROJECT_ROOT, `tmp/e2e-${id}`);
    this.workdir = opts?.workdir ?? path.join(this.baseDir, 'workdir');
    this._socketPath = path.join(this.baseDir, 'launcher.sock');
  }

  /** 子プロセスを起動しクライアントを返す */
  async start(): Promise<LauncherGrpcClient> {
    fs.mkdirSync(this.workdir, { recursive: true });

    this.process = spawn(
      LAUNCHER_BINARY,
      ['--listen', `unix:${this._socketPath}`, '--workdir', this.workdir],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    // stderr を蓄積（テスト失敗時の診断用、バックプレッシャー防止）
    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.stderrChunks.push(chunk);
    });

    this.process.on('error', (err) => {
      console.error('[GoLauncherFixture] process error:', err.message);
    });

    await this.waitForSocket();

    this.client = new LauncherGrpcClient(this._socketPath);
    return this.client;
  }

  /** 子プロセスを停止しリソースを解放 */
  async stop(): Promise<void> {
    this.client?.close();
    this.client = null;

    if (this.process && !this.process.killed) {
      const proc = this.process;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve();
        }, STOP_TIMEOUT_MS);

        proc.on('close', () => {
          clearTimeout(timer);
          resolve();
        });

        proc.kill('SIGTERM');
      });
    }
    this.process = null;

    // 一時ディレクトリを削除
    try {
      fs.rmSync(this.baseDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[GoLauncherFixture] cleanup failed:', e);
    }
  }

  /** テスト用に直接 socket パスを取得 */
  get socket(): string {
    return this._socketPath;
  }

  /**
   * プロセスのみ停止し再起動する（クライアントや一時ディレクトリはそのまま維持）。
   * 再接続テスト用: 同じ socket パスで新しいプロセスを起動し、
   * gRPC channel の自動再接続を検証する。
   */
  async restartProcess(): Promise<void> {
    // 既存プロセスを停止（ソケットファイルは削除されるがディレクトリは維持）
    if (this.process && !this.process.killed) {
      const proc = this.process;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve();
        }, STOP_TIMEOUT_MS);

        proc.on('close', () => {
          clearTimeout(timer);
          resolve();
        });

        proc.kill('SIGTERM');
      });
    }
    this.process = null;
    this.stderrChunks = [];

    // ソケットファイルが残っている場合は削除（新プロセスが再作成するため）
    try {
      fs.unlinkSync(this._socketPath);
    } catch {
      // 既に削除済み
    }

    // 同じパスで新しいプロセスを起動
    this.process = spawn(
      LAUNCHER_BINARY,
      ['--listen', `unix:${this._socketPath}`, '--workdir', this.workdir],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.stderrChunks.push(chunk);
    });

    this.process.on('error', (err) => {
      console.error('[GoLauncherFixture] process error:', err.message);
    });

    await this.waitForSocket();
  }

  /** テスト失敗時の診断用: Go launcher の stderr 出力を取得 */
  get stderr(): string {
    return Buffer.concat(this.stderrChunks).toString('utf-8');
  }

  private waitForSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let processExited = false;
      let exitCode: number | null = null;

      // プロセス即時終了を検知して早期 reject
      const exitHandler = (code: number | null) => {
        processExited = true;
        exitCode = code;
      };
      this.process?.on('exit', exitHandler);

      const check = () => {
        if (processExited) {
          const stderrOutput = Buffer.concat(this.stderrChunks).toString(
            'utf-8'
          );
          reject(
            new Error(
              `Go launcher exited with code ${exitCode} before socket was created.\nstderr: ${stderrOutput}`
            )
          );
          return;
        }
        if (fs.existsSync(this._socketPath)) {
          this.process?.removeListener('exit', exitHandler);
          resolve();
          return;
        }
        if (Date.now() - startTime > STARTUP_TIMEOUT_MS) {
          this.process?.removeListener('exit', exitHandler);
          reject(
            new Error(
              `Go launcher did not create socket at ${this._socketPath} within ${STARTUP_TIMEOUT_MS}ms`
            )
          );
          return;
        }
        setTimeout(check, POLL_INTERVAL_MS);
      };
      check();
    });
  }
}
