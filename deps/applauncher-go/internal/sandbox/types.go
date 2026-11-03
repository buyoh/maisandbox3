// Package sandbox はbox（実行環境）のライフサイクルを管理する。
package sandbox

import "errors"

// ErrBoxNotFound はboxが存在しない場合に返されるエラー。
var ErrBoxNotFound = errors.New("box not found")

// ErrPathTraversal はパス検証でトラバーサルが検出された場合に返されるエラー。
var ErrPathTraversal = errors.New("path traversal detected")

// ErrFileTooLarge はファイルサイズが上限を超えた場合に返されるエラー。
var ErrFileTooLarge = errors.New("file too large")

// ErrTotalSizeTooLarge はpull時の合計サイズが上限を超えた場合に返されるエラー。
var ErrTotalSizeTooLarge = errors.New("total size too large")

// ErrBoxLimitReached はbox数が上限に達した場合に返されるエラー。
var ErrBoxLimitReached = errors.New("box limit reached")

// FileEntry はbox内のファイルを表す。
type FileEntry struct {
	Path string
	Data string
}

const (
	// MaxPullFileSizeBytes は1ファイルあたりのpull上限。
	MaxPullFileSizeBytes = 100 * 1024 // 100KB
	// MaxPullTotalSizeBytes はpull合計の上限。
	MaxPullTotalSizeBytes = 400 * 1024 // 400KB
	// MaxStoreFileSizeBytes は1ファイルあたりのstore上限。
	MaxStoreFileSizeBytes = 100 * 1024 // 100KB
	// DefaultMaxBoxes はbox数の上限デフォルト値。
	DefaultMaxBoxes = 100
)
