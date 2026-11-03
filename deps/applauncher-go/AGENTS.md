# deps/applauncher-go

## 概要

Go 製の Launcher（コード実行サンドボックス）。gRPC サーバとして動作し、Web サーバからのリクエストに応じてコードの保存・実行・結果取得を行う。

現行の Ruby 製 Launcher (`deps/applauncher`) の後継実装。

## ディレクトリ構成

```
deps/applauncher-go/
├── cmd/launcher/       # エントリポイント（main.go）
├── internal/
│   ├── server/         # gRPC サーバ起動・接続管理
│   ├── handler/        # gRPC サービスハンドラ
│   ├── sandbox/        # Box（実行環境）管理: ファイル保存・取得・パス検証
│   └── executor/       # プロセス実行: タイムアウト・kill・出力キャプチャ
├── proto/launcher/     # protoc 生成コード
├── go.mod
└── Makefile
```

## ビルド

```bash
make build          # ./build/launcher にバイナリを生成
```

## テスト

```bash
make test           # 全パッケージのテスト実行
make test-verbose   # 詳細出力
make lint           # go vet による静的解析
```

## Proto コード生成

`src/proto/launcher.proto` から Go コードを生成する（`protoc` + `protoc-gen-go` + `protoc-gen-go-grpc` が必要）:

```bash
make proto
```

## 設計方針

- **インターフェース分離**: `Sandbox` と `Executor` を独立インターフェースとして定義し、テスト用スタブで差し替え可能
- **セキュリティ**: パス検証（絶対パス/`..`/null byte/symlink の EvalSymlinks 検証）、サイズ制限、Box 数・同時タスク数の上限
- **プロセス管理**: `Setpgid` によるプロセスグループ分離、SIGKILL によるグループ全体 kill、`WaitDelay` による goroutine リーク防止
- **エラーハンドリング**: ドメインエラーは sentinel error（`ErrBoxNotFound` 等）で返却。gRPC ステータスコードへのマッピングは handler 層で実施
