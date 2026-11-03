package executor

import (
	"context"
	"errors"
)

// ErrTaskNotInBox はKill時にtaskIDとboxIDが一致しない場合に返されるエラー。
var ErrTaskNotInBox = errors.New("task does not belong to the specified box")

// Executor はサンドボックス内でコマンドを実行するインターフェース。
type Executor interface {
	// Exec はコマンドを非同期で実行し、ExecHandle を返す。
	Exec(params ExecParams) *ExecHandle
	// ExecInteractive はプロセスをインタラクティブモードで起動する。
	ExecInteractive(ctx context.Context, params ExecInteractiveParams) (*InteractiveHandle, error)
	// Kill は実行中のタスクを強制終了する。
	// boxID が一致しない場合は ErrTaskNotInBox を返す。
	// taskID が存在しない場合はエラーを返さない（冪等）。
	Kill(boxID string, taskID string) error
}
