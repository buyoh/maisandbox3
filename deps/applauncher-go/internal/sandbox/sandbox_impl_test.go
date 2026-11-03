package sandbox

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSandboxImpl_NewBox(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, err := s.NewBox()
	if err != nil {
		t.Fatalf("NewBox: %v", err)
	}
	if boxID == "" {
		t.Fatal("NewBox returned empty box ID")
	}

	// ディレクトリが存在すること
	dir, err := s.BoxDir(boxID)
	if err != nil {
		t.Fatalf("BoxDir: %v", err)
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatalf("box directory does not exist: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("box path is not a directory")
	}
}

func TestSandboxImpl_NewBox_Unique(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	id1, _ := s.NewBox()
	id2, _ := s.NewBox()
	if id1 == id2 {
		t.Fatalf("NewBox returned duplicate IDs: %s", id1)
	}
}

func TestSandboxImpl_BoxDir_NotFound(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	_, err = s.BoxDir("nonexistent")
	if err != ErrBoxNotFound {
		t.Fatalf("BoxDir(nonexistent) = %v, want ErrBoxNotFound", err)
	}
}

func TestSandboxImpl_DeleteBox(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()
	dir, _ := s.BoxDir(boxID)

	err = s.DeleteBox(boxID)
	if err != nil {
		t.Fatalf("DeleteBox: %v", err)
	}

	// ディレクトリが削除されていること
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatal("box directory still exists after delete")
	}

	// 再度 BoxDir は ErrBoxNotFound を返すこと
	_, err = s.BoxDir(boxID)
	if err != ErrBoxNotFound {
		t.Fatalf("BoxDir after delete = %v, want ErrBoxNotFound", err)
	}
}

func TestSandboxImpl_DeleteBox_Idempotent(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	// 存在しないboxを削除してもエラーにならない
	err = s.DeleteBox("nonexistent")
	if err != nil {
		t.Fatalf("DeleteBox(nonexistent) = %v, want nil", err)
	}
}

func TestSandboxImpl_StoreFiles(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()
	dir, _ := s.BoxDir(boxID)

	err = s.StoreFiles(boxID, []FileEntry{
		{Path: "main.rb", Data: "puts 'hello'"},
		{Path: "sub/helper.rb", Data: "def help; end"},
	})
	if err != nil {
		t.Fatalf("StoreFiles: %v", err)
	}

	// ファイルが正しく書き込まれていること
	data, err := os.ReadFile(filepath.Join(dir, "main.rb"))
	if err != nil {
		t.Fatalf("read main.rb: %v", err)
	}
	if string(data) != "puts 'hello'" {
		t.Fatalf("main.rb content = %q, want %q", string(data), "puts 'hello'")
	}

	data, err = os.ReadFile(filepath.Join(dir, "sub/helper.rb"))
	if err != nil {
		t.Fatalf("read sub/helper.rb: %v", err)
	}
	if string(data) != "def help; end" {
		t.Fatalf("sub/helper.rb content = %q, want %q", string(data), "def help; end")
	}
}

func TestSandboxImpl_StoreFiles_BoxNotFound(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	err = s.StoreFiles("nonexistent", []FileEntry{{Path: "a.txt", Data: "data"}})
	if err != ErrBoxNotFound {
		t.Fatalf("StoreFiles(nonexistent) = %v, want ErrBoxNotFound", err)
	}
}

func TestSandboxImpl_StoreFiles_PathTraversal(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()

	tests := []struct {
		name string
		path string
	}{
		{"absolute", "/etc/passwd"},
		{"parent", "../secret.txt"},
		{"nested parent", "a/../../secret.txt"},
		{"null byte", "file\x00.txt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s.StoreFiles(boxID, []FileEntry{{Path: tt.path, Data: "x"}})
			if err != ErrPathTraversal {
				t.Errorf("StoreFiles(path=%q) = %v, want ErrPathTraversal", tt.path, err)
			}
		})
	}
}

func TestSandboxImpl_StoreFiles_SymlinkTraversal(t *testing.T) {
	tmpDir := t.TempDir()
	s, err := NewSandboxImpl(tmpDir)
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()
	dir, _ := s.BoxDir(boxID)

	// box外のターゲットディレクトリを作成
	outsideDir := filepath.Join(tmpDir, "outside")
	os.MkdirAll(outsideDir, 0755)

	// box内にbox外を指すsymlinkを作成
	symlinkPath := filepath.Join(dir, "link")
	os.Symlink(outsideDir, symlinkPath)

	// symlink 経由で書き込もうとするとトラバーサルエラー
	err = s.StoreFiles(boxID, []FileEntry{{Path: "link/evil.txt", Data: "hacked"}})
	if err != ErrPathTraversal {
		t.Fatalf("StoreFiles via symlink = %v, want ErrPathTraversal", err)
	}

	// box外にファイルが書き込まれていないこと
	if _, err := os.Stat(filepath.Join(outsideDir, "evil.txt")); !os.IsNotExist(err) {
		t.Fatal("file was written outside box via symlink")
	}
}

func TestSandboxImpl_PullFiles(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()

	// ファイルを保存
	s.StoreFiles(boxID, []FileEntry{
		{Path: "out.txt", Data: "output"},
		{Path: "err.txt", Data: "error"},
	})

	// pull
	files, err := s.PullFiles(boxID, []string{"out.txt", "err.txt"})
	if err != nil {
		t.Fatalf("PullFiles: %v", err)
	}
	if len(files) != 2 {
		t.Fatalf("PullFiles returned %d files, want 2", len(files))
	}
	if files[0].Path != "out.txt" || files[0].Data != "output" {
		t.Errorf("files[0] = %+v, want {out.txt, output}", files[0])
	}
	if files[1].Path != "err.txt" || files[1].Data != "error" {
		t.Errorf("files[1] = %+v, want {err.txt, error}", files[1])
	}
}

func TestSandboxImpl_PullFiles_SkipMissing(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()

	files, err := s.PullFiles(boxID, []string{"nonexistent.txt"})
	if err != nil {
		t.Fatalf("PullFiles: %v", err)
	}
	if len(files) != 0 {
		t.Fatalf("PullFiles returned %d files for nonexistent, want 0", len(files))
	}
}

func TestSandboxImpl_PullFiles_BoxNotFound(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	_, err = s.PullFiles("nonexistent", []string{"a.txt"})
	if err != ErrBoxNotFound {
		t.Fatalf("PullFiles(nonexistent) = %v, want ErrBoxNotFound", err)
	}
}

func TestSandboxImpl_PullFiles_PathTraversal(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()

	_, err = s.PullFiles(boxID, []string{"../../../etc/passwd"})
	if err != ErrPathTraversal {
		t.Fatalf("PullFiles(traversal) = %v, want ErrPathTraversal", err)
	}
}

func TestSandboxImpl_PullFiles_SymlinkTraversal(t *testing.T) {
	tmpDir := t.TempDir()
	s, err := NewSandboxImpl(tmpDir)
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()
	dir, _ := s.BoxDir(boxID)

	// box外のファイルを作成
	secretFile := filepath.Join(tmpDir, "secret.txt")
	os.WriteFile(secretFile, []byte("secret data"), 0644)

	// box内にbox外ファイルを指すsymlinkを作成
	os.Symlink(secretFile, filepath.Join(dir, "link.txt"))

	// symlink 経由で読み込もうとするとトラバーサルエラー
	_, err = s.PullFiles(boxID, []string{"link.txt"})
	if err != ErrPathTraversal {
		t.Fatalf("PullFiles via symlink = %v, want ErrPathTraversal", err)
	}
}

func TestSandboxImpl_PullFiles_FileTooLarge(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()

	// 100KB超のファイルを直接書き込み
	dir, _ := s.BoxDir(boxID)
	largeData := strings.Repeat("x", MaxPullFileSizeBytes+1)
	os.WriteFile(filepath.Join(dir, "large.txt"), []byte(largeData), 0644)

	_, err = s.PullFiles(boxID, []string{"large.txt"})
	if err != ErrFileTooLarge {
		t.Fatalf("PullFiles(large) = %v, want ErrFileTooLarge", err)
	}
}

func TestSandboxImpl_PullFiles_TotalTooLarge(t *testing.T) {
	s, err := NewSandboxImpl(t.TempDir())
	if err != nil {
		t.Fatalf("NewSandboxImpl: %v", err)
	}

	boxID, _ := s.NewBox()
	dir, _ := s.BoxDir(boxID)

	// 各ファイルは制限内だが合計が400KB超
	fileData := strings.Repeat("x", MaxPullFileSizeBytes) // 100KB each
	for i := 0; i < 5; i++ {
		fname := filepath.Join(dir, string(rune('a'+i))+".txt")
		os.WriteFile(fname, []byte(fileData), 0644)
	}

	_, err = s.PullFiles(boxID, []string{"a.txt", "b.txt", "c.txt", "d.txt", "e.txt"})
	if err != ErrTotalSizeTooLarge {
		t.Fatalf("PullFiles(total too large) = %v, want ErrTotalSizeTooLarge", err)
	}
}
