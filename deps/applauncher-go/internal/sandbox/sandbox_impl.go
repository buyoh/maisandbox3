package sandbox

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// SandboxImpl はSandboxインターフェースのファイルシステムベース実装。
type SandboxImpl struct {
	mu       sync.RWMutex
	workDir  string
	boxes    map[string]string // boxID -> absolute directory path
	maxBoxes int
}

// NewSandboxImpl は新しいSandboxImplを作成する。
// workDirはbox作成の親ディレクトリ。存在しない場合は作成される。
func NewSandboxImpl(workDir string) (*SandboxImpl, error) {
	absWorkDir, err := filepath.Abs(workDir)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve workdir: %w", err)
	}
	if err := os.MkdirAll(absWorkDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create workdir: %w", err)
	}
	return &SandboxImpl{
		workDir:  absWorkDir,
		boxes:    make(map[string]string),
		maxBoxes: DefaultMaxBoxes,
	}, nil
}

func (s *SandboxImpl) NewBox() (string, error) {
	s.mu.Lock()
	if len(s.boxes) >= s.maxBoxes {
		s.mu.Unlock()
		return "", ErrBoxLimitReached
	}
	s.mu.Unlock()

	boxID, err := generateBoxID()
	if err != nil {
		return "", fmt.Errorf("failed to generate box ID: %w", err)
	}

	boxDir := filepath.Join(s.workDir, boxID)
	if err := os.MkdirAll(boxDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create box directory: %w", err)
	}

	s.mu.Lock()
	s.boxes[boxID] = boxDir
	s.mu.Unlock()

	return boxID, nil
}

func (s *SandboxImpl) BoxDir(boxID string) (string, error) {
	s.mu.RLock()
	dir, ok := s.boxes[boxID]
	s.mu.RUnlock()
	if !ok {
		return "", ErrBoxNotFound
	}
	return dir, nil
}

func (s *SandboxImpl) DeleteBox(boxID string) error {
	s.mu.Lock()
	dir, ok := s.boxes[boxID]
	if ok {
		delete(s.boxes, boxID)
	}
	s.mu.Unlock()

	if !ok {
		return nil // 冪等: 存在しない場合はエラーを返さない
	}

	return os.RemoveAll(dir)
}

func (s *SandboxImpl) StoreFiles(boxID string, files []FileEntry) error {
	boxDir, err := s.BoxDir(boxID)
	if err != nil {
		return err
	}

	for _, f := range files {
		if err := ValidatePath(f.Path); err != nil {
			return err
		}

		// ファイルサイズ制限
		if len(f.Data) > MaxStoreFileSizeBytes {
			return ErrFileTooLarge
		}

		targetPath := filepath.Join(boxDir, f.Path)

		// サブディレクトリが必要な場合は作成
		dir := filepath.Dir(targetPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory for %s: %w", f.Path, err)
		}

		// TOCTOU対策: 書き込み前に親ディレクトリを EvalSymlinks で検証
		resolvedDir, err := filepath.EvalSymlinks(dir)
		if err != nil {
			return ErrPathTraversal
		}
		if err := ValidateResolvedPath(resolvedDir, boxDir); err != nil {
			return err
		}

		// 検証済みの実パスに書き込み
		resolvedTarget := filepath.Join(resolvedDir, filepath.Base(targetPath))
		if err := os.WriteFile(resolvedTarget, []byte(f.Data), 0644); err != nil {
			return fmt.Errorf("failed to write file %s: %w", f.Path, err)
		}
	}
	return nil
}

func (s *SandboxImpl) PullFiles(boxID string, paths []string) ([]FileEntry, error) {
	boxDir, err := s.BoxDir(boxID)
	if err != nil {
		return nil, err
	}

	var totalSize int64
	var files []FileEntry

	for _, p := range paths {
		if err := ValidatePath(p); err != nil {
			return nil, err
		}

		targetPath := filepath.Join(boxDir, p)

		// symlink トラバーサル検証
		resolved, err := filepath.EvalSymlinks(targetPath)
		if err != nil {
			// ファイルが存在しない場合はスキップ
			if os.IsNotExist(err) {
				continue
			}
			return nil, ErrPathTraversal
		}
		if err := ValidateResolvedPath(resolved, boxDir); err != nil {
			return nil, err
		}

		info, err := os.Stat(resolved)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return nil, fmt.Errorf("failed to stat %s: %w", p, err)
		}

		if info.Size() > MaxPullFileSizeBytes {
			return nil, ErrFileTooLarge
		}

		totalSize += info.Size()
		if totalSize > MaxPullTotalSizeBytes {
			return nil, ErrTotalSizeTooLarge
		}

		data, err := os.ReadFile(resolved)
		if err != nil {
			return nil, fmt.Errorf("failed to read file %s: %w", p, err)
		}

		files = append(files, FileEntry{Path: p, Data: string(data)})
	}

	return files, nil
}

// generateBoxID は暗号学的に安全なランダム文字列を生成する。
func generateBoxID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
