package runner

import (
	"fmt"
	"io/fs"
	"regexp"
	"strings"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
	"gopkg.in/yaml.v3"
)

// IndexConfig はインデックスファイル（config.yaml）の構造。
type IndexConfig struct {
	Languages map[string]string `yaml:"languages"`
}

// LangConfig は言語ごとの実行パイプライン定義。
type LangConfig struct {
	// Meta は言語のメタ情報。
	Meta MetaConfig `yaml:"meta"`
	// Options はユーザが指定可能なビルドオプションの定義。
	// キーはオプション名で、args 内の {{key}} テンプレートに対応する。
	Options map[string]OptionDef `yaml:"options"`
	// Inputs は論理ファイル名→物理ファイル名のマッピング。
	// Node.js から送信される論理名（例: "code"）を、runner が期待する物理名（例: "code.cpp"）に変換する。
	// 省略時はファイル名の変換を行わない。
	Inputs map[string]string `yaml:"inputs"`
	// Actions はアクション名→定義のマップ。
	// run_single_stdio（必須）と run_version（任意）を含む。
	Actions map[string]ActionConfig `yaml:"actions"`
	// Phases は後方互換エイリアス。actions.run_single_stdio.phases と等価。
	// actions が定義されている場合は無視される。
	Phases []PhaseConfig `yaml:"phases,omitempty"`
}

// ActionConfig は単一アクションの定義。
type ActionConfig struct {
	// Phases はこのアクションのフェーズリスト。先頭から順に実行される。
	Phases []PhaseConfig `yaml:"phases"`
}

// MetaConfig は言語のメタ情報。
type MetaConfig struct {
	// DisplayName は UI 表示用の正式言語名。
	DisplayName string `yaml:"display_name"`
}

// OptionDef はユーザが選択可能なオプションの定義。
type OptionDef struct {
	// Type はオプションの型。現時点では "enum" のみ。
	Type string `yaml:"type"`
	// Values は許容される値のリスト。
	Values []string `yaml:"values"`
	// Default はリクエストで省略された場合に使用するデフォルト値。
	Default string `yaml:"default"`
	// DisplayName は UI 表示用のオプション名。省略時はキー名を使用。
	DisplayName string `yaml:"display_name"`
}

// PhaseConfig は単一フェーズの定義。
type PhaseConfig struct {
	// Name はフェーズ識別子。PhaseResult.Phase に対応する。
	Name string `yaml:"name"`
	// Cmd は実行コマンド。
	Cmd string `yaml:"cmd"`
	// Args はコマンド引数。省略時は空。
	// {{option_name}} テンプレートを含む場合、実行時にオプション値で置換される。
	Args []string `yaml:"args"`
	// StdinFromInput は入力ファイルリストから読み取るファイルパス。
	// 指定されたパスのファイル内容を stdin として渡す。
	// 省略時は stdin なし（空文字列）。
	StdinFromInput string `yaml:"stdin_from_input"`
	// StdoutToFile は stdout をファイルとして sandbox に保存するパス。
	// フェーズ成功時のみ保存される。省略時は保存しない。
	StdoutToFile string `yaml:"stdout_to_file"`
	// MultiRepeat が true のフェーズは RunTaskMulti で入力ごとに繰り返し実行される。
	// false のフェーズはビルドフェーズとして1回だけ実行される。
	// RunTask では無視される。
	MultiRepeat bool `yaml:"multi_repeat"`
}

// templatePattern は args 内の {{key}} テンプレートを検出する正規表現。
var templatePattern = regexp.MustCompile(`\{\{([^}]+)\}\}`)

// アクション名の定数
const (
	// ActionRunSingleStdio は通常のコード実行アクション（必須）。
	ActionRunSingleStdio = "run_single_stdio"
	// ActionRunVersion はバージョン情報取得アクション（任意）。
	ActionRunVersion = "run_version"
	// ActionInteractive はインタラクティブ実行アクション（任意）。
	ActionInteractive = "interactive"
)

// LoadConfigs は fs.FS から全言語設定をロード・検証する。
// バリデーションエラーがある場合はエラーを返す。
// fsys のルートに config.yaml と各言語ファイルが存在する前提で動作する。
func LoadConfigs(fsys fs.FS) (map[string]LangConfig, error) {
	// 1. Load index config
	indexData, err := fs.ReadFile(fsys, "config.yaml")
	if err != nil {
		return nil, fmt.Errorf("failed to read config.yaml: %w", err)
	}

	var index IndexConfig
	dec := yaml.NewDecoder(strings.NewReader(string(indexData)))
	dec.KnownFields(true)
	if err := dec.Decode(&index); err != nil {
		return nil, fmt.Errorf("failed to parse config.yaml: %w", err)
	}

	// Validate: at least one language
	if len(index.Languages) == 0 {
		return nil, fmt.Errorf("config.yaml: no languages defined")
	}

	// 2. Load each language config
	configs := make(map[string]LangConfig, len(index.Languages))
	for lang, filename := range index.Languages {
		data, err := fs.ReadFile(fsys, filename)
		if err != nil {
			return nil, fmt.Errorf("config.yaml references %q for lang %q, but file not found: %w", filename, lang, err)
		}

		var cfg LangConfig
		dec := yaml.NewDecoder(strings.NewReader(string(data)))
		dec.KnownFields(true)
		if err := dec.Decode(&cfg); err != nil {
			return nil, fmt.Errorf("failed to parse %s: %w", filename, err)
		}

		// Normalize: phases → actions["run_single_stdio"] (backward compat)
		if err := normalizeLangConfig(lang, &cfg); err != nil {
			return nil, err
		}

		if err := validateLangConfig(lang, &cfg); err != nil {
			return nil, err
		}

		configs[lang] = cfg
	}

	return configs, nil
}

// normalizeLangConfig は後方互換のため phases を actions に正規化する。
func normalizeLangConfig(lang string, cfg *LangConfig) error {
	hasActions := len(cfg.Actions) > 0
	hasPhases := len(cfg.Phases) > 0

	if !hasActions && !hasPhases {
		return fmt.Errorf("lang %q: either actions or phases must be defined", lang)
	}

	if !hasActions && hasPhases {
		// phases のみ → actions["run_single_stdio"] として正規化
		cfg.Actions = map[string]ActionConfig{
			ActionRunSingleStdio: {Phases: cfg.Phases},
		}
		cfg.Phases = nil
	} else if hasActions && hasPhases {
		// 両方存在 → phases を無視（警告ログは省略、将来エラーにする）
		cfg.Phases = nil
	}

	return nil
}

// validateLangConfig は単一言語の設定をバリデーションする。
func validateLangConfig(lang string, cfg *LangConfig) error {
	// meta.display_name is required
	if cfg.Meta.DisplayName == "" {
		return fmt.Errorf("lang %q: meta.display_name is required", lang)
	}

	// run_single_stdio action is required
	runAction, ok := cfg.Actions[ActionRunSingleStdio]
	if !ok {
		return fmt.Errorf("lang %q: action %q is required", lang, ActionRunSingleStdio)
	}
	if len(runAction.Phases) == 0 {
		return fmt.Errorf("lang %q: action %q: at least one phase is required", lang, ActionRunSingleStdio)
	}

	// Validate options
	for key, opt := range cfg.Options {
		if opt.Type != "enum" {
			return fmt.Errorf("lang %q: option %q: type must be \"enum\", got %q", lang, key, opt.Type)
		}
		if len(opt.Values) == 0 {
			return fmt.Errorf("lang %q: option %q: values must not be empty", lang, key)
		}
		if !contains(opt.Values, opt.Default) {
			return fmt.Errorf("lang %q: option %q: default %q is not in values %v", lang, key, opt.Default, opt.Values)
		}
		// Check for {{ in values (double-expansion prevention)
		for _, v := range opt.Values {
			if strings.Contains(v, "{{") {
				return fmt.Errorf("lang %q: option %q: value %q must not contain \"{{\"", lang, key, v)
			}
		}
	}

	// Validate inputs
	if err := validateInputs(lang, cfg.Inputs); err != nil {
		return err
	}

	// Validate all actions' phases
	for actionName, action := range cfg.Actions {
		if len(action.Phases) == 0 {
			return fmt.Errorf("lang %q: action %q: at least one phase is required", lang, actionName)
		}
		if err := validatePhases(lang, actionName, action.Phases, cfg.Options); err != nil {
			return err
		}
	}

	// Validate run_version specific constraints
	if versionAction, hasVersion := cfg.Actions[ActionRunVersion]; hasVersion {
		if err := validateRunVersionAction(lang, versionAction); err != nil {
			return err
		}
	}

	return nil
}

// validatePhases はフェーズリストをバリデーションする。
func validatePhases(lang, actionName string, phases []PhaseConfig, options map[string]OptionDef) error {
	phaseNames := make(map[string]bool, len(phases))
	for i := range phases {
		phase := &phases[i]

		if phase.Name == "" {
			return fmt.Errorf("lang %q: action %q: phase[%d]: name is required", lang, actionName, i)
		}
		if phase.Cmd == "" {
			return fmt.Errorf("lang %q: action %q: phase %q: cmd is required", lang, actionName, phase.Name)
		}
		if phaseNames[phase.Name] {
			return fmt.Errorf("lang %q: action %q: duplicate phase name %q", lang, actionName, phase.Name)
		}
		phaseNames[phase.Name] = true

		// Normalize nil args to empty slice
		if phase.Args == nil {
			phase.Args = []string{}
		}

		// Validate template references in args
		for _, arg := range phase.Args {
			matches := templatePattern.FindAllStringSubmatch(arg, -1)
			for _, m := range matches {
				key := m[1]
				if _, ok := options[key]; !ok {
					return fmt.Errorf("lang %q: action %q: phase %q: arg template {{%s}} references undefined option", lang, actionName, phase.Name, key)
				}
			}
		}
	}
	return nil
}

// validateRunVersionAction は run_version アクション固有のバリデーション。
func validateRunVersionAction(lang string, action ActionConfig) error {
	// run_version は stdin_from_input を使用してはならない
	for _, phase := range action.Phases {
		if phase.StdinFromInput != "" {
			return fmt.Errorf("lang %q: action %q: phase %q: stdin_from_input is not allowed in run_version", lang, ActionRunVersion, phase.Name)
		}
	}
	return nil
}

// validateInputs は inputs マッピングをバリデーションする。
func validateInputs(lang string, inputs map[string]string) error {
	if len(inputs) == 0 {
		return nil
	}
	seen := make(map[string]string, len(inputs)) // physicalPath -> logicalKey
	for key, val := range inputs {
		if val == "" {
			return fmt.Errorf("lang %q: inputs[%q]: empty path", lang, key)
		}
		if err := sandbox.ValidatePath(val); err != nil {
			return fmt.Errorf("lang %q: inputs[%q]: %w", lang, key, err)
		}
		if prevKey, dup := seen[val]; dup {
			return fmt.Errorf("lang %q: inputs[%q] and inputs[%q]: duplicate target path %q", lang, prevKey, key, val)
		}
		seen[val] = key
	}
	return nil
}

// contains checks if a string slice contains a value.
func contains(slice []string, value string) bool {
	for _, s := range slice {
		if s == value {
			return true
		}
	}
	return false
}
