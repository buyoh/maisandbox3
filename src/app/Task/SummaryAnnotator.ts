import {
  LauncherResult,
  LauncherSubResultOfExec,
} from '../Launcher/LauncherType';

export function annotateSummaryDefault(
  result: LauncherResult,
  label: string
): string {
  if (!result.success) return `${label}[error]`;
  const running =
    result.result &&
    (result.result as LauncherSubResultOfExec).exited === false;
  return running ? `${label}...` : `${label}`;
}
