import React from 'react';
import type {
  BuildPhaseResult,
  MultiRunResult,
} from '../../interfaces/multi-stdio-types';

export interface MultiResultPanelProps {
  buildResult: BuildPhaseResult | null;
  runResults: MultiRunResult[];
}

/** 結果一覧パネル。ビルド結果と各 stdin の実行結果を表示する。 */
export default function MultiResultPanel({
  buildResult,
  runResults,
}: MultiResultPanelProps): JSX.Element {
  if (!buildResult && runResults.length === 0) {
    return <div style={{ color: '#888', padding: '8px' }}>No results yet</div>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '4px',
      }}
    >
      {buildResult && (
        <div style={{ borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
          <span>
            Build: {buildResult.exitStatus === 0 ? '✓' : '✗'}{' '}
            {buildResult.timeMs.toFixed(2)}ms
          </span>
          {buildResult.stderr && (
            <pre
              style={{
                color: 'red',
                fontSize: '0.85em',
                margin: '2px 0',
                whiteSpace: 'pre-wrap',
              }}
            >
              {buildResult.stderr}
            </pre>
          )}
        </div>
      )}
      {runResults.map((result) => (
        <div key={result.stdinIndex} style={{ fontSize: '0.9em' }}>
          <span>
            #{result.stdinIndex + 1}: {result.exitStatus === 0 ? '✓' : '✗'}{' '}
            {result.timeMs.toFixed(2)}ms
          </span>
          {result.stdout && (
            <pre
              style={{
                margin: '2px 0 2px 16px',
                whiteSpace: 'pre-wrap',
                fontSize: '0.85em',
              }}
            >
              {result.stdout}
            </pre>
          )}
          {result.stderr && (
            <pre
              style={{
                margin: '2px 0 2px 16px',
                whiteSpace: 'pre-wrap',
                color: 'red',
                fontSize: '0.85em',
              }}
            >
              {result.stderr}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
