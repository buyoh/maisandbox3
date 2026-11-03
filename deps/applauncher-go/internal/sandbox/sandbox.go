package sandbox

// Sandbox はbox（実行環境）のライフサイクルを管理するインターフェース。
type Sandbox interface {
	// NewBox は新しいboxを作成し、box IDを返す。
	NewBox() (string, error)
	// BoxDir はbox IDに対応するディレクトリパスを返す。
	// boxが存在しない場合は ErrBoxNotFound を返す。
	BoxDir(boxID string) (string, error)
	// DeleteBox はboxを削除する。
	// boxが存在しない場合はエラーを返さない（冪等）。
	DeleteBox(boxID string) error
	// StoreFiles はbox内にファイルを書き込む。
	StoreFiles(boxID string, files []FileEntry) error
	// PullFiles はbox内からファイルを読み出す。
	// 存在しないファイルはスキップされる。
	PullFiles(boxID string, paths []string) ([]FileEntry, error)
}
