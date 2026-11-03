import {
  InteractiveService,
  MultiStdioService,
  LangInfoService,
} from './service-interfaces';
import {
  createStubInteractiveService,
  createStubMultiStdioService,
} from './stub-services';
import { createFetchLangInfoService } from './fetch-lang-info-service';

/** デフォルトのインタラクティブサービス（将来リアル実装に差し替え） */
export const defaultInteractiveService: InteractiveService =
  createStubInteractiveService();

/** デフォルトの Multi-stdio サービス（将来リアル実装に差し替え） */
export const defaultMultiStdioService: MultiStdioService =
  createStubMultiStdioService();

/** デフォルトの言語情報サービス（REST API 経由で実データ取得） */
export const defaultLangInfoService: LangInfoService =
  createFetchLangInfoService();
