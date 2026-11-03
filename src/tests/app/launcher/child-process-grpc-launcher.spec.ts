import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  resolveLauncherCommand,
  resolveLauncherBinary,
  LauncherCommand,
} from '../../../app/launcher/child-process-grpc-launcher';
import Config from '../../../app/config';

// Config を直接書き換えてテスト（mock ライブラリ不使用）
const originalConfig = { ...Config };

function restoreConfig() {
  Object.assign(Config, originalConfig);
}

describe('resolveLauncherCommand', () => {
  afterEach(() => {
    restoreConfig();
    delete (Config as any).launcherGrpcBinary;
  });

  describe('go run モード (launcherGrpcGorun=true)', () => {
    beforeEach(() => {
      (Config as any).launcherGrpcGorun = true;
      (Config as any).production = false;
    });

    test('go run コマンドを返す', () => {
      const result = resolveLauncherCommand();
      expect(result.command).toBe('go');
      expect(result.args).toEqual(['run', './cmd/launcher']);
      expect(result.cwd).toBe(
        path.resolve(Config.appRootDirectory, Config.launcherGrpcDir)
      );
    });

    test('cwd ディレクトリが存在しない場合エラー', () => {
      (Config as any).appRootDirectory = '/nonexistent/path';
      expect(() => resolveLauncherCommand()).toThrow(
        /go run mode requires launcher directory/
      );
    });

    test('production 環境で警告を出力する', () => {
      (Config as any).production = true;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      resolveLauncherCommand();
      expect(warnSpy).toHaveBeenCalledWith(
        'WARNING: LAUNCHER_GRPC_GORUN=true in production environment'
      );
      warnSpy.mockRestore();
    });

    test('launcherGrpcBinary が設定されていても go run が優先される', () => {
      (Config as any).launcherGrpcBinary = '/usr/local/bin/launcher';
      const result = resolveLauncherCommand();
      expect(result.command).toBe('go');
      expect(result.args).toEqual(['run', './cmd/launcher']);
    });

    test('launcherGrpcDir でカスタムディレクトリを指定できる', () => {
      // src/ ディレクトリは確実に存在する
      (Config as any).launcherGrpcDir = 'src';
      const result = resolveLauncherCommand();
      expect(result.command).toBe('go');
      expect(result.cwd).toBe(path.resolve(Config.appRootDirectory, 'src'));
    });
  });

  describe('バイナリモード (launcherGrpcGorun=false)', () => {
    beforeEach(() => {
      (Config as any).launcherGrpcGorun = false;
      // ファイルシステム状態に依存しないよう、デフォルトバイナリパスが存在しないディレクトリを設定
      (Config as any).appRootDirectory = '/nonexistent/path';
    });

    test('launcherGrpcBinary が設定されている場合そのパスを返す', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launcher-binary-'));
      const tempBinary = path.join(tempDir, 'launcher');
      fs.writeFileSync(tempBinary, '');

      (Config as any).launcherGrpcBinary = tempBinary;
      const result = resolveLauncherCommand();
      expect(result.command).toBe(tempBinary);
      expect(result.args).toEqual([]);
      expect(result.cwd).toBeUndefined();
    });

    test('launcherGrpcBinary が存在しない場合エラー', () => {
      (Config as any).launcherGrpcBinary = '/path/does/not/exist';
      expect(() => resolveLauncherCommand()).toThrow(
        /Configured gRPC launcher binary not found/
      );
    });

    test('バイナリが見つからない場合エラー', () => {
      delete (Config as any).launcherGrpcBinary;
      expect(() => resolveLauncherCommand()).toThrow(
        /gRPC launcher binary not found/
      );
    });
  });
});
