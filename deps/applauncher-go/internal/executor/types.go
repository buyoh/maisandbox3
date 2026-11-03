// Package executor はサンドボックス内でコマンドを実行するモジュール。
package executor

// KillReason はkillの理由を表す。
type KillReason int

const (
	KillReasonUser    KillReason = iota
	KillReasonTimeout
)

// ExecParams はコマンド実行のパラメータ。
type ExecParams struct {
	Cmd     string
	Args    []string
	WorkDir string
	// BoxID は実行対象のbox ID。Kill時のスコープ検証に使用。
	BoxID string
	// Stdin は標準入力。nilの場合は空。
	Stdin string
	// TimeoutMs は実行タイムアウト（ミリ秒）。0は無制限。
	TimeoutMs uint32
}

// ExecResult はコマンド実行の結果。
type ExecResult struct {
	// Exited はプロセスが正常に起動し終了したかどうか。
	// falseの場合はコマンド起動自体が失敗（コマンド不在等）。
	Exited     bool
	ExitStatus int
	// TimeMs は実行時間（ミリ秒）。
	TimeMs float64
	Stdout string
	Stderr string
	// Killed はkillまたはtimeoutで終了した場合の理由。nilなら正常終了。
	Killed *KillReason
}

// ExecHandle は実行中タスクのハンドル。
type ExecHandle struct {
	// TaskID はこのタスクの一意な識別子。
	TaskID string
	// Done は実行完了時にcloseされるチャネル。
	Done <-chan struct{}
	// Result は実行完了後に結果を返す。Done がclose された後に呼ぶこと。
	Result func() ExecResult
}

const (
	// MaxOutputBytes は stdout/stderr 内部バッファの上限。超過分は切り捨てる。
	MaxOutputBytes = 100 * 1024 // 100KB
	// DefaultMaxConcurrentTasks は同時実行タスク数の上限デフォルト値。
	DefaultMaxConcurrentTasks = 16
)
