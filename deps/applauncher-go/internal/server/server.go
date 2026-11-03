// Package server はgRPCサーバの起動・終了を管理する。
package server

import (
	"fmt"
	"net"
	"os"
	"strings"

	"google.golang.org/grpc"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/handler"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// Config はサーバの設定を保持する。
type Config struct {
	// ListenAddress は "unix:///path/to/socket" または ":port" 形式。
	ListenAddress string
	// WorkDir はbox作成の親ディレクトリ。
	WorkDir string
	// Verbose はデバッグログの有効化フラグ。
	Verbose bool
}

// Server はgRPCサーバの管理構造体。
type Server struct {
	grpcServer *grpc.Server
	listener   net.Listener
}

// New は新しいServerを構成して返す。Serve() でリスン開始する。
func New(cfg Config) (*Server, error) {
	// ネットワーク・アドレスの解決
	network, address, err := parseListenAddress(cfg.ListenAddress)
	if err != nil {
		return nil, fmt.Errorf("invalid listen address: %w", err)
	}

	// Unix socket の場合、既存ファイルを削除
	if network == "unix" {
		os.Remove(address)
	}

	lis, err := net.Listen(network, address)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on %s://%s: %w", network, address, err)
	}

	// Unix socket のパーミッション設定
	if network == "unix" {
		os.Chmod(address, 0666)
	}

	// サンドボックスとエグゼキュータの生成
	sb, err := sandbox.NewSandboxImpl(cfg.WorkDir)
	if err != nil {
		lis.Close()
		return nil, fmt.Errorf("failed to create sandbox: %w", err)
	}
	exec := executor.NewExecutorImpl()

	grpcServer := grpc.NewServer()
	h, err := handler.NewLauncherHandler(sb, exec)
	if err != nil {
		lis.Close()
		return nil, fmt.Errorf("failed to create handler: %w", err)
	}
	h.Register(grpcServer)

	if cfg.Verbose {
		fmt.Printf("Listening on %s://%s (workdir: %s)\n", network, address, cfg.WorkDir)
	}

	return &Server{
		grpcServer: grpcServer,
		listener:   lis,
	}, nil
}

// Serve はgRPCサーバのリスンを開始する（ブロッキング）。
func (s *Server) Serve() error {
	return s.grpcServer.Serve(s.listener)
}

// GracefulStop はgraceful shutdownを行う。
func (s *Server) GracefulStop() {
	s.grpcServer.GracefulStop()
}

// Stop は即時停止する。
func (s *Server) Stop() {
	s.grpcServer.Stop()
}

// parseListenAddress はアドレス文字列をnetwork/addressに分解する。
func parseListenAddress(addr string) (network, address string, err error) {
	if strings.HasPrefix(addr, "unix://") {
		return "unix", strings.TrimPrefix(addr, "unix://"), nil
	}
	if strings.HasPrefix(addr, "unix:") {
		return "unix", strings.TrimPrefix(addr, "unix:"), nil
	}
	// TCP: ":port" または "host:port"
	if addr == "" {
		return "", "", fmt.Errorf("empty address")
	}
	return "tcp", addr, nil
}
