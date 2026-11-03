/** 言語メタ情報（/api/lang-info レスポンス）。バージョンを含まない軽量データ。 */
export interface LangInfo {
  lang: string;
  displayName: string;
  options: LangOptionDef[];
}

/** 言語オプション定義。 */
export interface LangOptionDef {
  key: string;
  type: string;
  values: string[];
  defaultValue: string;
  displayName: string;
}

/** 言語バージョン取得結果。 */
export interface LangVersionResult {
  version: string;
  /** 取得失敗時の理由。成功時は空文字列。 */
  error: string;
}
