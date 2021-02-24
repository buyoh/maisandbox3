import { Result, SubResultExec } from '../../lib/type';

export function annotateSummaryDefault(result: Result, label: string): string {
  return result.success ? `${label}: ok` : `${label} : error`;
}

export function annotateSummaryExec(result: Result, label: string): string {
  if (!result.result || !result.result.exited) return `${label}: running`;

  const res = result.result as SubResultExec;
  if (result.success)
    return `${label}: ok(${res.exitstatus})[${
      Math.floor(res.time * 1000) / 1000
    }s]`;
  return annotateSummaryDefault(result, label);
}
