package runner

import (
	"context"
	"fmt"
	"strings"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// InvalidOptionError はリクエストで不正なオプション値が指定された場合のエラー。
type InvalidOptionError struct {
	Key     string
	Value   string
	Allowed []string
}

func (e *InvalidOptionError) Error() string {
	return fmt.Sprintf("invalid option %q: %q (allowed: %v)", e.Key, e.Value, e.Allowed)
}

// ConfigRunner は YAML 設定に基づいて実行パイプラインを駆動する汎用 Runner。
type ConfigRunner struct {
	sandbox  sandbox.Sandbox
	executor executor.Executor
	config   LangConfig
}

// NewConfigRunner は新しい ConfigRunner を作成する。
func NewConfigRunner(sb sandbox.Sandbox, exec executor.Executor, cfg LangConfig) *ConfigRunner {
	return &ConfigRunner{sandbox: sb, executor: exec, config: cfg}
}

func (r *ConfigRunner) Run(ctx context.Context, params RunParams, emit func(PhaseResult)) error {
	// 0. Resolve options (validate + apply defaults)
	resolvedOpts, err := r.resolveOptions(params.Options)
	if err != nil {
		return err
	}

	// 1. Apply inputs mapping (logical name → physical name)
	mappedFiles := r.mapInputFiles(params.Files)

	// 2. Store input files
	if err := r.sandbox.StoreFiles(params.BoxID, mappedFiles); err != nil {
		return &StoreError{Cause: err}
	}

	// 3. Execute phases sequentially
	phases := r.config.Actions[ActionRunSingleStdio].Phases
	for i, phase := range phases {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		// Resolve stdin (using mapped file names)
		var stdin string
		if phase.StdinFromInput != "" {
			stdin, _ = findFileData(mappedFiles, phase.StdinFromInput)
		}

		// Resolve args templates (e.g. "{{std}}" → "c++2a")
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

		// Store stdout to file if configured (success only)
		if phase.StdoutToFile != "" && result.ExitStatus == 0 {
			if err := r.sandbox.StoreFiles(params.BoxID, []sandbox.FileEntry{
				{Path: phase.StdoutToFile, Data: result.Stdout},
			}); err != nil {
				return &StoreError{Cause: err}
			}
		}

		if ctx.Err() != nil {
			return ctx.Err()
		}

		isLastPhase := i == len(phases)-1

		emit(PhaseResult{
			Phase:        phase.Name,
			ExitStatus:   result.ExitStatus,
			TimeMs:       result.TimeMs,
			Stdout:       result.Stdout,
			Stderr:       result.Stderr,
			HasNextPhase: result.ExitStatus == 0 && !isLastPhase,
		})

		if result.ExitStatus != 0 {
			return nil
		}
	}

	return nil
}

// mapInputFiles は inputs マッピングに基づいてファイルパスを変換する。
// マッピング未定義のファイルはそのまま保存する（将来の拡張性のため）。
// クライアントが送信しなかった入力は空ファイルとして補完する。
func (r *ConfigRunner) mapInputFiles(files []sandbox.FileEntry) []sandbox.FileEntry {
	if len(r.config.Inputs) == 0 {
		return files
	}
	// マッピング済みまたはパススルーの物理名を追跡し、補完時の重複を防ぐ
	seen := make(map[string]bool, len(r.config.Inputs))
	mapped := make([]sandbox.FileEntry, 0, len(files))
	for _, f := range files {
		if newPath, ok := r.config.Inputs[f.Path]; ok {
			mapped = append(mapped, sandbox.FileEntry{Path: newPath, Data: f.Data})
			seen[newPath] = true
		} else {
			mapped = append(mapped, f)
			seen[f.Path] = true
		}
	}
	// 未送信の入力を空ファイルとして補完
	for _, physicalPath := range r.config.Inputs {
		if !seen[physicalPath] {
			mapped = append(mapped, sandbox.FileEntry{Path: physicalPath, Data: ""})
		}
	}
	return mapped
}

// resolveOptions はリクエストのオプションをバリデーションし、デフォルト値を適用して返す。
func (r *ConfigRunner) resolveOptions(reqOpts map[string]string) (map[string]string, error) {
	resolved := make(map[string]string, len(r.config.Options))

	for key, def := range r.config.Options {
		value, specified := reqOpts[key]
		if !specified || value == "" {
			resolved[key] = def.Default
			continue
		}
		if !contains(def.Values, value) {
			return nil, &InvalidOptionError{Key: key, Value: value, Allowed: def.Values}
		}
		resolved[key] = value
	}
	return resolved, nil
}

// resolveArgs は args テンプレート内の {{key}} を resolved options で置換する。
func resolveArgs(args []string, opts map[string]string) []string {
	resolved := make([]string, len(args))
	for i, arg := range args {
		resolved[i] = arg
		for key, value := range opts {
			resolved[i] = strings.ReplaceAll(resolved[i], "{{"+key+"}}", value)
		}
	}
	return resolved
}

// VersionRunner はバージョン情報取得用インターフェース（Runner とは分離: ISP）。
type VersionRunner interface {
	// RunVersion は version アクションを実行し、stdout（先頭1行・最大1024バイト）を返す。
	// action run_version が未定義の場合は空文字列と false を返す。
	RunVersion(ctx context.Context, boxID, boxDir string) (version string, supported bool, err error)
}

// versionStdoutMaxBytes は version action の stdout キャプチャ上限。
const versionStdoutMaxBytes = 1024

// RunVersion は run_version アクションを実行し、バージョン文字列を返す。
// run_version が未定義の場合は ("", false, nil) を返す。
func (r *ConfigRunner) RunVersion(ctx context.Context, boxID, boxDir string) (string, bool, error) {
	versionAction, ok := r.config.Actions[ActionRunVersion]
	if !ok {
		return "", false, nil
	}

	// Resolve options (version action may use templates)
	resolvedOpts, err := r.resolveOptions(nil)
	if err != nil {
		return "", true, err
	}

	// Execute version phases (typically just one)
	var lastStdout string
	for _, phase := range versionAction.Phases {
		if ctx.Err() != nil {
			return "", true, ctx.Err()
		}

		args := resolveArgs(phase.Args, resolvedOpts)

		result, err := execAndWait(ctx, r.executor, executor.ExecParams{
			Cmd:       phase.Cmd,
			Args:      args,
			WorkDir:   boxDir,
			BoxID:     boxID,
			Stdin:     "",
			TimeoutMs: 5000, // 5秒タイムアウト
		}, phase.Name)
		if err != nil {
			return "", true, err
		}

		if result.ExitStatus != 0 {
			return "", true, fmt.Errorf("version phase %q failed with exit status %d", phase.Name, result.ExitStatus)
		}

		lastStdout = result.Stdout
	}

	// 先頭1行・最大1024バイトで切り捨て
	version := extractVersionLine(lastStdout)
	return version, true, nil
}

// extractVersionLine は stdout から先頭1行を抽出し、最大1024バイトで切り捨てる。
func extractVersionLine(stdout string) string {
	// 最大バイト数で切り捨て
	if len(stdout) > versionStdoutMaxBytes {
		stdout = stdout[:versionStdoutMaxBytes]
	}
	// 先頭1行を抽出
	if idx := strings.IndexByte(stdout, '\n'); idx >= 0 {
		stdout = stdout[:idx]
	}
	return strings.TrimSpace(stdout)
}
