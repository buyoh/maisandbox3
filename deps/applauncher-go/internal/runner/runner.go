// Package runner は言語固有の実行パイプラインを定義する。
package runner

import (
	"context"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// Runner は言語固有の実行パイプラインを定義する。
type Runner interface {
	// Run はタスクを実行し、各フェーズの結果をコールバックで通知する。
	// ctx キャンセルで中断される。
	Run(ctx context.Context, params RunParams, emit func(PhaseResult)) error
	// RunMulti はビルドフェーズを1回実行し、run フェーズを stdinList 分繰り返す。
	RunMulti(ctx context.Context, params RunMultiParams, emit func(MultiPhaseResult)) error
	// PrepareInteractive はインタラクティブ実行の前処理（ファイル配置、コンパイル等）を実行する。
	PrepareInteractive(ctx context.Context, params InteractivePrepareParams) (*InteractivePrepareResult, error)
}

// RunParams はランナーの実行パラメータ。
type RunParams struct {
	// BoxID はbox の識別子。sandbox メソッドに渡す。
	BoxID string
	// BoxDir はbox のディレクトリパス。executor の WorkDir に使用。
	BoxDir string
	// Files はbox に格納するファイル。
	Files []sandbox.FileEntry
	// PhaseTimeoutMs は各フェーズ（build/run 等）の個別タイムアウト（ミリ秒）。0は無制限。
	PhaseTimeoutMs uint32
	// Options はユーザが指定したビルドオプション（例: {"std": "c++17"}）。
	// 未指定のオプションは設定ファイルの default 値が使用される。
	Options map[string]string
}

// PhaseResult はフェーズの実行結果。
type PhaseResult struct {
	Phase        string
	ExitStatus   int
	TimeMs       float64
	Stdout       string
	Stderr       string
	HasNextPhase bool
}

// RunMultiParams は multi-stdio の実行パラメータ。
type RunMultiParams struct {
	BoxID          string
	BoxDir         string
	Files          []sandbox.FileEntry
	PhaseTimeoutMs uint32
	Options        map[string]string
	// StdinList は各 run フェーズに渡す標準入力のリスト。
	StdinList []StdinEntry
}

// StdinEntry は個別の標準入力。
type StdinEntry struct {
	Index uint32
	Data  string
}

// MultiPhaseResultType は multi-stdio 結果のカテゴリ。
type MultiPhaseResultType int

const (
	MultiPhaseResultTypeBuild MultiPhaseResultType = iota
	MultiPhaseResultTypeRun
)

// MultiPhaseResult は multi-stdio のフェーズ結果。
type MultiPhaseResult struct {
	Type        MultiPhaseResultType
	BuildResult *PhaseResult
	RunResult   *MultiRunResult
}

// MultiRunResult は個別 run の結果。
type MultiRunResult struct {
	StdinIndex uint32
	ExitStatus int
	TimeMs     float64
	Stdout     string
	Stderr     string
	HasNextRun bool
}
