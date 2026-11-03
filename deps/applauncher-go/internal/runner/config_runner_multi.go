package runner

import (
	"context"
	"fmt"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// classifyPhases はフェーズ列をビルドフェーズと run（繰り返し）フェーズに分類する。
// multi_repeat: true のフェーズが繰り返し対象。それ以外がビルドフェーズ。
func classifyPhases(phases []PhaseConfig) (buildPhases []PhaseConfig, runPhases []PhaseConfig, err error) {
	foundRepeat := false
	for _, phase := range phases {
		if phase.MultiRepeat {
			foundRepeat = true
			if phase.StdinFromInput == "" {
				return nil, nil, fmt.Errorf("phase %q: multi_repeat requires stdin_from_input", phase.Name)
			}
			runPhases = append(runPhases, phase)
		} else {
			if foundRepeat {
				return nil, nil, fmt.Errorf("phase %q: non-repeat phase after repeat phase is not allowed", phase.Name)
			}
			buildPhases = append(buildPhases, phase)
		}
	}
	if len(runPhases) == 0 {
		return nil, nil, fmt.Errorf("no multi_repeat phases found")
	}
	return buildPhases, runPhases, nil
}

// RunMulti はビルドフェーズを1回実行し、run フェーズを stdinList 分繰り返す。
func (r *ConfigRunner) RunMulti(ctx context.Context, params RunMultiParams, emit func(MultiPhaseResult)) error {
	// 0. Resolve options
	resolvedOpts, err := r.resolveOptions(params.Options)
	if err != nil {
		return err
	}

	// 1. Apply inputs mapping
	mappedFiles := r.mapInputFiles(params.Files)

	// 2. Store files
	if err := r.sandbox.StoreFiles(params.BoxID, mappedFiles); err != nil {
		return &StoreError{Cause: err}
	}

	// 3. Classify phases
	phases := r.config.Actions[ActionRunSingleStdio].Phases
	buildPhases, runPhases, err := classifyPhases(phases)
	if err != nil {
		return fmt.Errorf("classifyPhases: %w", err)
	}

	// 4. Execute build phases (1回のみ)
	for i, phase := range buildPhases {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		var stdin string
		if phase.StdinFromInput != "" {
			stdin, _ = findFileData(mappedFiles, phase.StdinFromInput)
		}

		args := resolveArgs(phase.Args, resolvedOpts)

		result, err := execAndWait(ctx, r.executor, executor.ExecParams{
			Cmd:       phase.Cmd,
			Args:      args,
			WorkDir:   params.BoxDir,
			BoxID:     params.BoxID,
			Stdin:     stdin,
			TimeoutMs: params.PhaseTimeoutMs,
		}, phase.Name)
		if err != nil {
			return err
		}

		// Store stdout to file if configured
		if phase.StdoutToFile != "" && result.ExitStatus == 0 {
			if err := r.sandbox.StoreFiles(params.BoxID, []sandbox.FileEntry{
				{Path: phase.StdoutToFile, Data: result.Stdout},
			}); err != nil {
				return &StoreError{Cause: err}
			}
		}

		isLastBuild := i == len(buildPhases)-1

		emit(MultiPhaseResult{
			Type: MultiPhaseResultTypeBuild,
			BuildResult: &PhaseResult{
				Phase:        phase.Name,
				ExitStatus:   result.ExitStatus,
				TimeMs:       result.TimeMs,
				Stdout:       result.Stdout,
				Stderr:       result.Stderr,
				HasNextPhase: result.ExitStatus == 0 && !isLastBuild,
			},
		})

		// ビルド失敗時は即座に終了（run フェーズは実行しない）
		if result.ExitStatus != 0 {
			return nil
		}
	}

	// 5. Execute run phases for each stdin entry
	for entryIdx, entry := range params.StdinList {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		stdinFailed := false
		for _, phase := range runPhases {
			if stdinFailed {
				break
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}

			args := resolveArgs(phase.Args, resolvedOpts)

			result, err := execAndWait(ctx, r.executor, executor.ExecParams{
				Cmd:       phase.Cmd,
				Args:      args,
				WorkDir:   params.BoxDir,
				BoxID:     params.BoxID,
				Stdin:     entry.Data,
				TimeoutMs: params.PhaseTimeoutMs,
			}, phase.Name)
			if err != nil {
				return err
			}

			isLastRun := entryIdx == len(params.StdinList)-1

			emit(MultiPhaseResult{
				Type: MultiPhaseResultTypeRun,
				RunResult: &MultiRunResult{
					StdinIndex: entry.Index,
					ExitStatus: result.ExitStatus,
					TimeMs:     result.TimeMs,
					Stdout:     result.Stdout,
					Stderr:     result.Stderr,
					HasNextRun: !isLastRun,
				},
			})

			if result.ExitStatus != 0 {
				stdinFailed = true
			}
		}
	}

	return nil
}
