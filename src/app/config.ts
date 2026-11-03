// for Server Configurations only

import path from 'path';

// 項目を修正したら example.env を必ず修正すること

const production = process.env.NODE_ENV === 'production';
const develop = !production;

const httpPort = parseInt(process.env.PORT || '11460');

// __dirname は ESM のビルド成果物で利用できず、ビルド階層にも依存するため cwd を使う。
const appRootDirectory = path.resolve(process.cwd());

// gRPC ベースの Launcher 通信モード
// LAUNCHER_MODE=grpc で外部サーバに接続。デフォルトは grpc-child（子プロセスとして起動）。
const launcherMode: 'grpc' | 'grpc-child' =
  process.env.LAUNCHER_MODE === 'grpc' ? 'grpc' : 'grpc-child';
const launcherGrpcAddress =
  process.env.LAUNCHER_GRPC_ADDRESS || 'localhost:50051';

// grpc-child モード時に go run で直接実行するか（開発用）
const launcherGrpcGorun = process.env.LAUNCHER_GRPC_GORUN === 'true';

// Launcher の Go ソースディレクトリ（go run / デフォルトバイナリ探索に使用）
const launcherGrpcDir = process.env.LAUNCHER_GRPC_DIR || 'deps/applauncher-go';

// grpc-child モード時に使用する Launcher バイナリパス
const launcherGrpcBinary = process.env.LAUNCHER_GRPC_BINARY || null;

// ssl対応にするかどうか
const sslConfigPath = (() => {
  const s = process.env.SSL_CONFIG_PATH;
  return s ? `${s}` : null;
})();

const frontend: 'vite' | 'static' =
  process.env.FRONTEND == 'static' ? 'static' : 'vite';

export default {
  production,
  develop,
  httpPort,
  appRootDirectory,
  launcherMode,
  launcherGrpcAddress,
  launcherGrpcGorun,
  launcherGrpcDir,
  launcherGrpcBinary,
  sslConfigPath,
  frontend,
};
