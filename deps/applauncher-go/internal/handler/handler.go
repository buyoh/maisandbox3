// Package handler はLauncher gRPCサービスの実装を提供する。
package handler

import (
	"context"
	"errors"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/buyoh/maisandbox3/deps/applauncher-go/proto/launcher"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/runner"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// LauncherHandler はLauncher gRPCサービスの実装。
type LauncherHandler struct {
	pb.UnimplementedLauncherServer
	sandbox  sandbox.Sandbox
	executor executor.Executor
	registry *runner.Registry
}

// NewLauncherHandler は新しいLauncherHandlerを生成する。
// 設定ファイルのロードに失敗した場合はエラーを返す。
func NewLauncherHandler(sb sandbox.Sandbox, exec executor.Executor) (*LauncherHandler, error) {
	registry, err := runner.NewRegistry(sb, exec)
	if err != nil {
		return nil, err
	}
	return &LauncherHandler{
		sandbox:  sb,
		executor: exec,
		registry: registry,
	}, nil
}

// Register はgRPCサーバにこのハンドラを登録する。
func (h *LauncherHandler) Register(s *grpc.Server) {
	pb.RegisterLauncherServer(s, h)
}

func (h *LauncherHandler) Kill(_ context.Context, req *pb.KillRequest) (*pb.KillResponse, error) {
	if req.TaskId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "task_id is required")
	}
	// box is optional: if empty, kill by task_id only (pass empty string to executor)
	boxID := req.Box
	err := h.executor.Kill(boxID, req.TaskId)
	if err != nil {
		if errors.Is(err, executor.ErrTaskNotInBox) {
			return nil, status.Errorf(codes.FailedPrecondition, "task does not belong to the specified box")
		}
		return nil, status.Errorf(codes.Internal, "failed to kill: %v", err)
	}
	return &pb.KillResponse{}, nil
}

func (h *LauncherHandler) RunTask(req *pb.RunTaskRequest, stream grpc.ServerStreamingServer[pb.RunTaskResponse]) error {
	if req.Lang == "" {
		return status.Errorf(codes.InvalidArgument, "lang is required")
	}
	if len(req.Files) == 0 {
		return status.Errorf(codes.InvalidArgument, "files is required")
	}

	r := h.registry.Get(req.Lang)
	if r == nil {
		return status.Errorf(codes.InvalidArgument, "unsupported language: %s", req.Lang)
	}

	// Create box
	boxID, err := h.sandbox.NewBox()
	if err != nil {
		return stream.Send(&pb.RunTaskResponse{
			Event: &pb.RunTaskResponse_Failed{
				Failed: &pb.RunTaskFailed{
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
	}
	defer h.sandbox.DeleteBox(boxID)

	boxDir, err := h.sandbox.BoxDir(boxID)
	if err != nil {
		return stream.Send(&pb.RunTaskResponse{
			Event: &pb.RunTaskResponse_Failed{
				Failed: &pb.RunTaskFailed{
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
	}

	// Send Started event (boxID is used as task_id for Kill)
	taskID := boxID
	if err := stream.Send(&pb.RunTaskResponse{
		Event: &pb.RunTaskResponse_Started{
			Started: &pb.RunTaskStarted{TaskId: taskID},
		},
	}); err != nil {
		return err
	}

	// Convert files
	files := make([]sandbox.FileEntry, len(req.Files))
	for i, f := range req.Files {
		files[i] = sandbox.FileEntry{Path: f.Path, Data: f.Data}
	}

	// Build context with total timeout
	ctx := stream.Context()
	var runCtx context.Context
	var cancel context.CancelFunc
	if req.TotalTimeoutMs > 0 {
		runCtx, cancel = context.WithTimeout(ctx, time.Duration(req.TotalTimeoutMs)*time.Millisecond)
	} else {
		runCtx, cancel = context.WithCancel(ctx)
	}
	defer cancel()

	var totalTimeMs float64
	emitErr := error(nil)

	err = r.Run(runCtx, runner.RunParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          files,
		PhaseTimeoutMs: req.PhaseTimeoutMs,
		Options:        req.Options,
	}, func(pr runner.PhaseResult) {
		if emitErr != nil {
			return
		}
		totalTimeMs += pr.TimeMs
		emitErr = stream.Send(&pb.RunTaskResponse{
			Event: &pb.RunTaskResponse_PhaseResult{
				PhaseResult: &pb.RunTaskPhaseResult{
					Phase:        pr.Phase,
					ExitStatus:   int32(pr.ExitStatus),
					TimeMs:       pr.TimeMs,
					Stdout:       pr.Stdout,
					Stderr:       pr.Stderr,
					HasNextPhase: pr.HasNextPhase,
				},
			},
		})
		if emitErr != nil {
			cancel() // 送信失敗時は即座にランナーを停止
		}
	})

	if emitErr != nil {
		return emitErr
	}

	if err != nil {
		if ctx.Err() != nil {
			// Client disconnected
			return ctx.Err()
		}
		return stream.Send(&pb.RunTaskResponse{
			Event: &pb.RunTaskResponse_Failed{
				Failed: &pb.RunTaskFailed{
					Phase:     extractPhase(err),
					ErrorCode: mapRunnerError(err),
					Reason:    err.Error(),
				},
			},
		})
	}

	return stream.Send(&pb.RunTaskResponse{
		Event: &pb.RunTaskResponse_Completed{
			Completed: &pb.RunTaskCompleted{
				TotalTimeMs: totalTimeMs,
			},
		},
	})
}

// mapRunnerError はランナーのエラーを RunTaskErrorCode に変換する。
func mapRunnerError(err error) pb.RunTaskErrorCode {
	var storeErr *runner.StoreError
	if errors.As(err, &storeErr) {
		return pb.RunTaskErrorCode_RUN_TASK_ERROR_STORE_FAILED
	}
	var execErr *runner.ExecFailedError
	if errors.As(err, &execErr) {
		return pb.RunTaskErrorCode_RUN_TASK_ERROR_EXEC_FAILED
	}
	var phaseTimeout *runner.PhaseTimeoutError
	if errors.As(err, &phaseTimeout) {
		return pb.RunTaskErrorCode_RUN_TASK_ERROR_PHASE_TIMEOUT
	}
	var optErr *runner.InvalidOptionError
	if errors.As(err, &optErr) {
		return pb.RunTaskErrorCode_RUN_TASK_ERROR_INVALID_OPTION
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return pb.RunTaskErrorCode_RUN_TASK_ERROR_TIMEOUT
	}
	return pb.RunTaskErrorCode_RUN_TASK_ERROR_INTERNAL
}

// maxStdinCount は RunTaskMulti の stdin_list 最大件数（DoS 防止）。
const maxStdinCount = 100

func (h *LauncherHandler) RunTaskMulti(req *pb.RunTaskMultiRequest, stream grpc.ServerStreamingServer[pb.RunTaskMultiResponse]) error {
	if req.Lang == "" {
		return status.Errorf(codes.InvalidArgument, "lang is required")
	}
	if len(req.Files) == 0 {
		return status.Errorf(codes.InvalidArgument, "files is required")
	}
	if len(req.StdinList) == 0 {
		return status.Errorf(codes.InvalidArgument, "stdin_list is required")
	}
	if len(req.StdinList) > maxStdinCount {
		return status.Errorf(codes.InvalidArgument, "stdin_list exceeds maximum count %d", maxStdinCount)
	}

	r := h.registry.Get(req.Lang)
	if r == nil {
		return status.Errorf(codes.InvalidArgument, "unsupported language: %s", req.Lang)
	}

	// Create box
	boxID, err := h.sandbox.NewBox()
	if err != nil {
		return stream.Send(&pb.RunTaskMultiResponse{
			Event: &pb.RunTaskMultiResponse_Failed{
				Failed: &pb.RunTaskFailed{
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
	}
	defer h.sandbox.DeleteBox(boxID)

	boxDir, err := h.sandbox.BoxDir(boxID)
	if err != nil {
		return stream.Send(&pb.RunTaskMultiResponse{
			Event: &pb.RunTaskMultiResponse_Failed{
				Failed: &pb.RunTaskFailed{
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
	}

	// Send Started event
	taskID := boxID
	if err := stream.Send(&pb.RunTaskMultiResponse{
		Event: &pb.RunTaskMultiResponse_Started{
			Started: &pb.RunTaskMultiStarted{TaskId: taskID},
		},
	}); err != nil {
		return err
	}

	// Convert files
	files := make([]sandbox.FileEntry, len(req.Files))
	for i, f := range req.Files {
		files[i] = sandbox.FileEntry{Path: f.Path, Data: f.Data}
	}

	// Convert stdin_list
	stdinList := make([]runner.StdinEntry, len(req.StdinList))
	for i, s := range req.StdinList {
		stdinList[i] = runner.StdinEntry{Index: s.StdinIndex, Data: s.Data}
	}

	// Build context with total timeout
	ctx := stream.Context()
	var runCtx context.Context
	var cancel context.CancelFunc
	if req.TotalTimeoutMs > 0 {
		runCtx, cancel = context.WithTimeout(ctx, time.Duration(req.TotalTimeoutMs)*time.Millisecond)
	} else {
		runCtx, cancel = context.WithCancel(ctx)
	}
	defer cancel()

	var totalTimeMs float64
	emitErr := error(nil)

	// NOTE: emit callback is called sequentially by RunMulti (not concurrent).
	err = r.RunMulti(runCtx, runner.RunMultiParams{
		BoxID:          boxID,
		BoxDir:         boxDir,
		Files:          files,
		PhaseTimeoutMs: req.PhaseTimeoutMs,
		Options:        req.Options,
		StdinList:      stdinList,
	}, func(result runner.MultiPhaseResult) {
		if emitErr != nil {
			return
		}
		switch result.Type {
		case runner.MultiPhaseResultTypeBuild:
			br := result.BuildResult
			totalTimeMs += br.TimeMs
			emitErr = stream.Send(&pb.RunTaskMultiResponse{
				Event: &pb.RunTaskMultiResponse_BuildResult{
					BuildResult: &pb.RunTaskMultiBuildResult{
						Phase:             br.Phase,
						ExitStatus:        int32(br.ExitStatus),
						TimeMs:            br.TimeMs,
						Stdout:            br.Stdout,
						Stderr:            br.Stderr,
						HasNextBuildPhase: br.HasNextPhase,
					},
				},
			})
		case runner.MultiPhaseResultTypeRun:
			rr := result.RunResult
			totalTimeMs += rr.TimeMs
			emitErr = stream.Send(&pb.RunTaskMultiResponse{
				Event: &pb.RunTaskMultiResponse_RunResult{
					RunResult: &pb.RunTaskMultiRunResult{
						StdinIndex: rr.StdinIndex,
						ExitStatus: int32(rr.ExitStatus),
						TimeMs:     rr.TimeMs,
						Stdout:     rr.Stdout,
						Stderr:     rr.Stderr,
						HasNextRun: rr.HasNextRun,
					},
				},
			})
		}
		if emitErr != nil {
			cancel()
		}
	})

	if emitErr != nil {
		return emitErr
	}

	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return stream.Send(&pb.RunTaskMultiResponse{
			Event: &pb.RunTaskMultiResponse_Failed{
				Failed: &pb.RunTaskFailed{
					Phase:     extractPhase(err),
					ErrorCode: mapRunnerError(err),
					Reason:    err.Error(),
				},
			},
		})
	}

	return stream.Send(&pb.RunTaskMultiResponse{
		Event: &pb.RunTaskMultiResponse_Completed{
			Completed: &pb.RunTaskMultiCompleted{
				TotalTimeMs: totalTimeMs,
			},
		},
	})
}

// extractPhase はランナーのエラーからフェーズ名を抽出する。
func extractPhase(err error) string {
	var execErr *runner.ExecFailedError
	if errors.As(err, &execErr) {
		return execErr.Phase
	}
	var phaseTimeout *runner.PhaseTimeoutError
	if errors.As(err, &phaseTimeout) {
		return phaseTimeout.Phase
	}
	return ""
}

func (h *LauncherHandler) GetLangInfo(
	_ context.Context,
	_ *pb.GetLangInfoRequest,
) (*pb.GetLangInfoResponse, error) {
	infos := h.registry.GetAllLangInfo()
	pbLangs := make([]*pb.LangInfo, len(infos))
	for i, info := range infos {
		pbOpts := make([]*pb.LangOptionDef, len(info.Options))
		for j, opt := range info.Options {
			pbOpts[j] = &pb.LangOptionDef{
				Key:          opt.Key,
				Type:         opt.Type,
				Values:       opt.Values,
				DefaultValue: opt.DefaultValue,
				DisplayName:  opt.DisplayName,
			}
		}
		pbLangs[i] = &pb.LangInfo{
			Lang:        info.Lang,
			DisplayName: info.DisplayName,
			Options:     pbOpts,
		}
	}
	return &pb.GetLangInfoResponse{Languages: pbLangs}, nil
}

func (h *LauncherHandler) GetLangVersion(
	ctx context.Context,
	req *pb.GetLangVersionRequest,
) (*pb.GetLangVersionResponse, error) {
	if req.Lang == "" {
		return nil, status.Errorf(codes.InvalidArgument, "lang is required")
	}
	if !h.registry.HasLang(req.Lang) {
		return nil, status.Errorf(codes.InvalidArgument, "unsupported language: %s", req.Lang)
	}

	version, errStr := h.registry.GetLangVersion(ctx, req.Lang)
	return &pb.GetLangVersionResponse{
		Version: version,
		Error:   errStr,
	}, nil
}

const maxStdinChunkBytes = 64 * 1024

func (h *LauncherHandler) ExecInteractive(stream pb.Launcher_ExecInteractiveServer) error {
	// 1. 最初のメッセージ（Start）を受信
	firstMsg, err := stream.Recv()
	if err != nil {
		return err
	}
	startAction := firstMsg.GetStart()
	if startAction == nil {
		return status.Errorf(codes.InvalidArgument, "first message must be Start")
	}
	if startAction.Lang == "" {
		return status.Errorf(codes.InvalidArgument, "lang is required")
	}
	if len(startAction.Files) == 0 {
		return status.Errorf(codes.InvalidArgument, "files is required")
	}

	r := h.registry.Get(startAction.Lang)
	if r == nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_Failed{
				Failed: &pb.ExecInteractiveFailed{
					Phase:     "",
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_INVALID_LANG,
					Reason:    "unsupported language: " + startAction.Lang,
				},
			},
		})
		return nil
	}

	// 2. Box セットアップ
	boxID, err := h.sandbox.NewBox()
	if err != nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_Failed{
				Failed: &pb.ExecInteractiveFailed{
					Phase:     "setup",
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
		return nil
	}
	defer h.sandbox.DeleteBox(boxID)

	boxDir, err := h.sandbox.BoxDir(boxID)
	if err != nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_Failed{
				Failed: &pb.ExecInteractiveFailed{
					Phase:     "setup",
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_SETUP_FAILED,
					Reason:    err.Error(),
				},
			},
		})
		return nil
	}

	// ファイル配置
	files := make([]sandbox.FileEntry, len(startAction.Files))
	for i, f := range startAction.Files {
		files[i] = sandbox.FileEntry{Path: f.Path, Data: f.Data}
	}

	// Runner で前処理（inputs マッピング、ファイル保存、コンパイル）
	prepResult, err := r.PrepareInteractive(stream.Context(), runner.InteractivePrepareParams{
		BoxID:   boxID,
		BoxDir:  boxDir,
		Files:   files,
		Options: startAction.Options,
	})
	if err != nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_Failed{
				Failed: &pb.ExecInteractiveFailed{
					Phase:     "prepare",
					ErrorCode: mapRunnerError(err),
					Reason:    err.Error(),
				},
			},
		})
		return nil
	}

	// コンパイル結果を送信
	if prepResult.CompileResult != nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_CompileResult{
				CompileResult: &pb.ExecInteractiveCompileResult{
					ExitStatus: int32(prepResult.CompileResult.ExitStatus),
					TimeMs:     prepResult.CompileResult.TimeMs,
					Stdout:     prepResult.CompileResult.Stdout,
					Stderr:     prepResult.CompileResult.Stderr,
				},
			},
		})
		if prepResult.CompileResult.ExitStatus != 0 {
			_ = stream.Send(&pb.ExecInteractiveResponse{
				Event: &pb.ExecInteractiveResponse_Failed{
					Failed: &pb.ExecInteractiveFailed{
						Phase:     "compile",
						ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_EXEC_FAILED,
						Reason:    "compilation failed",
					},
				},
			})
			return nil
		}
	}

	// 3. インタラクティブ実行開始
	handle, err := h.executor.ExecInteractive(stream.Context(), prepResult.ExecParams)
	if err != nil {
		_ = stream.Send(&pb.ExecInteractiveResponse{
			Event: &pb.ExecInteractiveResponse_Failed{
				Failed: &pb.ExecInteractiveFailed{
					Phase:     "exec",
					ErrorCode: pb.RunTaskErrorCode_RUN_TASK_ERROR_EXEC_FAILED,
					Reason:    err.Error(),
				},
			},
		})
		return nil
	}

	// Started イベント送信
	if err := stream.Send(&pb.ExecInteractiveResponse{
		Event: &pb.ExecInteractiveResponse_Started{
			Started: &pb.ExecInteractiveStarted{TaskId: handle.TaskID},
		},
	}); err != nil {
		return err
	}

	// 4. recv goroutine: stdin チャンクを受信しパイプに書き込む
	recvDone := make(chan error, 1)
	go func() {
		defer handle.StdinPipe.Close()
		for {
			msg, err := stream.Recv()
			if err != nil {
				recvDone <- nil
				return
			}
			switch {
			case msg.GetStdinChunk() != nil:
				data := msg.GetStdinChunk().Data
				if len(data) > maxStdinChunkBytes {
					recvDone <- status.Errorf(codes.InvalidArgument, "stdin chunk too large")
					return
				}
				handle.StdinPipe.Write([]byte(data))
			case msg.GetCloseStdin() != nil:
				recvDone <- nil
				return
			}
		}
	}()

	// 5. send loop: output + done を消費
	outputDone := false
	for {
		if outputDone {
			select {
			case done := <-handle.Done:
				if done.Killed {
					_ = stream.Send(&pb.ExecInteractiveResponse{
						Event: &pb.ExecInteractiveResponse_Killed{
							Killed: &pb.ExecInteractiveKilled{
								Reason: done.KillReason,
								TimeMs: done.TimeMs,
							},
						},
					})
				} else {
					_ = stream.Send(&pb.ExecInteractiveResponse{
						Event: &pb.ExecInteractiveResponse_Completed{
							Completed: &pb.ExecInteractiveCompleted{
								ExitStatus: int32(done.ExitStatus),
								TimeMs:     done.TimeMs,
							},
						},
					})
				}
				return nil
			case <-stream.Context().Done():
				return nil
			}
		}
		select {
		case output, ok := <-handle.Output:
			if !ok {
				outputDone = true
				continue
			}
			streamEnum := pb.ExecInteractiveOutput_STDOUT
			if output.Stream == executor.StreamStderr {
				streamEnum = pb.ExecInteractiveOutput_STDERR
			}
			_ = stream.Send(&pb.ExecInteractiveResponse{
				Event: &pb.ExecInteractiveResponse_Output{
					Output: &pb.ExecInteractiveOutput{
						Stream: streamEnum,
						Data:   output.Data,
					},
				},
			})
		case done := <-handle.Done:
			// drain remaining output
			for output := range handle.Output {
				streamEnum := pb.ExecInteractiveOutput_STDOUT
				if output.Stream == executor.StreamStderr {
					streamEnum = pb.ExecInteractiveOutput_STDERR
				}
				_ = stream.Send(&pb.ExecInteractiveResponse{
					Event: &pb.ExecInteractiveResponse_Output{
						Output: &pb.ExecInteractiveOutput{
							Stream: streamEnum,
							Data:   output.Data,
						},
					},
				})
			}
			if done.Killed {
				_ = stream.Send(&pb.ExecInteractiveResponse{
					Event: &pb.ExecInteractiveResponse_Killed{
						Killed: &pb.ExecInteractiveKilled{
							Reason: done.KillReason,
							TimeMs: done.TimeMs,
						},
					},
				})
			} else {
				_ = stream.Send(&pb.ExecInteractiveResponse{
					Event: &pb.ExecInteractiveResponse_Completed{
						Completed: &pb.ExecInteractiveCompleted{
							ExitStatus: int32(done.ExitStatus),
							TimeMs:     done.TimeMs,
						},
					},
				})
			}
			return nil
		case <-stream.Context().Done():
			return nil
		}
	}
}
