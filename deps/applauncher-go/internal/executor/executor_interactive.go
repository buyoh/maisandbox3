package executor

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// StreamType はstdout/stderrの区別。
type StreamType int

const (
	StreamStdout StreamType = iota
	StreamStderr
)

// ExecInteractiveParams はインタラクティブ実行のパラメータ。
type ExecInteractiveParams struct {
	Cmd       string
	Args      []string
	Dir       string
	BoxID     string
	TimeoutMs uint32
}

// InteractiveOutput はstdout/stderrのチャンク。
type InteractiveOutput struct {
	Stream StreamType
	Data   string
}

// InteractiveDone は実行完了またはkill通知。
type InteractiveDone struct {
	ExitStatus int
	TimeMs     float64
	Killed     bool
	KillReason string
}

// InteractiveHandle はインタラクティブ実行のハンドル。
type InteractiveHandle struct {
	TaskID    string
	StdinPipe io.WriteCloser
	Output    <-chan InteractiveOutput
	Done      <-chan InteractiveDone
}

const (
	interactiveOutputBufSize = 256
	interactiveMaxLineBytes  = 64 * 1024
	// MaxInteractiveTimeoutMs はインタラクティブ実行の最大タイムアウト（ミリ秒）。
	MaxInteractiveTimeoutMs = 300000
)

// ExecInteractive はプロセスをインタラクティブモードで起動する。
// stdin パイプと stdout/stderr チャンクストリームを返す。
// ctx がキャンセルされるとプロセスは SIGKILL される。
func (e *ExecutorImpl) ExecInteractive(ctx context.Context, params ExecInteractiveParams) (*InteractiveHandle, error) {
	// タイムアウト制御
	timeoutMs := params.TimeoutMs
	if timeoutMs == 0 || timeoutMs > MaxInteractiveTimeoutMs {
		timeoutMs = MaxInteractiveTimeoutMs
	}
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)

	cmd := exec.CommandContext(ctx, params.Cmd, params.Args...)
	cmd.Dir = params.Dir
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stdin pipe: %w", err)
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	startTime := time.Now()

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start: %w", err)
	}

	// タスク ID を登録（Kill 用）
	taskID := fmt.Sprintf("interactive-%d-%d", cmd.Process.Pid, time.Now().UnixNano())
	e.mu.Lock()
	e.tasks[taskID] = &cancelEntry{boxID: params.BoxID, cancel: cancel}
	e.mu.Unlock()

	outputCh := make(chan InteractiveOutput, interactiveOutputBufSize)
	doneCh := make(chan InteractiveDone, 1)

	// stdout/stderr を読み取る goroutine
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		scanPipe(stdoutPipe, StreamStdout, outputCh)
	}()
	go func() {
		defer wg.Done()
		scanPipe(stderrPipe, StreamStderr, outputCh)
	}()

	// プロセス完了待機の goroutine
	go func() {
		// stdout/stderr の goroutine 完了を待つ
		wg.Wait()
		close(outputCh)

		// プロセス終了を待機
		err := cmd.Wait()

		elapsed := time.Since(startTime).Seconds() * 1000

		// タスク登録を解除
		e.mu.Lock()
		delete(e.tasks, taskID)
		e.mu.Unlock()

		done := InteractiveDone{
			TimeMs: elapsed,
		}

		if ctx.Err() != nil {
			done.Killed = true
			done.KillReason = "TIMEOUT"
		} else if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				done.ExitStatus = exitErr.ExitCode()
			} else {
				done.ExitStatus = -1
			}
		}
		// exit_status 0 の場合はデフォルト値（0）のまま

		doneCh <- done
		close(doneCh)
	}()

	return &InteractiveHandle{
		TaskID:    taskID,
		StdinPipe: stdinPipe,
		Output:    outputCh,
		Done:      doneCh,
	}, nil
}

// scanPipe はパイプから行単位（または最大バイト数）で読み取り、チャンネルに送信する。
func scanPipe(pipe io.ReadCloser, stream StreamType, ch chan<- InteractiveOutput) {
	scanner := bufio.NewScanner(pipe)
	scanner.Buffer(make([]byte, interactiveMaxLineBytes), interactiveMaxLineBytes)
	for scanner.Scan() {
		text := scanner.Text() + "\n"
		ch <- InteractiveOutput{Stream: stream, Data: text}
	}
	// パイプ完了（プロセス終了 or パイプ閉鎖）
}
