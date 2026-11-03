package runner

import (
	"strings"
	"testing"
	"testing/fstest"

	defaultconfigs "github.com/buyoh/maisandbox3/deps/applauncher-go/internal/default-configs"
)

func TestLoadConfigs_EmbeddedConfigs(t *testing.T) {
	// Load from the real embedded configs
	configs, err := LoadConfigs(defaultconfigs.FS)
	if err != nil {
		t.Fatalf("LoadConfigs failed: %v", err)
	}

	// Verify all 3 languages are loaded
	if len(configs) != 3 {
		t.Fatalf("expected 3 languages, got %d", len(configs))
	}

	// Ruby
	ruby, ok := configs["ruby"]
	if !ok {
		t.Fatal("ruby config not found")
	}
	if ruby.Meta.DisplayName != "Ruby" {
		t.Errorf("ruby display_name: got %q, want %q", ruby.Meta.DisplayName, "Ruby")
	}
	rubyPhases := ruby.Actions[ActionRunSingleStdio].Phases
	if len(rubyPhases) != 1 {
		t.Fatalf("ruby phases: got %d, want 1", len(rubyPhases))
	}
	if rubyPhases[0].Name != "run" {
		t.Errorf("ruby phase[0].name: got %q, want %q", rubyPhases[0].Name, "run")
	}
	if rubyPhases[0].Cmd != "ruby" {
		t.Errorf("ruby phase[0].cmd: got %q, want %q", rubyPhases[0].Cmd, "ruby")
	}
	if rubyPhases[0].StdinFromInput != "stdin.txt" {
		t.Errorf("ruby phase[0].stdin_from_input: got %q, want %q", rubyPhases[0].StdinFromInput, "stdin.txt")
	}
	if len(ruby.Options) != 0 {
		t.Errorf("ruby options: got %d, want 0", len(ruby.Options))
	}

	// C++
	cpp, ok := configs["cpp"]
	if !ok {
		t.Fatal("cpp config not found")
	}
	if cpp.Meta.DisplayName != "C++" {
		t.Errorf("cpp display_name: got %q, want %q", cpp.Meta.DisplayName, "C++")
	}
	cppPhases := cpp.Actions[ActionRunSingleStdio].Phases
	if len(cppPhases) != 2 {
		t.Fatalf("cpp phases: got %d, want 2", len(cppPhases))
	}
	if cppPhases[0].Name != "build" {
		t.Errorf("cpp phase[0].name: got %q, want %q", cppPhases[0].Name, "build")
	}
	if cppPhases[0].Cmd != "g++" {
		t.Errorf("cpp phase[0].cmd: got %q, want %q", cppPhases[0].Cmd, "g++")
	}
	if cppPhases[1].Name != "run" {
		t.Errorf("cpp phase[1].name: got %q, want %q", cppPhases[1].Name, "run")
	}
	// Check options
	stdOpt, ok := cpp.Options["std"]
	if !ok {
		t.Fatal("cpp option 'std' not found")
	}
	if stdOpt.Type != "enum" {
		t.Errorf("cpp option std.type: got %q, want %q", stdOpt.Type, "enum")
	}
	if stdOpt.Default != "c++2a" {
		t.Errorf("cpp option std.default: got %q, want %q", stdOpt.Default, "c++2a")
	}
	if len(stdOpt.Values) != 4 {
		t.Errorf("cpp option std.values: got %d, want 4", len(stdOpt.Values))
	}

	// CLay
	clay, ok := configs["clay"]
	if !ok {
		t.Fatal("clay config not found")
	}
	if clay.Meta.DisplayName != "CLay" {
		t.Errorf("clay display_name: got %q, want %q", clay.Meta.DisplayName, "CLay")
	}
	clayPhases := clay.Actions[ActionRunSingleStdio].Phases
	if len(clayPhases) != 3 {
		t.Fatalf("clay phases: got %d, want 3", len(clayPhases))
	}
	if clayPhases[0].Name != "transpile" {
		t.Errorf("clay phase[0].name: got %q, want %q", clayPhases[0].Name, "transpile")
	}
	if clayPhases[0].StdoutToFile != "out.cpp" {
		t.Errorf("clay phase[0].stdout_to_file: got %q, want %q", clayPhases[0].StdoutToFile, "out.cpp")
	}
}

func TestLoadConfigs_ArgsNormalized(t *testing.T) {
	configs, err := LoadConfigs(defaultconfigs.FS)
	if err != nil {
		t.Fatalf("LoadConfigs failed: %v", err)
	}

	// CLay's run phase has no args in YAML → should be normalized to empty slice
	clay := configs["clay"]
	clayPhases := clay.Actions[ActionRunSingleStdio].Phases
	runPhase := clayPhases[2] // run phase
	if runPhase.Args == nil {
		t.Error("expected Args to be non-nil (normalized to empty slice)")
	}
	if len(runPhase.Args) != 0 {
		t.Errorf("expected 0 args for clay run phase, got %d", len(runPhase.Args))
	}
}

func TestLoadConfigs_ValidationError_NoLanguages(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n")},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for empty languages")
	}
	if !strings.Contains(err.Error(), "no languages defined") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_MissingFile(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  ruby: ruby.yaml\n")},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for missing language file")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_NoPhases(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml":   &fstest.MapFile{Data: []byte("meta:\n  display_name: Test\nphases: []\n")},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for no phases")
	}
	if !strings.Contains(err.Error(), "either actions or phases must be defined") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_EmptyPhaseName(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
phases:
  - name: ""
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for empty phase name")
	}
	if !strings.Contains(err.Error(), "name is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_EmptyCmd(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
phases:
  - name: run
    cmd: ""
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for empty cmd")
	}
	if !strings.Contains(err.Error(), "cmd is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_DuplicatePhaseName(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
phases:
  - name: run
    cmd: echo
  - name: run
    cmd: cat
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for duplicate phase name")
	}
	if !strings.Contains(err.Error(), "duplicate phase name") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_MissingDisplayName(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: ""
phases:
  - name: run
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for missing display_name")
	}
	if !strings.Contains(err.Error(), "display_name is required") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_OptionDefaultNotInValues(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
options:
  std:
    type: enum
    values: ["c++14", "c++17"]
    default: "c++20"
phases:
  - name: build
    cmd: g++
    args: ["-std={{std}}"]
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for default not in values")
	}
	if !strings.Contains(err.Error(), "default") && !strings.Contains(err.Error(), "not in values") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_UndefinedTemplateReference(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
phases:
  - name: build
    cmd: g++
    args: ["-std={{undefined_option}}"]
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for undefined template reference")
	}
	if !strings.Contains(err.Error(), "undefined option") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_OptionValuesContainTemplate(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
options:
  std:
    type: enum
    values: ["{{bad}}"]
    default: "{{bad}}"
phases:
  - name: build
    cmd: g++
    args: ["-std={{std}}"]
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for values containing {{")
	}
	if !strings.Contains(err.Error(), "must not contain") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_UnknownField(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
phases:
  - name: run
    cmd: echo
    unknown_field: value
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for unknown field")
	}
	// yaml.v3 KnownFields error message
	if !strings.Contains(err.Error(), "not found") && !strings.Contains(err.Error(), "unknown") && !strings.Contains(err.Error(), "field") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_InvalidOptionType(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
options:
  mode:
    type: string
    values: ["a"]
    default: "a"
phases:
  - name: run
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for invalid option type")
	}
	if !strings.Contains(err.Error(), "type must be") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_InputsValid(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
inputs:
  code: code.rb
  stdin: stdin.txt
phases:
  - name: run
    cmd: ruby
    args: ["./code.rb"]
    stdin_from_input: stdin.txt
`)},
	}
	configs, err := LoadConfigs(fsys)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cfg := configs["test"]
	if len(cfg.Inputs) != 2 {
		t.Fatalf("expected 2 inputs, got %d", len(cfg.Inputs))
	}
	if cfg.Inputs["code"] != "code.rb" {
		t.Errorf("inputs[code]: got %q, want %q", cfg.Inputs["code"], "code.rb")
	}
	if cfg.Inputs["stdin"] != "stdin.txt" {
		t.Errorf("inputs[stdin]: got %q, want %q", cfg.Inputs["stdin"], "stdin.txt")
	}
}

func TestLoadConfigs_ValidationError_InputsEmptyPath(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
inputs:
  code: ""
phases:
  - name: run
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for empty input path")
	}
	if !strings.Contains(err.Error(), "empty path") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_InputsPathTraversal(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
inputs:
  code: "../escape.cpp"
phases:
  - name: run
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for path traversal in inputs")
	}
	if !strings.Contains(err.Error(), "inputs") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_ValidationError_InputsDuplicateTarget(t *testing.T) {
	fsys := fstest.MapFS{
		"config.yaml": &fstest.MapFile{Data: []byte("languages:\n  test: test.yaml\n")},
		"test.yaml": &fstest.MapFile{Data: []byte(`meta:
  display_name: Test
inputs:
  code: same.txt
  stdin: same.txt
phases:
  - name: run
    cmd: echo
`)},
	}
	_, err := LoadConfigs(fsys)
	if err == nil {
		t.Fatal("expected error for duplicate target path in inputs")
	}
	if !strings.Contains(err.Error(), "duplicate target path") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLoadConfigs_EmbeddedConfigs_Inputs(t *testing.T) {
	configs, err := LoadConfigs(defaultconfigs.FS)
	if err != nil {
		t.Fatalf("LoadConfigs failed: %v", err)
	}

	// Verify inputs are loaded for each language
	cpp := configs["cpp"]
	if cpp.Inputs["code"] != "code.cpp" {
		t.Errorf("cpp inputs[code]: got %q, want %q", cpp.Inputs["code"], "code.cpp")
	}
	if cpp.Inputs["stdin"] != "stdin.txt" {
		t.Errorf("cpp inputs[stdin]: got %q, want %q", cpp.Inputs["stdin"], "stdin.txt")
	}

	ruby := configs["ruby"]
	if ruby.Inputs["code"] != "code.rb" {
		t.Errorf("ruby inputs[code]: got %q, want %q", ruby.Inputs["code"], "code.rb")
	}
	if ruby.Inputs["stdin"] != "stdin.txt" {
		t.Errorf("ruby inputs[stdin]: got %q, want %q", ruby.Inputs["stdin"], "stdin.txt")
	}

	clay := configs["clay"]
	if clay.Inputs["code"] != "code.cpp" {
		t.Errorf("clay inputs[code]: got %q, want %q", clay.Inputs["code"], "code.cpp")
	}
	if clay.Inputs["stdin"] != "stdin.txt" {
		t.Errorf("clay inputs[stdin]: got %q, want %q", clay.Inputs["stdin"], "stdin.txt")
	}
}
