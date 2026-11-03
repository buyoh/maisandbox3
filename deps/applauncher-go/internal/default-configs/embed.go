package defaultconfigs

import "embed"

// FS は Launcher に組み込むデフォルト設定ファイルを提供する。
//go:embed *.yaml
var FS embed.FS