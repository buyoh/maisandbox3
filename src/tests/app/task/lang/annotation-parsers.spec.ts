import {
  rubyAnnotationParser,
  cppAnnotationParser,
  clayAnnotationParser,
} from '../../../../app/task/lang/annotation-parsers';

describe('rubyAnnotationParser', () => {
  it('code.rb:N: から row を抽出する', () => {
    const result = rubyAnnotationParser('code.rb:3: syntax error\n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ row: 2, column: 0, type: 'error' });
  });

  it('./code.rb:N: 形式もマッチする', () => {
    const result = rubyAnnotationParser('./code.rb:5: undefined method\n');
    expect(result).toHaveLength(1);
    expect(result[0].row).toBe(4);
  });

  it('空文字列は空配列を返す', () => {
    expect(rubyAnnotationParser('')).toEqual([]);
  });

  it('マッチしない行は無視する', () => {
    expect(rubyAnnotationParser('from code.rb:3:in method\n')).toEqual([]);
  });
});

describe('cppAnnotationParser', () => {
  it('code.cpp:N:M: type: から annotation を抽出する', () => {
    const result = cppAnnotationParser('code.cpp:10:5: error: expected semicolon\n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ row: 9, column: 4, type: 'error' });
  });

  it('warning も type に格納する', () => {
    const result = cppAnnotationParser('code.cpp:2:1: warning: unused variable\n');
    expect(result[0].type).toBe('warning');
  });

  it('./code.cpp:N:M: 形式もマッチする', () => {
    const result = cppAnnotationParser('./code.cpp:1:1: error: msg\n');
    expect(result).toHaveLength(1);
  });

  it('空文字列は空配列を返す', () => {
    expect(cppAnnotationParser('')).toEqual([]);
  });

  it('複数行にまたがるエラーをすべて抽出する', () => {
    const stderr =
      'code.cpp:3:2: error: error A\ncode.cpp:7:10: warning: warning B\n';
    const result = cppAnnotationParser(stderr);
    expect(result).toHaveLength(2);
  });
});

describe('clayAnnotationParser', () => {
  it('<stdin>:N:M: error: から annotation を抽出する', () => {
    const result = clayAnnotationParser('<stdin>:5:3: error: unexpected token\n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ row: 4, column: 2, type: 'error' });
  });

  it('<stdin>:N:M: warning: から type warning を抽出する', () => {
    const result = clayAnnotationParser('<stdin>:2:1: warning: implicit cast\n');
    expect(result[0].type).toBe('warning');
  });

  it('text フィールドに元の行が格納される', () => {
    const line = '<stdin>:1:1: error: msg';
    const result = clayAnnotationParser(line + '\n');
    expect(result[0].text).toBe(line);
  });

  it('空文字列は空配列を返す', () => {
    expect(clayAnnotationParser('')).toEqual([]);
  });

  // build フェーズアノテーション除外の確認
  it('out.cpp:N:M: 形式はマッチしない（build フェーズ除外）', () => {
    expect(clayAnnotationParser('out.cpp:3:5: error: build error\n')).toEqual([]);
  });

  // cppAnnotationParser との形式差異確認
  it('code.cpp:N:M: 形式はマッチしない', () => {
    expect(clayAnnotationParser('code.cpp:3:5: error: msg\n')).toEqual([]);
  });

  it('複数行のエラーをすべて抽出する', () => {
    const stderr =
      '<stdin>:1:1: error: error A\n' +
      'out.cpp:2:3: error: build error (excluded)\n' +
      '<stdin>:4:2: warning: warning B\n';
    const result = clayAnnotationParser(stderr);
    expect(result).toHaveLength(2);
    expect(result[0].row).toBe(0);
    expect(result[1].row).toBe(3);
  });
});
