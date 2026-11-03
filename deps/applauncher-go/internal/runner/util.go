package runner

import (
	"context"
	"fmt"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// StoreError は store フェーズの失敗を表す。
type StoreError struct {
	Cause error
}

func (e *StoreError) Error() string { return fmt.Sprintf("store failed: %v", e.Cause) }
func (e *StoreError) Unwrap() error { return e.Cause }

// ExecFailedError はコマンド起動自体が失敗した場合のエラー。
type ExecFailedError struct {
	Phase string
}

func (e *ExecFailedError) Error() string {
	return fmt.Sprintf("exec failed in phase %q: command could not be started", e.Phase)
}

// PhaseTimeoutError はフェーズのタイムアウトを表す。
type PhaseTimeoutError struct {
	Phase string
}

func (e *PhaseTimeoutError) Error() string {
	return fmt.Sprintf("phase %q timed out", e.Phase)
}

// findFileData searches for a file by path in a FileEntry slice.
// Returns the file data and whether the file was found.
func findFileData(files []sandbox.FileEntry, path string) (string, bool) {
	for _, f := range files {
		if f.Path == path {
			return f.Data, true
		}
	}
	return "", false
}

// execAndWait はコマンドを実行し、完了または context キャンセルまで待機する。
// phaseName はエラーメッセージに使用されるフェーズ名（設定ファイル上の名前）。
// コマンド起動自体が失敗した場合は ExecFailedError を返す。
// フェーズタイムアウト（executor 側の TimeoutMs）で kill された場合は PhaseTimeoutError を返す。
func execAndWait(ctx context.Context, exec executor.Executor, params executor.ExecParams, phaseName string) (executor.ExecResult, error) {
	handle := exec.Exec(params)

	select {
	case <-handle.Done:
	case <-ctx.Done():
		exec.Kill(params.BoxID, handle.TaskID)
		<-handle.Done
		return executor.ExecResult{}, ctx.Err()
	}

	result := handle.Result()

	// Use phaseName for error messages; fall back to cmd
	phase := phaseName
	if phase == "" {
		phase = params.Cmd
	}

	if !result.Exited {
		return result, &ExecFailedError{Phase: phase}
	}
	if result.Killed != nil && *result.Killed == executor.KillReasonTimeout {
		return result, &PhaseTimeoutError{Phase: phase}
	}
	return result, nil
}
