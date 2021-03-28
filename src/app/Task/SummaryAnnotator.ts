import { LauncherResult, LauncherSubResultOfExec } from '../Launcher/types';

export function annotateSummaryDefault(
  result: LauncherResult,
  label: string
): string {
  return result.success ? `${label}: ok` : `${label} : error`;
}

export function annotateSummaryExec(
  result: LauncherResult,
  label: string
): string {
  if (!result.result || !(result.result as any).exited)
    return `${label}: running`;

  const res = result.result as LauncherSubResultOfExec;
  if (result.success)
    return `${label}: ok(${res.exitstatus})[${res.time === undefined ? 'TLE' : Math.floor(res.time * 1000) / 1000
      }s]`;
  return annotateSummaryDefault(result, label);
}
