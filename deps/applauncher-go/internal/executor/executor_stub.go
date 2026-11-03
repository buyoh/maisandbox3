package executor

import (
	"context"
	"fmt"
	"io"
	"sync"
)

// ExecStubEntry はテスト用のexec結果を定義する。
type ExecStubEntry struct {
	Result ExecResult
}

// ExecutorStub はテスト用のExecutor実装。
// 事前に設定した結果を返し、実際にプロセスは起動しない。
type ExecutorStub struct {
	mu          sync.Mutex
	taskCounter int
	// NextResults は次のExecで返す結果のキュー。空の場合はデフォルト結果を返す。
	NextResults []ExecStubEntry
	// ExecCalls は呼び出し履歴。
	ExecCalls []ExecParams
	// ActiveTasks は現在実行中のタスク（Kill検証用）。
	ActiveTasks map[string]string // taskID -> boxID
	// KillCalls はKill呼び出し履歴。
	KillCalls []struct{ BoxID, TaskID string }
}

// NewExecutorStub は新しいExecutorStubを作成する。
func NewExecutorStub() *ExecutorStub {
	return &ExecutorStub{
		ActiveTasks: make(map[string]string),
	}
}

func (e *ExecutorStub) Exec(params ExecParams) *ExecHandle {
	e.mu.Lock()
	e.taskCounter++
	taskID := fmt.Sprintf("stub-task-%d", e.taskCounter)
	e.ExecCalls = append(e.ExecCalls, params)
	e.ActiveTasks[taskID] = params.BoxID

	var result ExecResult
	if len(e.NextResults) > 0 {
		result = e.NextResults[0].Result
		e.NextResults = e.NextResults[1:]
	}
	e.mu.Unlock()

	done := make(chan struct{})
	close(done) // 即完了

	return &ExecHandle{
		TaskID: taskID,
		Done:   done,
		Result: func() ExecResult { return result },
	}
}

func (e *ExecutorStub) Kill(boxID string, taskID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.KillCalls = append(e.KillCalls, struct{ BoxID, TaskID string }{boxID, taskID})

	registeredBox, ok := e.ActiveTasks[taskID]
	if !ok {
		return nil // 冪等
	}
	if registeredBox != boxID {
		return ErrTaskNotInBox
	}
	delete(e.ActiveTasks, taskID)
	return nil
}

// ExecInteractive はスタブ実装。即座に完了するダミーハンドルを返す。
func (e *ExecutorStub) ExecInteractive(_ context.Context, params ExecInteractiveParams) (*InteractiveHandle, error) {
	e.mu.Lock()
	e.taskCounter++
	taskID := fmt.Sprintf("stub-interactive-%d", e.taskCounter)
	e.mu.Unlock()

	outputCh := make(chan InteractiveOutput, 16)
	doneCh := make(chan InteractiveDone, 1)

	// stdin をキャプチャするパイプ
	pr, pw := io.Pipe()
	// 読み取り側は破棄（テスト用にはキャプチャも可能だが基本不要）
	go func() {
		io.Copy(io.Discard, pr)
	}()

	// 即完了
	close(outputCh)
	doneCh <- InteractiveDone{ExitStatus: 0, TimeMs: 10}
	close(doneCh)

	return &InteractiveHandle{
		TaskID:    taskID,
		StdinPipe: pw,
		Output:    outputCh,
		Done:      doneCh,
	}, nil
}
