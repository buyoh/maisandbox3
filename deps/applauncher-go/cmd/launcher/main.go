// Launcher gRPC サーバのエントリポイント。
package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/server"
)

var version = "dev"

func main() {
	listen := flag.String("listen", "", "Listen address (e.g. unix:///var/launcher.sock or :50051)")
	workdir := flag.String("workdir", ".", "Working directory for box creation")
	verbose := flag.Bool("verbose", false, "Enable verbose logging")
	showVersion := flag.Bool("version", false, "Show version")
	flag.Parse()

	if *showVersion {
		fmt.Printf("applauncher-go %s\n", version)
		os.Exit(0)
	}

	// リスンアドレスの決定
	addr := *listen
	if addr == "" {
		fmt.Fprintln(os.Stderr, "Error: --listen or --grpc-socket is required")
		flag.Usage()
		os.Exit(1)
	}

	// workdir ディレクトリ作成
	if err := os.MkdirAll(*workdir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to create workdir %s: %v\n", *workdir, err)
		os.Exit(1)
	}

	cfg := server.Config{
		ListenAddress: addr,
		WorkDir:       *workdir,
		Verbose:       *verbose,
	}

	srv, err := server.New(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// シグナルハンドリング
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		if *verbose {
			fmt.Printf("Received signal %v, shutting down...\n", sig)
		}
		srv.GracefulStop()
	}()

	if *verbose {
		fmt.Printf("applauncher-go %s starting\n", version)
	}

	if err := srv.Serve(); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
