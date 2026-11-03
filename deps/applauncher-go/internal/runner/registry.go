package runner

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"sync"

	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/executor"
	"github.com/buyoh/maisandbox3/deps/applauncher-go/internal/sandbox"
)

// LangInfo は言語メタ情報（バージョンを含まない）。
type LangInfo struct {
	Lang        string
	DisplayName string
	Options     []LangOptionInfo
}

// LangOptionInfo はオプション定義の公開表現。
type LangOptionInfo struct {
	Key          string
	Type         string
	Values       []string
	DefaultValue string
	DisplayName  string
}

// Registry は lang → Runner のマッピングを管理する。
type Registry struct {
	runners map[string]Runner
	configs map[string]LangConfig
	sandbox sandbox.Sandbox

	// バージョンキャッシュ（言語ごとに保持。成功時のみ格納。）
	versionCache   map[string]string
	versionCacheMu sync.Mutex
	// バージョン取得のグローバル排他（同時1件のみ Box を使用）
	versionSem chan struct{}
}

// NewRegistry は新しい Registry を作成し、YAML 設定ファイルに基づいて全言語のランナーを登録する。
// 環境変数 LAUNCHER_CONFIGS_DIR が設定されている場合はそのディレクトリからロードし、
// 未設定の場合はバイナリに埋め込まれたデフォルト設定を使用する。
// 設定ファイルのロードまたはバリデーションに失敗した場合はエラーを返す。
func NewRegistry(sb sandbox.Sandbox, exec executor.Executor) (*Registry, error) {
	configsFS, err := resolveConfigsFS()
	if err != nil {
		return nil, err
	}

	configs, err := LoadConfigs(configsFS)
	if err != nil {
		return nil, fmt.Errorf("failed to load runner configs: %w", err)
	}

	runners := make(map[string]Runner, len(configs))
	for lang, cfg := range configs {
		runners[lang] = NewConfigRunner(sb, exec, cfg)
	}

	return &Registry{
		runners:      runners,
		configs:      configs,
		sandbox:      sb,
		versionCache: make(map[string]string),
		versionSem:   make(chan struct{}, 1),
	}, nil
}

// resolveConfigsFS は設定ファイルの fs.FS を解決する。
func resolveConfigsFS() (fs.FS, error) {
	dir := os.Getenv("LAUNCHER_CONFIGS_DIR")
	if dir != "" {
		// validate that the directory exists
		if stat, err := os.Stat(dir); err != nil || !stat.IsDir() {
			// check absolute path
			if absDir, err := filepath.Abs(dir); err == nil {
				dir = absDir
			}
			return nil, fmt.Errorf("LAUNCHER_CONFIGS_DIR is set to %s, but it is not a valid directory", dir)
		}
		return os.DirFS(dir), nil
	}
	panic("LAUNCHER_CONFIGS_DIR is not set")
}

// Get は指定された lang に対応する Runner を返す。存在しない場合は nil。
func (r *Registry) Get(lang string) Runner {
	return r.runners[lang]
}

// GetAllLangInfo は全言語のメタ情報（バージョンを含まない）を返す。
// config の静的データのみで構成されるため、コード実行は行わない。
func (r *Registry) GetAllLangInfo() []LangInfo {
	infos := make([]LangInfo, 0, len(r.configs))
	for lang, cfg := range r.configs {
		opts := make([]LangOptionInfo, 0, len(cfg.Options))
		for key, opt := range cfg.Options {
			opts = append(opts, LangOptionInfo{
				Key:          key,
				Type:         opt.Type,
				Values:       opt.Values,
				DefaultValue: opt.Default,
				DisplayName:  opt.DisplayName,
			})
		}
		infos = append(infos, LangInfo{
			Lang:        lang,
			DisplayName: cfg.Meta.DisplayName,
			Options:     opts,
		})
	}
	sort.Slice(infos, func(i, j int) bool { return infos[i].Lang < infos[j].Lang })
	return infos
}

// HasLang は指定言語が登録されているか返す。
func (r *Registry) HasLang(lang string) bool {
	_, ok := r.runners[lang]
	return ok
}

// GetLangVersion は指定言語のバージョン文字列を返す。
// 内部で run_version アクションを実行し、成功した結果のみキャッシュする。
func (r *Registry) GetLangVersion(ctx context.Context, lang string) (version string, err string) {
	// キャッシュチェック
	r.versionCacheMu.Lock()
	if v, ok := r.versionCache[lang]; ok {
		r.versionCacheMu.Unlock()
		return v, ""
	}
	r.versionCacheMu.Unlock()

	runner := r.runners[lang]
	if runner == nil {
		return "", "invalid_lang"
	}

	// VersionRunner インターフェースを実装しているか確認
	vr, ok := runner.(VersionRunner)
	if !ok {
		return "", "action_not_defined"
	}

	// グローバル semaphore で同時1件に制限
	select {
	case r.versionSem <- struct{}{}:
		defer func() { <-r.versionSem }()
	case <-ctx.Done():
		return "", "timeout"
	}

	// semaphore 取得後にキャッシュ再チェック（待機中に他のリクエストがキャッシュした可能性）
	r.versionCacheMu.Lock()
	if v, ok := r.versionCache[lang]; ok {
		r.versionCacheMu.Unlock()
		return v, ""
	}
	r.versionCacheMu.Unlock()

	// Box 確保
	boxID, boxErr := r.sandbox.NewBox()
	if boxErr != nil {
		return "", "resource_unavailable"
	}
	defer r.sandbox.DeleteBox(boxID)

	boxDir, boxErr := r.sandbox.BoxDir(boxID)
	if boxErr != nil {
		return "", "resource_unavailable"
	}

	v, supported, execErr := vr.RunVersion(ctx, boxID, boxDir)
	if !supported {
		return "", "action_not_defined"
	}
	if execErr != nil {
		if ctx.Err() != nil {
			return "", "timeout"
		}
		return "", "execution_failed"
	}

	// 成功時のみキャッシュ
	r.versionCacheMu.Lock()
	r.versionCache[lang] = v
	r.versionCacheMu.Unlock()

	return v, ""
}
