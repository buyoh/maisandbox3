package sandbox

import "testing"

func TestValidatePath(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		{"normal file", "main.rb", nil},
		{"subdirectory", "src/main.rb", nil},
		{"deeply nested", "a/b/c/d.txt", nil},
		{"dot file", ".hidden", nil},
		{"absolute path", "/etc/passwd", ErrPathTraversal},
		{"parent traversal", "../secret", ErrPathTraversal},
		{"nested traversal", "a/../../secret", ErrPathTraversal},
		{"double dot only", "..", ErrPathTraversal},
		{"null byte", "file\x00.txt", ErrPathTraversal},
		{"windows absolute", "C:\\file.txt", nil}, // Linuxでは絶対パスではない
		{"current dir prefix", "./file.txt", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePath(tt.path)
			if err != tt.wantErr {
				t.Errorf("ValidatePath(%q) = %v, want %v", tt.path, err, tt.wantErr)
			}
		})
	}
}

func TestValidateResolvedPath(t *testing.T) {
	tests := []struct {
		name         string
		resolvedPath string
		baseDir      string
		wantErr      bool
	}{
		{"inside base", "/work/box1/file.txt", "/work/box1", false},
		{"at base", "/work/box1", "/work/box1", false},
		{"outside base", "/work/box2/file.txt", "/work/box1", true},
		{"parent of base", "/work", "/work/box1", true},
		{"completely different", "/etc/passwd", "/work/box1", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateResolvedPath(tt.resolvedPath, tt.baseDir)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateResolvedPath(%q, %q) = %v, wantErr %v", tt.resolvedPath, tt.baseDir, err, tt.wantErr)
			}
		})
	}
}
