import type {
  Annotation,
  ReportItem,
  TaskResult,
} from '../../interfaces/result-types';

/** parseTaskResult の出力 */
export interface ParsedTaskResult {
  /** stdout に設定する文字列。detail に 'out' が含まれない場合は null */
  stdout: string | null;
  /** errlog テキスト */
  errLog: string;
  /** 結果のステータス色 */
  status: string;
  /** 表示用 detail 項目（text, param）。detail がない場合は null */
  details: ReportItem[] | null;
  /** 追加すべきアノテーション */
  annotations: Annotation[];
  /** 結果バーに表示するサマリ。空文字列なら結果追加不要 */
  summary: string;
  /** タスクが継続中か（false = taskHandle を無効化すべき） */
  continues: boolean;
  /** フェーズ名（TaskResult.phase から引き継ぐ）。未指定の場合は undefined */
  phase?: string;
}

/**
 * TaskResult を解析し、各 atom への書き込みに必要なデータに分解する純粋関数。
 * 副作用を持たない。
 */
export function parseTaskResult(data: TaskResult): ParsedTaskResult {
  let stdout: string | null = null;
  let errLog = '';
  let status = data.running ? 'light' : 'gray';
  let details: ReportItem[] | null = null;
  const annotations: Annotation[] = [];
  const continues = data.continue === true;

  if (data.details) {
    details = [];
    for (const item of data.details) {
      switch (item.type) {
        case 'out':
          stdout = item.text;
          break;
        case 'log':
          details.push({
            type: 'text',
            title: 'stderr',
            text: item.text,
          });
          errLog = item.text;
          break;
        case 'status':
          status = item.status;
          break;
        case 'text':
          details.push(item);
          break;
        case 'param':
          details.push(item);
          break;
        case 'annotation':
          annotations.push(...item.annotations);
          break;
        default: {
          const _exhaustive: never = item;
          console.error(
            'unknown detail type',
            (_exhaustive as { type: string }).type
          );
          break;
        }
      }
    }
  }

  return {
    stdout,
    errLog,
    status,
    details,
    annotations,
    summary: data.summary,
    continues,
    phase: data.phase,
  };
}
