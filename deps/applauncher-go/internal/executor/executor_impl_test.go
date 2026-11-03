package executor

import (
	"strings"
	"testing"
	"time"
)

func TestExecutorImpl_ExecSuccess(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "echo",
		Args:    []string{"hello"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	<-handle.Done
	result := handle.Result()

	if !result.Exited {
		t.Error("Exited = false, want true")
	}
	if result.ExitStatus != 0 {
		t.Errorf("ExitStatus = %d, want 0", result.ExitStatus)
	}
	if result.Killed != nil {
		t.Errorf("Killed = %v, want nil", result.Killed)
	}
	if strings.TrimSpace(result.Stdout) != "hello" {
		t.Errorf("Stdout = %q, want %q", result.Stdout, "hello\n")
	}
	if result.TimeMs <= 0 {
		t.Errorf("TimeMs = %f, want > 0", result.TimeMs)
	}
}

func TestExecutorImpl_ExecStdin(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "cat",
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
		Stdin:   "input data",
	})

	<-handle.Done
	result := handle.Result()

	if result.ExitStatus != 0 {
		t.Errorf("ExitStatus = %d, want 0", result.ExitStatus)
	}
	if result.Stdout != "input data" {
		t.Errorf("Stdout = %q, want %q", result.Stdout, "input data")
	}
}

func TestExecutorImpl_ExecNonZeroExit(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "sh",
		Args:    []string{"-c", "exit 42"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	<-handle.Done
	result := handle.Result()

	if result.ExitStatus != 42 {
		t.Errorf("ExitStatus = %d, want 42", result.ExitStatus)
	}
	if result.Killed != nil {
		t.Errorf("Killed = %v, want nil", result.Killed)
	}
}

func TestExecutorImpl_ExecCommandNotFound(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "nonexistent_command_xyz",
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	<-handle.Done
	result := handle.Result()

	if result.Exited {
		t.Error("Exited = true for nonexistent command, want false")
	}
	if result.ExitStatus == 0 {
		t.Error("ExitStatus = 0 for nonexistent command, want non-zero")
	}
}

func TestExecutorImpl_ExecStderr(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "sh",
		Args:    []string{"-c", "echo error >&2"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	<-handle.Done
	result := handle.Result()

	if strings.TrimSpace(result.Stderr) != "error" {
		t.Errorf("Stderr = %q, want %q", result.Stderr, "error\n")
	}
}

func TestExecutorImpl_ExecTimeout(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:       "sleep",
		Args:      []string{"10"},
		WorkDir:   t.TempDir(),
		BoxID:     "box-1",
		TimeoutMs: 100,
	})

	select {
	case <-handle.Done:
	case <-time.After(5 * time.Second):
		t.Fatal("exec did not complete within 5s (timeout should be 100ms)")
	}

	result := handle.Result()
	if result.Killed == nil {
		t.Fatal("Killed = nil, want KillReasonTimeout")
	}
	if *result.Killed != KillReasonTimeout {
		t.Errorf("Killed = %v, want KillReasonTimeout", *result.Killed)
	}
}

func TestExecutorImpl_Kill(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "sleep",
		Args:    []string{"10"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	// タスクが開始されるのを少し待つ
	time.Sleep(50 * time.Millisecond)

	err := e.Kill("box-1", handle.TaskID)
	if err != nil {
		t.Fatalf("Kill: %v", err)
	}

	select {
	case <-handle.Done:
	case <-time.After(5 * time.Second):
		t.Fatal("exec did not complete after kill within 5s")
	}

	result := handle.Result()
	if result.Killed == nil {
		t.Fatal("Killed = nil after kill, want KillReasonUser")
	}
	if *result.Killed != KillReasonUser {
		t.Errorf("Killed = %v, want KillReasonUser", *result.Killed)
	}
}

func TestExecutorImpl_Kill_WrongBox(t *testing.T) {
	e := NewExecutorImpl()
	handle := e.Exec(ExecParams{
		Cmd:     "sleep",
		Args:    []string{"10"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	time.Sleep(50 * time.Millisecond)

	err := e.Kill("box-2", handle.TaskID)
	if err != ErrTaskNotInBox {
		t.Fatalf("Kill(wrong box) = %v, want ErrTaskNotInBox", err)
	}

	// クリーンアップ: 正しいboxでkill
	e.Kill("box-1", handle.TaskID)
	<-handle.Done
}

func TestExecutorImpl_Kill_Idempotent(t *testing.T) {
	e := NewExecutorImpl()

	// 存在しないタスクをkillしてもエラーにならない
	err := e.Kill("box-1", "nonexistent-task")
	if err != nil {
		t.Fatalf("Kill(nonexistent) = %v, want nil", err)
	}
}

func TestExecutorImpl_OutputLimit(t *testing.T) {
	e := NewExecutorImpl()
	// MaxOutputBytes を超える出力を生成
	handle := e.Exec(ExecParams{
		Cmd:     "sh",
		Args:    []string{"-c", "dd if=/dev/zero bs=1024 count=200 2>/dev/null | tr '\\0' 'x'"},
		WorkDir: t.TempDir(),
		BoxID:   "box-1",
	})

	<-handle.Done
	result := handle.Result()

	if len(result.Stdout) > MaxOutputBytes {
		t.Errorf("Stdout length = %d, want <= %d", len(result.Stdout), MaxOutputBytes)
	}
	if len(result.Stdout) < MaxOutputBytes-1024 {
		t.Errorf("Stdout length = %d, want close to %d", len(result.Stdout), MaxOutputBytes)
	}
}

func TestExecutorImpl_UniqueTaskID(t *testing.T) {
	e := NewExecutorImpl()
	dir := t.TempDir()

	h1 := e.Exec(ExecParams{Cmd: "true", WorkDir: dir, BoxID: "box-1"})
	h2 := e.Exec(ExecParams{Cmd: "true", WorkDir: dir, BoxID: "box-1"})

	<-h1.Done
	<-h2.Done

	if h1.TaskID == h2.TaskID {
		t.Fatalf("duplicate task IDs: %s", h1.TaskID)
	}
}
