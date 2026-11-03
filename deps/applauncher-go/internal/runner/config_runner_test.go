package runner

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// rubyLikeConfig returns a 1-phase config similar to Ruby.
func rubyLikeConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "Ruby"},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "run", Cmd: "ruby", Args: []string{"./code.rb"}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

// cppLikeConfig returns a 2-phase config similar to C++.
func cppLikeConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "C++"},
		Options: map[string]OptionDef{
			"std": {Type: "enum", Values: []string{"c++14", "c++17", "c++2a"}, Default: "c++2a"},
		},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "build", Cmd: "g++", Args: []string{"-std={{std}}", "-o", "prog", "./code.cpp"}},
				{Name: "run", Cmd: "./prog", Args: []string{}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

// clayLikeConfig returns a 3-phase config similar to CLay.
func clayLikeConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "CLay"},
		Options: map[string]OptionDef{
			"std": {Type: "enum", Values: []string{"c++14", "c++17"}, Default: "c++14"},
		},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "transpile", Cmd: "clay", Args: []string{}, StdinFromInput: "code.cpp", StdoutToFile: "out.cpp"},
				{Name: "build", Cmd: "g++", Args: []string{"-std={{std}}", "-o", "prog", "./out.cpp"}},
				{Name: "run", Cmd: "./prog", Args: []string{}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

func TestConfigRunner_OnePhase_Success(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 15.2, Stdout: "hello\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "puts 'hello'"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Phase != "run" {
		t.Errorf("phase: got %q, want %q", results[0].Phase, "run")
	}
	if results[0].ExitStatus != 0 {
		t.Errorf("exit status: got %d, want 0", results[0].ExitStatus)
	}
	if results[0].Stdout != "hello\n" {
		t.Errorf("stdout: got %q, want %q", results[0].Stdout, "hello\n")
	}
	if results[0].HasNextPhase {
		t.Error("expected HasNextPhase false")
	}
}

func TestConfigRunner_OnePhase_StdinFromInput(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "got it\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "puts gets"}, {Path: "stdin.txt", Data: "input data"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exec.ExecCalls[0].Stdin != "input data" {
		t.Errorf("stdin: got %q, want %q", exec.ExecCalls[0].Stdin, "input data")
	}
}

func TestConfigRunner_OnePhase_NonZeroExit(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 1, TimeMs: 5, Stdout: "", Stderr: "error\n"}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results[0].ExitStatus != 1 {
		t.Errorf("exit status: got %d, want 1", results[0].ExitStatus)
	}
	if results[0].Stderr != "error\n" {
		t.Errorf("stderr: got %q, want %q", results[0].Stderr, "error\n")
	}
	if results[0].HasNextPhase {
		t.Error("expected HasNextPhase false")
	}
}

func TestConfigRunner_TwoPhase_Success(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 100, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 20, Stdout: "42\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "int main(){}"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].Phase != "build" || !results[0].HasNextPhase {
		t.Errorf("build phase: phase=%q, hasNext=%v", results[0].Phase, results[0].HasNextPhase)
	}
	if results[1].Phase != "run" || results[1].HasNextPhase {
		t.Errorf("run phase: phase=%q, hasNext=%v", results[1].Phase, results[1].HasNextPhase)
	}
	if results[1].Stdout != "42\n" {
		t.Errorf("run stdout: got %q, want %q", results[1].Stdout, "42\n")
	}
	// Verify default option was applied
	if exec.ExecCalls[0].Args[0] != "-std=c++2a" {
		t.Errorf("build args[0]: got %q, want %q", exec.ExecCalls[0].Args[0], "-std=c++2a")
	}
}

func TestConfigRunner_TwoPhase_BuildFail(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 1, TimeMs: 50, Stdout: "", Stderr: "error\n"}},
	}

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "bad"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result (build only), got %d", len(results))
	}
	if results[0].HasNextPhase {
		t.Error("expected HasNextPhase false when build fails")
	}
	// Should not have executed run phase
	if len(exec.ExecCalls) != 1 {
		t.Errorf("expected 1 exec call, got %d", len(exec.ExecCalls))
	}
}

func TestConfigRunner_ThreePhase_Success(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 30, Stdout: "transpiled code", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 80, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "result\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "clay src"}, {Path: "stdin.txt", Data: "input"}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	if results[0].Phase != "transpile" || !results[0].HasNextPhase {
		t.Errorf("transpile: phase=%q, hasNext=%v", results[0].Phase, results[0].HasNextPhase)
	}
	if results[1].Phase != "build" || !results[1].HasNextPhase {
		t.Errorf("build: phase=%q, hasNext=%v", results[1].Phase, results[1].HasNextPhase)
	}
	if results[2].Phase != "run" || results[2].HasNextPhase {
		t.Errorf("run: phase=%q, hasNext=%v", results[2].Phase, results[2].HasNextPhase)
	}
	// Verify transpile used code.cpp as stdin
	if exec.ExecCalls[0].Stdin != "clay src" {
		t.Errorf("transpile stdin: got %q, want %q", exec.ExecCalls[0].Stdin, "clay src")
	}
}

func TestConfigRunner_ThreePhase_TranspileFail(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 1, TimeMs: 5, Stdout: "", Stderr: "parse error\n"}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "bad"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Phase != "transpile" {
		t.Errorf("phase: got %q, want %q", results[0].Phase, "transpile")
	}
	if results[0].HasNextPhase {
		t.Error("expected HasNextPhase false when transpile fails")
	}
}

func TestConfigRunner_StdoutToFile_Success(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "transpiled output", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "done\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "src"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify StoreFiles was called with out.cpp
	// First call is initial store, second is stdout_to_file
	if len(sb.StoreCalls) < 2 {
		t.Fatalf("expected at least 2 store calls, got %d", len(sb.StoreCalls))
	}
	secondStore := sb.StoreCalls[1]
	if len(secondStore.Files) != 1 || secondStore.Files[0].Path != "out.cpp" {
		t.Errorf("expected store of out.cpp, got %v", secondStore.Files)
	}
	if secondStore.Files[0].Data != "transpiled output" {
		t.Errorf("stored data: got %q, want %q", secondStore.Files[0].Data, "transpiled output")
	}
}

func TestConfigRunner_StdoutToFile_StoreError(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	sb.StoreError = errors.New("disk full") // Will fail on second StoreFiles call
	sb.StoreErrorAfterN = 1                 // Fail on 2nd call

	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "output", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "src"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected StoreError")
	}
	var storeErr *StoreError
	if !errors.As(err, &storeErr) {
		t.Errorf("expected StoreError, got %T: %v", err, err)
	}
}

func TestConfigRunner_StdoutToFile_NotStoredOnFailure(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		// Transpile fails (exit 1) → stdout should NOT be stored
		{Result: executor.ExecResult{Exited: true, ExitStatus: 1, TimeMs: 5, Stdout: "partial output", Stderr: "err"}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "src"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Only 1 store call (initial files), no stdout_to_file
	if len(sb.StoreCalls) != 1 {
		t.Errorf("expected 1 store call, got %d", len(sb.StoreCalls))
	}
}

func TestConfigRunner_StdoutToFile_EmptyStdoutOnSuccess(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		// Exit 0 but stdout is empty
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 5, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 5, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 5, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, clayLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "src"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Empty stdout should still be stored as file
	if len(sb.StoreCalls) < 2 {
		t.Fatalf("expected at least 2 store calls, got %d", len(sb.StoreCalls))
	}
	if sb.StoreCalls[1].Files[0].Data != "" {
		t.Errorf("expected empty file data, got %q", sb.StoreCalls[1].Files[0].Data)
	}
}

func TestConfigRunner_StdinFromInput_FileNotFound(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 5, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// Only code.rb provided, no stdin.txt
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "puts 'hi'"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should have used empty stdin
	if exec.ExecCalls[0].Stdin != "" {
		t.Errorf("stdin should be empty when file not found, got %q", exec.ExecCalls[0].Stdin)
	}
}

func TestConfigRunner_OptionsDefault(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// No options specified → default "c++2a" should be used
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exec.ExecCalls[0].Args[0] != "-std=c++2a" {
		t.Errorf("expected default -std=c++2a, got %q", exec.ExecCalls[0].Args[0])
	}
}

func TestConfigRunner_OptionsExplicit(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
		Options:        map[string]string{"std": "c++17"},
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exec.ExecCalls[0].Args[0] != "-std=c++17" {
		t.Errorf("expected -std=c++17, got %q", exec.ExecCalls[0].Args[0])
	}
}

func TestConfigRunner_OptionsInvalid(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
		Options:        map[string]string{"std": "c++99"},
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected InvalidOptionError")
	}
	var optErr *InvalidOptionError
	if !errors.As(err, &optErr) {
		t.Errorf("expected *InvalidOptionError, got %T: %v", err, err)
	}
	if optErr.Key != "std" || optErr.Value != "c++99" {
		t.Errorf("error details: key=%q value=%q", optErr.Key, optErr.Value)
	}
}

func TestConfigRunner_OptionsNilMap(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, cppLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// Options is nil → should not panic, defaults applied
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.cpp", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 10000,
		Options:        nil,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exec.ExecCalls[0].Args[0] != "-std=c++2a" {
		t.Errorf("expected default -std=c++2a with nil options, got %q", exec.ExecCalls[0].Args[0])
	}
}

func TestConfigRunner_ContextCancel(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 0, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := r.Run(ctx, RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "x"}, {Path: "stdin.txt", Data: ""}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}

func TestConfigRunner_ExecFailed(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	// Exited: false → ExecFailedError
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: false}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "x"}, {Path: "stdin.txt", Data: "in"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected ExecFailedError")
	}
	var execErr *ExecFailedError
	if !errors.As(err, &execErr) {
		t.Fatalf("expected ExecFailedError, got: %T", err)
	}
	if execErr.Phase != "run" {
		t.Errorf("phase = %q, want %q", execErr.Phase, "run")
	}
}

func TestConfigRunner_PhaseTimeout(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	killed := executor.KillReasonTimeout
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: -1, Killed: &killed}},
	}

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "x"}, {Path: "stdin.txt", Data: "in"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected PhaseTimeoutError")
	}
	var timeoutErr *PhaseTimeoutError
	if !errors.As(err, &timeoutErr) {
		t.Fatalf("expected PhaseTimeoutError, got: %T", err)
	}
	if timeoutErr.Phase != "run" {
		t.Errorf("phase = %q, want %q", timeoutErr.Phase, "run")
	}
}

func TestConfigRunner_StoreFilesFailed(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	sb.StoreErrorAfterN = 0 // Fail on first StoreFiles call
	sb.StoreError = fmt.Errorf("disk full")
	exec := executor.NewExecutorStub()

	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "x"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err == nil {
		t.Fatal("expected StoreError")
	}
	var storeErr *StoreError
	if !errors.As(err, &storeErr) {
		t.Fatalf("expected StoreError, got: %T", err)
	}
}

// --- Tests for inputs mapping ---

// rubyWithInputsConfig returns a ruby-like config with inputs mapping.
func rubyWithInputsConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "Ruby"},
		Inputs: map[string]string{
			"code":  "code.rb",
			"stdin": "stdin.txt",
		},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "run", Cmd: "ruby", Args: []string{"./code.rb"}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

// cppWithInputsConfig returns a cpp-like config with inputs mapping.
func cppWithInputsConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "C++"},
		Inputs: map[string]string{
			"code":  "code.cpp",
			"stdin": "stdin.txt",
		},
		Options: map[string]OptionDef{
			"std": {Type: "enum", Values: []string{"c++14", "c++17", "c++2a"}, Default: "c++2a"},
		},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "build", Cmd: "g++", Args: []string{"-std={{std}}", "-o", "prog", "./code.cpp"}},
				{Name: "run", Cmd: "./prog", Args: []string{}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

// clayWithInputsConfig returns a clay-like config with inputs mapping.
func clayWithInputsConfig() LangConfig {
	return LangConfig{
		Meta: MetaConfig{DisplayName: "CLay"},
		Inputs: map[string]string{
			"code":  "code.cpp",
			"stdin": "stdin.txt",
		},
		Options: map[string]OptionDef{
			"std": {Type: "enum", Values: []string{"c++14", "c++17"}, Default: "c++14"},
		},
		Actions: map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: []PhaseConfig{
				{Name: "transpile", Cmd: "clay", Args: []string{}, StdinFromInput: "code.cpp", StdoutToFile: "out.cpp"},
				{Name: "build", Cmd: "g++", Args: []string{"-std={{std}}", "-o", "prog", "./out.cpp"}},
				{Name: "run", Cmd: "./prog", Args: []string{}, StdinFromInput: "stdin.txt"},
			}},
		},
	}
}

func TestConfigRunner_MapInputFiles_Basic(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "hello\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyWithInputsConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// Send logical names (as Node.js would send them)
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code", Data: "puts 'hello'"}, {Path: "stdin", Data: "input data"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify files were stored with mapped names
	if len(sb.StoreCalls) < 1 {
		t.Fatal("expected at least 1 store call")
	}
	storedFiles := sb.StoreCalls[0].Files
	if len(storedFiles) != 2 {
		t.Fatalf("expected 2 stored files, got %d", len(storedFiles))
	}
	// Check that logical names were mapped to physical names
	foundCode := false
	foundStdin := false
	for _, f := range storedFiles {
		if f.Path == "code.rb" && f.Data == "puts 'hello'" {
			foundCode = true
		}
		if f.Path == "stdin.txt" && f.Data == "input data" {
			foundStdin = true
		}
	}
	if !foundCode {
		t.Errorf("expected code.rb in stored files, got %v", storedFiles)
	}
	if !foundStdin {
		t.Errorf("expected stdin.txt in stored files, got %v", storedFiles)
	}

	// Verify stdin was resolved using mapped name
	if exec.ExecCalls[0].Stdin != "input data" {
		t.Errorf("stdin: got %q, want %q", exec.ExecCalls[0].Stdin, "input data")
	}
}

func TestConfigRunner_MapInputFiles_EmptyInputs(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "hello\n", Stderr: ""}},
	}

	// Config without inputs — files pass through unchanged
	r := NewConfigRunner(sb, exec, rubyLikeConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code.rb", Data: "puts 'hi'"}, {Path: "stdin.txt", Data: "in"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	storedFiles := sb.StoreCalls[0].Files
	if storedFiles[0].Path != "code.rb" || storedFiles[1].Path != "stdin.txt" {
		t.Errorf("expected unchanged file paths, got %v", storedFiles)
	}
}

func TestConfigRunner_MapInputFiles_UnmappedFilesPassThrough(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyWithInputsConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// "extra" is not in inputs mapping, should pass through
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code", Data: "x"}, {Path: "stdin", Data: ""}, {Path: "extra", Data: "data"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	storedFiles := sb.StoreCalls[0].Files
	if len(storedFiles) != 3 {
		t.Fatalf("expected 3 stored files, got %d", len(storedFiles))
	}
	// extra should remain unchanged
	found := false
	for _, f := range storedFiles {
		if f.Path == "extra" && f.Data == "data" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected unmapped file 'extra' to pass through, got %v", storedFiles)
	}
}

func TestConfigRunner_MapInputFiles_CppWithInputs(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 100, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 20, Stdout: "42\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, cppWithInputsConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	var results []PhaseResult
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code", Data: "int main(){}"}, {Path: "stdin", Data: "test input"}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {
		results = append(results, pr)
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Verify files stored with physical names
	storedFiles := sb.StoreCalls[0].Files
	foundCpp := false
	foundStdin := false
	for _, f := range storedFiles {
		if f.Path == "code.cpp" {
			foundCpp = true
		}
		if f.Path == "stdin.txt" {
			foundStdin = true
		}
	}
	if !foundCpp {
		t.Errorf("expected code.cpp in stored files, got %v", storedFiles)
	}
	if !foundStdin {
		t.Errorf("expected stdin.txt in stored files, got %v", storedFiles)
	}

	// Verify stdin was found with mapped name
	if exec.ExecCalls[1].Stdin != "test input" {
		t.Errorf("run stdin: got %q, want %q", exec.ExecCalls[1].Stdin, "test input")
	}
}

func TestConfigRunner_MapInputFiles_ClayStdinFromInput(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 30, Stdout: "transpiled code", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 80, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "result\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, clayWithInputsConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// Send logical names: "code" should be mapped to "code.cpp"
	// stdin_from_input: "code.cpp" should find the mapped file
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code", Data: "clay source"}, {Path: "stdin", Data: "run input"}},
		PhaseTimeoutMs: 10000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify transpile phase got code.cpp content as stdin
	if exec.ExecCalls[0].Stdin != "clay source" {
		t.Errorf("transpile stdin: got %q, want %q", exec.ExecCalls[0].Stdin, "clay source")
	}
	// Verify run phase got stdin.txt content
	if exec.ExecCalls[2].Stdin != "run input" {
		t.Errorf("run stdin: got %q, want %q", exec.ExecCalls[2].Stdin, "run input")
	}
}

// TestConfigRunner_MapInputFiles_MissingStdinFilled は、クライアントが stdin を
// 送信しなかった場合でも空ファイルとして補完され、warning が出ないことを検証する。
func TestConfigRunner_MapInputFiles_MissingStdinFilled(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "hello\n", Stderr: ""}},
	}

	r := NewConfigRunner(sb, exec, rubyWithInputsConfig())
	boxID, _ := sb.NewBox()
	boxDir, _ := sb.BoxDir(boxID)

	// stdin を送信しない（code のみ）
	err := r.Run(context.Background(), RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          []sandbox.FileEntry{{Path: "code", Data: "puts 'hi'"}},
		PhaseTimeoutMs: 5000,
	}, func(pr PhaseResult) {})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 空の stdin.txt が補完されて StoreFiles に含まれること
	storedFiles := sb.StoreCalls[0].Files
	foundStdin := false
	for _, f := range storedFiles {
		if f.Path == "stdin.txt" {
			foundStdin = true
			if f.Data != "" {
				t.Errorf("expected empty data for stdin.txt, got %q", f.Data)
			}
		}
	}
	if !foundStdin {
		t.Errorf("expected stdin.txt in stored files (filled as empty), got %v", storedFiles)
	}

	// run フェーズの stdin が空文字列であること
	if exec.ExecCalls[0].Stdin != "" {
		t.Errorf("run stdin: got %q, want empty", exec.ExecCalls[0].Stdin)
	}
}
