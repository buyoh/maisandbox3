/**
 * 子プロセスとして gRPC Launcher を起動し、一時 Unix socket で接続する。
 * applauncher-go が gRPC サーバとして動作するようになった際に使用。
 */
import ChildProcess from 'child_process';
import path from 'path';
import fs from 'fs';
import { LauncherGrpcClient } from './launcher-grpc-client';
import Config from '../config';

/** 子プロセスが起動しソケットが利用可能になるまで待機する最大時間（ミリ秒） */
const STARTUP_TIMEOUT_MS = 10000;
/** ソケットファイルの存在をチェックする間隔（ミリ秒） */
const POLL_INTERVAL_MS = 50;

/** spawn に渡すコマンド情報 */
export interface LauncherCommand {
  command: string;
  args: string[];
  /** spawn に渡す cwd。未指定時はデフォルト */
  cwd?: string;
}

/** Launcher バイナリのパスを解決 */
export function resolveLauncherBinary(): string {
  const envBinary = Config.launcherGrpcBinary;
  if (envBinary) {
    if (!fs.existsSync(envBinary)) {
      throw new Error(
        `Configured gRPC launcher binary not found: ${envBinary}`
      );
    }
    return envBinary;
  }

  // フォールバック: deps/applauncher-go/build/launcher を使用
  const goBinary = path.resolve(
    Config.appRootDirectory,
    Config.launcherGrpcDir,
    'build',
    'launcher'
  );
  if (fs.existsSync(goBinary)) {
    return goBinary;
  }

  throw new Error(
    'gRPC launcher binary not found. Build deps/applauncher-go or set LAUNCHER_GRPC_BINARY env.'
  );
}

/**
 * Launcher の起動コマンドを解決する。
 * LAUNCHER_GRPC_GORUN=true の場合は go run、それ以外はバイナリを使用。
 */
export function resolveLauncherCommand(): LauncherCommand {
  if (Config.launcherGrpcGorun) {
    const goDir = path.resolve(Config.appRootDirectory, Config.launcherGrpcDir);
    if (!fs.existsSync(goDir)) {
      throw new Error(
        `go run mode requires launcher directory, but not found at: ${goDir}`
      );
    }
    if (Config.production) {
      console.warn(
        'WARNING: LAUNCHER_GRPC_GORUN=true in production environment'
      );
    }
    return { command: 'go', args: ['run', './cmd/launcher'], cwd: goDir };
  }
  return { command: resolveLauncherBinary(), args: [] };
}

/**
 * gRPC 子プロセスモードの Launcher 管理。
 * 子プロセスを起動し、ソケットが利用可能になったら LauncherGrpcClient を返す。
 */
export class ChildProcessGrpcLauncher {
  private process: ChildProcess.ChildProcess | null = null;
  private socketPath: string;
  private client: LauncherGrpcClient | null = null;

  constructor() {
    // 一時 Unix socket パスを生成（./tmp/ 配下）
    const tmpDir = path.resolve(Config.appRootDirectory, 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    this.socketPath = path.join(tmpDir, `launcher-grpc-${process.pid}.sock`);
  }

  /**
   * 子プロセスを起動し、gRPC クライアントを返す。
   * ソケットファイルが作成されるまで待機する。
   */
  async start(): Promise<LauncherGrpcClient> {
    // 古いソケットファイルが残っていれば削除
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    const { command, args: baseArgs, cwd } = resolveLauncherCommand();
    const args = [
      ...baseArgs,
      '--listen',
      `unix:${this.socketPath}`,
      '--workdir',
      path.resolve(Config.appRootDirectory, 'tmp/omochi'),
    ];

    this.process = ChildProcess.spawn(command, args, {
      stdio: ['ignore', 'pipe', 'inherit'],
      cwd,
    });

    // stdout をドレインしてバッファ満杯による子プロセスブロックを防止
    this.process.stdout?.resume();

    this.process.on('error', (err) => {
      console.error('gRPC launcher process error:', err.message);
    });

    this.process.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`gRPC launcher exited with code ${code}`);
      }
    });

    // ソケットファイルが作成されるまで待機
    await this.waitForSocket();

    this.client = new LauncherGrpcClient(this.socketPath);
    return this.client;
  }

  /** 子プロセスとクライアントを停止 */
  stop(): void {
    this.client?.close();
    this.client = null;
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
    }
    this.process = null;
    // ソケットファイルをクリーンアップ
    try {
      if (fs.existsSync(this.socketPath)) {
        fs.unlinkSync(this.socketPath);
      }
    } catch {
      // 無視
    }
  }

  /** gRPC サーバのアドレス（Unix socket パス）を返す */
  getAddress(): string {
    return this.socketPath;
  }

  /** ソケットファイルが作成されるまでポーリングで待機 */
  private waitForSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (fs.existsSync(this.socketPath)) {
          resolve();
          return;
        }
        if (Date.now() - startTime > STARTUP_TIMEOUT_MS) {
          reject(
            new Error(
              `gRPC launcher did not create socket at ${this.socketPath} within ${STARTUP_TIMEOUT_MS}ms`
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
