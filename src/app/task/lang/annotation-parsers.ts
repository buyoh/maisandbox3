/**
 * 言語別の stderr → Annotation[] パーサ。
 * 個別RPCタスク（lang/）と RunTask 統一タスクの両方から使用される。
 */
import { Annotation } from '../../../interfaces/result-types';

/** 言語ごとの stderr → Annotation[] パーサ型 */
export type AnnotationParser = (stderr: string) => Annotation[];

/** Ruby の stderr からアノテーションを抽出する */
export function rubyAnnotationParser(stderr: string): Annotation[] {
  if (!stderr) return [];
  const annotations: Annotation[] = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^(?:\.\/)?code\.rb:(\d+):/);
    if (m) {
      annotations.push({
        text: line,
        row: +m[1] - 1,
        column: 0,
        type: 'error',
      });
    }
  }
  return annotations;
}

/** C++ の stderr からアノテーションを抽出する */
export function cppAnnotationParser(stderr: string): Annotation[] {
  if (!stderr) return [];
  const annotations: Annotation[] = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^(?:\.\/)?code\.cpp:(\d+):(\d+): (\w+):/);
    if (m) {
      annotations.push({
        text: line,
        row: +m[1] - 1,
        column: +m[2] - 1,
        type: m[3],
      });
    }
  }
  return annotations;
}

/**
 * CLay の stderr からアノテーションを抽出する。
 * clay は stdin からコードを読むため、エラーは `<stdin>:N:M:` 形式で出力される。
 * build フェーズの `out.cpp:N:M:` はマッチせず、自然に除外される。
 * 実装後に実際のエラー出力で形式を検証すること。
 */
export function clayAnnotationParser(stderr: string): Annotation[] {
  if (!stderr) return [];
  const annotations: Annotation[] = [];
  for (const line of stderr.split('\n')) {
    const m = line.match(/^<stdin>:(\d+):(\d+): (\w+):/);
    if (m) {
      annotations.push({
        text: line,
        row: +m[1] - 1,
        column: +m[2] - 1,
        type: m[3],
      });
    }
  }
  return annotations;
}

/** 言語 → AnnotationParser マッピング */
export const annotationParsers: Record<string, AnnotationParser> = {
  ruby: rubyAnnotationParser,
  cpp: cppAnnotationParser,
  clay: clayAnnotationParser,
};
