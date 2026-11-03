package sandbox

import (
	"fmt"
	"sync"
)

// SandboxStub はテスト用のSandbox実装。ファイルシステムを使用せずメモリ上で動作する。
type SandboxStub struct {
	mu         sync.RWMutex
	boxCounter int
	boxes      map[string]map[string]string // boxID -> (path -> data)

	// StoreCalls は StoreFiles の呼び出し記録。テストで検証に使用する。
	StoreCalls []StoreCall
	// StoreError が non-nil の場合、StoreErrorAfterN 回目以降の StoreFiles でこのエラーを返す。
	StoreError error
	// StoreErrorAfterN は StoreError を返し始める呼び出し回数（0-indexed）。
	StoreErrorAfterN int
}

// StoreCall は StoreFiles の呼び出し引数を記録する。
type StoreCall struct {
	BoxID string
	Files []FileEntry
}

// NewSandboxStub は新しいSandboxStubを作成する。
func NewSandboxStub() *SandboxStub {
	return &SandboxStub{
		boxes: make(map[string]map[string]string),
	}
}

func (s *SandboxStub) NewBox() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.boxCounter++
	boxID := fmt.Sprintf("stub-box-%d", s.boxCounter)
	s.boxes[boxID] = make(map[string]string)
	return boxID, nil
}

func (s *SandboxStub) BoxDir(boxID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if _, ok := s.boxes[boxID]; !ok {
		return "", ErrBoxNotFound
	}
	return "/fake/" + boxID, nil
}

func (s *SandboxStub) DeleteBox(boxID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.boxes, boxID)
	return nil
}

func (s *SandboxStub) StoreFiles(boxID string, files []FileEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.StoreCalls = append(s.StoreCalls, StoreCall{BoxID: boxID, Files: files})

	if s.StoreError != nil && len(s.StoreCalls) > s.StoreErrorAfterN {
		return s.StoreError
	}

	box, ok := s.boxes[boxID]
	if !ok {
		return ErrBoxNotFound
	}
	for _, f := range files {
		if err := ValidatePath(f.Path); err != nil {
			return err
		}
		box[f.Path] = f.Data
	}
	return nil
}

func (s *SandboxStub) PullFiles(boxID string, paths []string) ([]FileEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	box, ok := s.boxes[boxID]
	if !ok {
		return nil, ErrBoxNotFound
	}
	var files []FileEntry
	for _, p := range paths {
		if err := ValidatePath(p); err != nil {
			return nil, err
		}
		if data, ok := box[p]; ok {
			files = append(files, FileEntry{Path: p, Data: data})
		}
	}
	return files, nil
}
