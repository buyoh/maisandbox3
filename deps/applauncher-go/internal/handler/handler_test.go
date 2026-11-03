package handler

import (
	"context"
	"net"
	"testing"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	pb "github.com/buyoh/maisandbox3/deps/applauncher-go/proto/launcher"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

const bufSize = 1024 * 1024

func setupTestServer(t *testing.T, sb sandbox.Sandbox, exec executor.Executor) pb.LauncherClient {
	t.Helper()
	lis := bufconn.Listen(bufSize)
	s := grpc.NewServer()
	handler, err := NewLauncherHandler(sb, exec)
	if err != nil {
		t.Fatalf("NewLauncherHandler failed: %v", err)
	}
	handler.Register(s)

	go func() {
		if err := s.Serve(lis); err != nil {
			t.Logf("server exited: %v", err)
		}
	}()
	t.Cleanup(func() { s.Stop() })

	conn, err := grpc.NewClient("passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, s string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("failed to dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	return pb.NewLauncherClient(conn)
}

func TestKill(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	// Kill a non-existent task (should succeed, idempotent)
	_, err := client.Kill(context.Background(), &pb.KillRequest{
		Box:    "",
		TaskId: "nonexistent-task",
	})
	if err != nil {
		t.Fatalf("Kill failed: %v", err)
	}
}

func TestKillInvalidArgument(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	// task_id is required
	_, err := client.Kill(context.Background(), &pb.KillRequest{
		Box:    "",
		TaskId: "",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestRunTask_Ruby(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 15, Stdout: "hello\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTask(context.Background(), &pb.RunTaskRequest{
		Lang: "ruby",
		Files: []*pb.FileEntry{
			{Path: "code.rb", Data: "puts 'hello'"},
			{Path: "stdin.txt", Data: ""},
		},
		PhaseTimeoutMs: 5000,
	})
	if err != nil {
		t.Fatalf("RunTask RPC failed: %v", err)
	}

	// Started
	msg, err := stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	started := msg.GetStarted()
	if started == nil {
		t.Fatal("expected Started event")
	}
	if started.TaskId == "" {
		t.Fatal("expected non-empty task_id")
	}

	// PhaseResult (run)
	msg, err = stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	phase := msg.GetPhaseResult()
	if phase == nil {
		t.Fatal("expected PhaseResult event")
	}
	if phase.Phase != "run" {
		t.Fatalf("expected phase 'run', got %q", phase.Phase)
	}
	if phase.Stdout != "hello\n" {
		t.Fatalf("expected stdout 'hello\\n', got %q", phase.Stdout)
	}
	if phase.HasNextPhase {
		t.Fatal("expected HasNextPhase false")
	}

	// Completed
	msg, err = stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	completed := msg.GetCompleted()
	if completed == nil {
		t.Fatal("expected Completed event")
	}
	if completed.TotalTimeMs != 15 {
		t.Fatalf("expected total_time_ms 15, got %v", completed.TotalTimeMs)
	}
}

func TestRunTask_InvalidLang(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTask(context.Background(), &pb.RunTaskRequest{
		Lang: "python",
		Files: []*pb.FileEntry{
			{Path: "code.py", Data: "print('hello')"},
		},
	})
	if err != nil {
		t.Fatalf("RunTask RPC failed: %v", err)
	}

	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestRunTask_EmptyFiles(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTask(context.Background(), &pb.RunTaskRequest{
		Lang:  "ruby",
		Files: []*pb.FileEntry{},
	})
	if err != nil {
		t.Fatalf("RunTask RPC failed: %v", err)
	}

	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestRunTask_CppBuildAndRun(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 100, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 20, Stdout: "42\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTask(context.Background(), &pb.RunTaskRequest{
		Lang: "cpp",
		Files: []*pb.FileEntry{
			{Path: "code.cpp", Data: "int main(){}"},
			{Path: "stdin.txt", Data: ""},
		},
		PhaseTimeoutMs: 10000,
	})
	if err != nil {
		t.Fatalf("RunTask RPC failed: %v", err)
	}

	// Started
	msg, _ := stream.Recv()
	if msg.GetStarted() == nil {
		t.Fatal("expected Started event")
	}

	// Build phase
	msg, _ = stream.Recv()
	buildPhase := msg.GetPhaseResult()
	if buildPhase == nil || buildPhase.Phase != "build" {
		t.Fatal("expected build PhaseResult")
	}
	if !buildPhase.HasNextPhase {
		t.Fatal("expected HasNextPhase true for build")
	}

	// Run phase
	msg, _ = stream.Recv()
	runPhase := msg.GetPhaseResult()
	if runPhase == nil || runPhase.Phase != "run" {
		t.Fatal("expected run PhaseResult")
	}
	if runPhase.Stdout != "42\n" {
		t.Fatalf("expected stdout '42\\n', got %q", runPhase.Stdout)
	}

	// Completed
	msg, _ = stream.Recv()
	if msg.GetCompleted() == nil {
		t.Fatal("expected Completed event")
	}
}

func TestRunTaskMulti_Ruby(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	// Ruby: single run phase × 2 stdin entries
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "out1\n", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 12, Stdout: "out2\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTaskMulti(context.Background(), &pb.RunTaskMultiRequest{
		Lang: "ruby",
		Files: []*pb.FileEntry{
			{Path: "code.rb", Data: "puts gets"},
			{Path: "stdin.txt", Data: ""},
		},
		PhaseTimeoutMs: 5000,
		StdinList: []*pb.StdinEntry{
			{StdinIndex: 0, Data: "hello"},
			{StdinIndex: 1, Data: "world"},
		},
	})
	if err != nil {
		t.Fatalf("RunTaskMulti RPC failed: %v", err)
	}

	// Started
	msg, err := stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	started := msg.GetStarted()
	if started == nil {
		t.Fatal("expected Started event")
	}
	if started.TaskId == "" {
		t.Fatal("expected non-empty task_id")
	}

	// RunResult 0
	msg, err = stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	rr := msg.GetRunResult()
	if rr == nil {
		t.Fatal("expected RunResult event")
	}
	if rr.StdinIndex != 0 {
		t.Fatalf("expected stdin_index 0, got %d", rr.StdinIndex)
	}
	if rr.Stdout != "out1\n" {
		t.Fatalf("expected stdout 'out1\\n', got %q", rr.Stdout)
	}
	if !rr.HasNextRun {
		t.Fatal("expected HasNextRun true")
	}

	// RunResult 1
	msg, err = stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	rr = msg.GetRunResult()
	if rr == nil {
		t.Fatal("expected RunResult event")
	}
	if rr.StdinIndex != 1 {
		t.Fatalf("expected stdin_index 1, got %d", rr.StdinIndex)
	}
	if rr.Stdout != "out2\n" {
		t.Fatalf("expected stdout 'out2\\n', got %q", rr.Stdout)
	}
	if rr.HasNextRun {
		t.Fatal("expected HasNextRun false")
	}

	// Completed
	msg, err = stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}
	completed := msg.GetCompleted()
	if completed == nil {
		t.Fatal("expected Completed event")
	}
	if completed.TotalTimeMs != 22 {
		t.Fatalf("expected total_time_ms 22, got %v", completed.TotalTimeMs)
	}
}

func TestRunTaskMulti_CppBuildAndRun(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	// C++: build phase + 2 run phases
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 100, Stdout: "", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "r1\n", Stderr: ""}},
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 15, Stdout: "r2\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTaskMulti(context.Background(), &pb.RunTaskMultiRequest{
		Lang: "cpp",
		Files: []*pb.FileEntry{
			{Path: "code.cpp", Data: "int main(){}"},
			{Path: "stdin.txt", Data: ""},
		},
		PhaseTimeoutMs: 10000,
		StdinList: []*pb.StdinEntry{
			{StdinIndex: 0, Data: "in1"},
			{StdinIndex: 1, Data: "in2"},
		},
	})
	if err != nil {
		t.Fatalf("RunTaskMulti RPC failed: %v", err)
	}

	// Started
	msg, _ := stream.Recv()
	if msg.GetStarted() == nil {
		t.Fatal("expected Started event")
	}

	// BuildResult
	msg, _ = stream.Recv()
	br := msg.GetBuildResult()
	if br == nil {
		t.Fatal("expected BuildResult event")
	}
	if br.Phase != "build" {
		t.Fatalf("expected phase 'build', got %q", br.Phase)
	}
	if br.ExitStatus != 0 {
		t.Fatalf("expected exit_status 0, got %d", br.ExitStatus)
	}

	// RunResult 0
	msg, _ = stream.Recv()
	rr := msg.GetRunResult()
	if rr == nil {
		t.Fatal("expected RunResult event")
	}
	if rr.StdinIndex != 0 || rr.Stdout != "r1\n" {
		t.Fatalf("unexpected run result 0: index=%d stdout=%q", rr.StdinIndex, rr.Stdout)
	}

	// RunResult 1
	msg, _ = stream.Recv()
	rr = msg.GetRunResult()
	if rr == nil {
		t.Fatal("expected RunResult event")
	}
	if rr.StdinIndex != 1 || rr.Stdout != "r2\n" {
		t.Fatalf("unexpected run result 1: index=%d stdout=%q", rr.StdinIndex, rr.Stdout)
	}

	// Completed
	msg, _ = stream.Recv()
	if msg.GetCompleted() == nil {
		t.Fatal("expected Completed event")
	}
}

func TestRunTaskMulti_BuildFailure(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	// Build fails, run should not execute
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 1, TimeMs: 50, Stdout: "", Stderr: "error: bad code"}},
	}
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTaskMulti(context.Background(), &pb.RunTaskMultiRequest{
		Lang: "cpp",
		Files: []*pb.FileEntry{
			{Path: "code.cpp", Data: "bad"},
			{Path: "stdin.txt", Data: ""},
		},
		PhaseTimeoutMs: 5000,
		StdinList: []*pb.StdinEntry{
			{StdinIndex: 0, Data: "in1"},
			{StdinIndex: 1, Data: "in2"},
		},
	})
	if err != nil {
		t.Fatalf("RunTaskMulti RPC failed: %v", err)
	}

	// Started
	msg, _ := stream.Recv()
	if msg.GetStarted() == nil {
		t.Fatal("expected Started event")
	}

	// BuildResult (failure)
	msg, _ = stream.Recv()
	br := msg.GetBuildResult()
	if br == nil {
		t.Fatal("expected BuildResult event")
	}
	if br.ExitStatus != 1 {
		t.Fatalf("expected exit_status 1, got %d", br.ExitStatus)
	}
	if br.Stderr != "error: bad code" {
		t.Fatalf("expected stderr, got %q", br.Stderr)
	}

	// Completed (no run results)
	msg, _ = stream.Recv()
	if msg.GetCompleted() == nil {
		t.Fatal("expected Completed event (no runs after build failure)")
	}
}

func TestRunTaskMulti_EmptyStdinList(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTaskMulti(context.Background(), &pb.RunTaskMultiRequest{
		Lang: "ruby",
		Files: []*pb.FileEntry{
			{Path: "code.rb", Data: "puts 'hi'"},
		},
		StdinList: []*pb.StdinEntry{},
	})
	if err != nil {
		t.Fatalf("RunTaskMulti RPC failed: %v", err)
	}

	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestRunTaskMulti_InvalidLang(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	stream, err := client.RunTaskMulti(context.Background(), &pb.RunTaskMultiRequest{
		Lang: "python",
		Files: []*pb.FileEntry{
			{Path: "code.py", Data: "print('hi')"},
		},
		StdinList: []*pb.StdinEntry{
			{StdinIndex: 0, Data: "in"},
		},
	})
	if err != nil {
		t.Fatalf("RunTaskMulti RPC failed: %v", err)
	}

	_, err = stream.Recv()
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestGetLangInfo(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	resp, err := client.GetLangInfo(context.Background(), &pb.GetLangInfoRequest{})
	if err != nil {
		t.Fatalf("GetLangInfo failed: %v", err)
	}

	if len(resp.Languages) == 0 {
		t.Fatal("expected at least one language")
	}

	// Check that languages have required fields
	for _, lang := range resp.Languages {
		if lang.Lang == "" {
			t.Fatal("expected non-empty lang")
		}
		if lang.DisplayName == "" {
			t.Fatalf("expected non-empty display_name for lang %q", lang.Lang)
		}
	}

	// Check that cpp is present with options
	var cppLang *pb.LangInfo
	for _, lang := range resp.Languages {
		if lang.Lang == "cpp" {
			cppLang = lang
			break
		}
	}
	if cppLang == nil {
		t.Fatal("expected cpp language in response")
	}
	if cppLang.DisplayName != "C++" {
		t.Fatalf("expected displayName 'C++', got %q", cppLang.DisplayName)
	}
	if len(cppLang.Options) == 0 {
		t.Fatal("expected cpp to have options")
	}
}

func TestGetLangVersion_Ruby(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "ruby 3.2.0\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	resp, err := client.GetLangVersion(context.Background(), &pb.GetLangVersionRequest{Lang: "ruby"})
	if err != nil {
		t.Fatalf("GetLangVersion failed: %v", err)
	}
	if resp.Error != "" {
		t.Fatalf("expected no error, got %q", resp.Error)
	}
	if resp.Version != "ruby 3.2.0" {
		t.Fatalf("expected version 'ruby 3.2.0', got %q", resp.Version)
	}
}

func TestGetLangVersion_InvalidLang(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	_, err := client.GetLangVersion(context.Background(), &pb.GetLangVersionRequest{Lang: "nonexistent"})
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestGetLangVersion_EmptyLang(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	client := setupTestServer(t, sb, exec)

	_, err := client.GetLangVersion(context.Background(), &pb.GetLangVersionRequest{Lang: ""})
	if err == nil {
		t.Fatal("expected error")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", st.Code())
	}
}

func TestGetLangVersion_Cached(t *testing.T) {
	sb := sandbox.NewSandboxStub()
	exec := executor.NewExecutorStub()
	exec.NextResults = []executor.ExecStubEntry{
		{Result: executor.ExecResult{Exited: true, ExitStatus: 0, TimeMs: 10, Stdout: "ruby 3.2.0\n", Stderr: ""}},
	}
	client := setupTestServer(t, sb, exec)

	// First call
	resp1, err := client.GetLangVersion(context.Background(), &pb.GetLangVersionRequest{Lang: "ruby"})
	if err != nil {
		t.Fatalf("GetLangVersion failed: %v", err)
	}

	// Second call should return cached result (no more exec results available)
	resp2, err := client.GetLangVersion(context.Background(), &pb.GetLangVersionRequest{Lang: "ruby"})
	if err != nil {
		t.Fatalf("GetLangVersion (cached) failed: %v", err)
	}

	if resp1.Version != resp2.Version {
		t.Fatalf("expected same version, got %q and %q", resp1.Version, resp2.Version)
	}
}
