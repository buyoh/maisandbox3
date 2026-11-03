/**
 * gRPC ベースの ILauncherInfoClient 実装。
 * 言語メタ情報（GetLangInfo）とバージョン取得（GetLangVersion）を提供する。
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { LauncherResult } from './launcher-client-interface';
import { ILauncherInfoClient } from './launcher-info-client-interface';
import {
  LangInfo,
  LangOptionDef,
  LangVersionResult,
} from '../../interfaces/lang-info-types';
import Config from '../config';

// ESM とビルド後の配置に依存せず、プロジェクトルートの proto を参照する。
const PROTO_PATH = path.resolve(
  Config.appRootDirectory,
  'src/proto/launcher.proto'
);

/** GetLangInfo のタイムアウト（ミリ秒）。config 読み出しのみなので短い。 */
const GET_LANG_INFO_DEADLINE_MS = 5000;
/** GetLangVersion のタイムアウト（ミリ秒）。コード実行を伴う。 */
const GET_LANG_VERSION_DEADLINE_MS = 15000;

interface GrpcLauncherInfoService {
  getLangInfo(
    request: any,
    options: any,
    callback: (err: grpc.ServiceError | null, response: any) => void
  ): void;
  getLangVersion(
    request: any,
    options: any,
    callback: (err: grpc.ServiceError | null, response: any) => void
  ): void;
  close(): void;
}

/**
 * gRPC ベースの言語情報クライアント。
 * GetLangInfo / GetLangVersion の Unary RPC を提供する。
 */
export class LauncherInfoGrpcClient implements ILauncherInfoClient {
  private client: GrpcLauncherInfoService;

  constructor(address: string) {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: false,
      longs: Number,
      enums: Number,
      defaults: true,
      oneofs: true,
    });
    const protoDescriptor = grpc.loadPackageDefinition(
      packageDefinition
    ) as any;
    const LauncherService = protoDescriptor.launcher.Launcher;

    let target: string;
    if (address.startsWith('unix:')) {
      target = address;
    } else if (address.startsWith('/') || address.endsWith('.sock')) {
      target = `unix:${path.resolve(address)}`;
    } else {
      target = address;
    }

    this.client = new LauncherService(
      target,
      grpc.credentials.createInsecure()
    ) as unknown as GrpcLauncherInfoService;
  }

  async getLangInfo(): Promise<LauncherResult<LangInfo[]>> {
    return new Promise((resolve) => {
      const deadline = new Date(Date.now() + GET_LANG_INFO_DEADLINE_MS);
      this.client.getLangInfo({}, { deadline }, (err, response) => {
        if (err) {
          resolve({
            ok: false,
            error: { code: 'UNAVAILABLE', message: err.details || err.message },
          });
          return;
        }
        const languages: LangInfo[] = (response.languages || []).map(
          (l: any) => ({
            lang: l.lang,
            displayName: l.displayName,
            options: (l.options || []).map((o: any): LangOptionDef => ({
              key: o.key,
              type: o.type,
              values: o.values || [],
              defaultValue: o.defaultValue,
              displayName: o.displayName,
            })),
          })
        );
        resolve({ ok: true, value: languages });
      });
    });
  }

  async getLangVersion(
    lang: string
  ): Promise<LauncherResult<LangVersionResult>> {
    return new Promise((resolve) => {
      const deadline = new Date(Date.now() + GET_LANG_VERSION_DEADLINE_MS);
      this.client.getLangVersion({ lang }, { deadline }, (err, response) => {
        if (err) {
          resolve({
            ok: false,
            error: { code: 'UNAVAILABLE', message: err.details || err.message },
          });
          return;
        }
        resolve({
          ok: true,
          value: {
            version: response.version || '',
            error: response.error || '',
          },
        });
      });
    });
  }

  close(): void {
    this.client.close();
  }
}
