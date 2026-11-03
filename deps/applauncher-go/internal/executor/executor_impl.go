package executor

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"
)

// ErrTaskLimitReached は同時実行タスク数が上限に達した場合に返されるエラー。
var ErrTaskLimitReached = errors.New("concurrent task limit reached")

type cancelEntry struct {
	boxID  string
	cancel context.CancelFunc
}

// ExecutorImpl はExecutorインターフェースのos/execベース実装。
type ExecutorImpl struct {
	mu      sync.RWMutex
	tasks   map[string]*cancelEntry
	sem     chan struct{} // 同時実行数制限セマフォ
}

// NewExecutorImpl は新しいExecutorImplを作成する。
func NewExecutorImpl() *ExecutorImpl {
	return &ExecutorImpl{
		tasks: make(map[string]*cancelEntry),
		sem:   make(chan struct{}, DefaultMaxConcurrentTasks),
	}
}

func (e *ExecutorImpl) Exec(params ExecParams) *ExecHandle {
	taskID := generateTaskID()
	done := make(chan struct{})
	var result ExecResult

	// context生成（タイムアウトまたはキャンセル用）
	var ctx context.Context
	var cancel context.CancelFunc
	if params.TimeoutMs > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), time.Duration(params.TimeoutMs)*time.Millisecond)
	} else {
		ctx, cancel = context.WithCancel(context.Background())
	}

	// タスク登録
	e.mu.Lock()
	e.tasks[taskID] = &cancelEntry{boxID: params.BoxID, cancel: cancel}
	e.mu.Unlock()

	go func() {
		defer close(done)
		defer func() {
			e.mu.Lock()
			delete(e.tasks, taskID)
			e.mu.Unlock()
			cancel()
		}()

		// セマフォ取得（同時実行数制限）
		select {
		case e.sem <- struct{}{}:
			defer func() { <-e.sem }()
		case <-ctx.Done():
			// キャンセルされた場合はセマフォ待ちを中断
			reason := KillReasonUser
			if ctx.Err() == context.DeadlineExceeded {
				reason = KillReasonTimeout
			}
			result = ExecResult{Killed: &reason}
			return
		}

		result = e.executeCommand(ctx, params)
	}()

	return &ExecHandle{
		TaskID: taskID,
		Done:   done,
		Result: func() ExecResult { return result },
	}
}

func (e *ExecutorImpl) Kill(boxID string, taskID string) error {
	e.mu.RLock()
	entry, ok := e.tasks[taskID]
	e.mu.RUnlock()

	if !ok {
		return nil // 冪等: 存在しない場合はエラーを返さない
	}

	if entry.boxID != boxID {
		return ErrTaskNotInBox
	}

	entry.cancel()
	return nil
}

func (e *ExecutorImpl) executeCommand(ctx context.Context, params ExecParams) ExecResult {
	start := time.Now()

	cmd := exec.CommandContext(ctx, params.Cmd, params.Args...)
	cmd.Dir = params.WorkDir
	cmd.Stdin = strings.NewReader(params.Stdin)

	// プロセスグループ分離（子プロセスも含めてkill可能にする）
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// stdout/stderr のキャプチャ（上限付き）
	var stdoutBuf, stderrBuf limitedBuffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	// コマンド実行にContextベースのkillを使わず、プロセスグループkillを行う
	cmd.Cancel = func() error {
		if cmd.Process != nil {
			// プロセスグループ全体にSIGKILL
			return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		return nil
	}
	// WaitDelay: cmd.Cancel後にプロセスが応答しない場合のタイムアウト
	cmd.WaitDelay = 5 * time.Second

	err := cmd.Run()
	elapsed := time.Since(start)

	result := ExecResult{
		TimeMs: float64(elapsed.Microseconds()) / 1000.0,
		Stdout: stdoutBuf.String(),
		Stderr: stderrBuf.String(),
	}

	if err != nil {
		if ctx.Err() != nil {
			// context がキャンセルまたはタイムアウト
			result.Exited = true
			if ctx.Err() == context.DeadlineExceeded {
				reason := KillReasonTimeout
				result.Killed = &reason
			} else {
				reason := KillReasonUser
				result.Killed = &reason
			}
			// exit statusは取得できない場合がある
			if exitErr, ok := err.(*exec.ExitError); ok {
				result.ExitStatus = exitErr.ExitCode()
			} else {
				result.ExitStatus = -1
			}
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			result.Exited = true
			result.ExitStatus = exitErr.ExitCode()
		} else {
			// コマンド起動失敗（コマンドが見つからない等）
			result.Exited = false
			result.ExitStatus = 127
		}
	} else {
		result.Exited = true
		result.ExitStatus = 0
	}

	return result
}

// limitedBuffer は MaxOutputBytes を超えたら書き込みを打ち切るバッファ。
type limitedBuffer struct {
	buf bytes.Buffer
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	remaining := MaxOutputBytes - b.buf.Len()
	if remaining <= 0 {
		return len(p), nil // 捨てる（エラーは返さない）
	}
	if len(p) > remaining {
		p = p[:remaining]
	}
	return b.buf.Write(p)
}

func (b *limitedBuffer) String() string {
	return b.buf.String()
}

func generateTaskID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand 失敗は致命的（起こるべきでない）
		panic(fmt.Sprintf("crypto/rand.Read failed: %v", err))
	}
	return hex.EncodeToString(b)
}
