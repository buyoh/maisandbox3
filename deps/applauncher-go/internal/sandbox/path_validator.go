package sandbox

import (
	"os"
	"path/filepath"
	"strings"
)

// ValidatePath はパスがbox内に収まる安全なパスか検証する。
// 以下の条件を満たさない場合 ErrPathTraversal を返す:
// - 絶対パスでないこと
// - ".." を含まないこと
// - null バイトを含まないこと
func ValidatePath(p string) error {
	if filepath.IsAbs(p) {
		return ErrPathTraversal
	}
	if strings.Contains(p, "\x00") {
		return ErrPathTraversal
	}
	// Clean 後に ".." が先頭に来るケースを拒否
	cleaned := filepath.Clean(p)
	if cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return ErrPathTraversal
	}
	return nil
}

// ValidateResolvedPath は filepath.EvalSymlinks 後の実パスが baseDir 配下であることを検証する。
// symlink を使ったトラバーサルを防止する。
func ValidateResolvedPath(resolvedPath string, baseDir string) error {
	// baseDir と resolvedPath を正規化して比較
	absBase, err := filepath.Abs(baseDir)
	if err != nil {
		return err
	}
	absResolved, err := filepath.Abs(resolvedPath)
	if err != nil {
		return err
	}
	// resolvedPath が baseDir のサブパスであることを確認
	rel, err := filepath.Rel(absBase, absResolved)
	if err != nil {
		return ErrPathTraversal
	}
	if rel == ".." || strings.HasPrefix(rel, "../") {
		return ErrPathTraversal
	}
	return nil
}

// ResolveAndValidatePath は相対パスを baseDir に結合し、パス検証を行って絶対パスを返す。
// ExecFileIO のパス解決用。ファイルが存在しない場合はシンボリックリンク検証をスキップし、
// 静的なパス検証のみ行う（書き込み先パスの事前検証に対応）。
func ResolveAndValidatePath(baseDir string, relativePath string) (string, error) {
	if err := ValidatePath(relativePath); err != nil {
		return "", err
	}
	fullPath := filepath.Join(baseDir, relativePath)

	// ファイルが存在する場合は EvalSymlinks で実パスを検証
	if _, err := os.Lstat(fullPath); err == nil {
		resolved, err := filepath.EvalSymlinks(fullPath)
		if err != nil {
			return "", ErrPathTraversal
		}
		if err := ValidateResolvedPath(resolved, baseDir); err != nil {
			return "", err
		}
		return resolved, nil
	}

	// ファイルが存在しない場合は親ディレクトリを検証
	parentDir := filepath.Dir(fullPath)
	if _, err := os.Lstat(parentDir); err == nil {
		resolvedParent, err := filepath.EvalSymlinks(parentDir)
		if err != nil {
			return "", ErrPathTraversal
		}
		if err := ValidateResolvedPath(resolvedParent, baseDir); err != nil {
			return "", err
		}
	}

	return fullPath, nil
}
