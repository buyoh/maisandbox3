package runner

import (
	"context"
	"fmt"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// InteractivePrepareParams はインタラクティブ実行前処理のパラメータ。
type InteractivePrepareParams struct {
	BoxID   string
	BoxDir  string
	Files   []sandbox.FileEntry
	Options map[string]string
}

// InteractivePrepareResult はインタラクティブ実行前処理の結果。
type InteractivePrepareResult struct {
	// CompileResult はコンパイルフェーズの結果。nil ならコンパイル不要。
	CompileResult *InteractiveCompileResult
	// ExecParams はインタラクティブ実行のパラメータ。
	ExecParams executor.ExecInteractiveParams
}

// InteractiveCompileResult はコンパイルフェーズの結果。
type InteractiveCompileResult struct {
	ExitStatus int
	TimeMs     float64
	Stdout     string
	Stderr     string
}

// PrepareInteractive はインタラクティブ実行の前処理を行う。
// YAML 設定の interactive アクションに基づき、コンパイル→実行コマンド決定を行う。
func (r *ConfigRunner) PrepareInteractive(ctx context.Context, params InteractivePrepareParams) (*InteractivePrepareResult, error) {
	interactiveAction, ok := r.config.Actions[ActionInteractive]
	if !ok {
		return nil, fmt.Errorf("lang does not support interactive mode (no '%s' action)", ActionInteractive)
	}
	if len(interactiveAction.Phases) == 0 {
		return nil, fmt.Errorf("interactive action has no phases")
	}

	// オプション解決
	resolvedOpts, err := r.resolveOptions(params.Options)
	if err != nil {
		return nil, err
	}

	// ファイル配置（inputs マッピング適用）
	mappedFiles := r.mapInputFiles(params.Files)
	if err := r.sandbox.StoreFiles(params.BoxID, mappedFiles); err != nil {
		return nil, &StoreError{Cause: err}
	}

	phases := interactiveAction.Phases

	// 最後のフェーズが実行フェーズ（それ以外はコンパイルフェーズ）
	runPhase := phases[len(phases)-1]
	buildPhases := phases[:len(phases)-1]

	var compileResult *InteractiveCompileResult

	// コンパイルフェーズを実行
	for _, phase := range buildPhases {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		args := resolveArgs(phase.Args, resolvedOpts)

		result, err := execAndWait(ctx, r.executor, executor.ExecParams{
			Cmd:       phase.Cmd,
			Args:      args,
			WorkDir:   params.BoxDir,
			BoxID:     params.BoxID,
			Stdin:     "",
			TimeoutMs: 30000, // コンパイル 30秒タイムアウト
		}, phase.Name)
		if err != nil {
			return nil, err
		}

		compileResult = &InteractiveCompileResult{
			ExitStatus: result.ExitStatus,
			TimeMs:     result.TimeMs,
			Stdout:     result.Stdout,
			Stderr:     result.Stderr,
		}

		if result.ExitStatus != 0 {
			// コンパイル失敗
			return &InteractivePrepareResult{
				CompileResult: compileResult,
			}, nil
		}
	}

	// 実行コマンド決定
	args := resolveArgs(runPhase.Args, resolvedOpts)

	return &InteractivePrepareResult{
		CompileResult: compileResult,
		ExecParams: executor.ExecInteractiveParams{
			Cmd:   runPhase.Cmd,
			Args:  args,
			Dir:   params.BoxDir,
			BoxID: params.BoxID,
		},
	}, nil
}
