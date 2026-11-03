/**
 * 言語メタ情報取得用のクライアントインターフェース。
 * REST API ルート層にのみ注入する（タスク実行用 ILauncherClient とは分離: ISP）。
 */
import { LauncherResult } from './launcher-client-interface';
import { LangInfo, LangVersionResult } from '../../interfaces/lang-info-types';

/** 言語メタ情報取得用のクライアントインターフェース */
export interface ILauncherInfoClient {
  getLangInfo(): Promise<LauncherResult<LangInfo[]>>;
  getLangVersion(lang: string): Promise<LauncherResult<LangVersionResult>>;
}
