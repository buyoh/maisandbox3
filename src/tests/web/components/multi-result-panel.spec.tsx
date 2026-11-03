import React from 'react';
import { render } from '@testing-library/react';
import MultiResultPanel from '../../../web/components/MultiResultPanel';
import {
  BuildPhaseResult,
  MultiRunResult,
} from '../../../interfaces/multi-stdio-types';

describe('MultiResultPanel', () => {
  it('結果がない場合 "No results yet" を表示する', () => {
    const { getByText } = render(
      <MultiResultPanel buildResult={null} runResults={[]} />
    );
    expect(getByText('No results yet')).toBeTruthy();
  });

  it('ビルド成功時に ✓ を表示する', () => {
    const build: BuildPhaseResult = {
      phase: 'build',
      exitStatus: 0,
      timeMs: 50,
      stdout: '',
      stderr: '',
    };
    const { container } = render(
      <MultiResultPanel buildResult={build} runResults={[]} />
    );
    expect(container.textContent).toContain('✓');
    expect(container.textContent).toContain('50');
  });

  it('ビルド失敗時に ✗ と stderr を表示する', () => {
    const build: BuildPhaseResult = {
      phase: 'build',
      exitStatus: 1,
      timeMs: 30,
      stdout: '',
      stderr: 'compile error',
    };
    const { container } = render(
      <MultiResultPanel buildResult={build} runResults={[]} />
    );
    expect(container.textContent).toContain('✗');
    expect(container.textContent).toContain('compile error');
  });

  it('各 stdin の実行結果を表示する', () => {
    const build: BuildPhaseResult = {
      phase: 'build',
      exitStatus: 0,
      timeMs: 50,
      stdout: '',
      stderr: '',
    };
    const runs: MultiRunResult[] = [
      {
        stdinIndex: 0,
        exitStatus: 0,
        timeMs: 10,
        stdout: 'output0',
        stderr: '',
      },
      {
        stdinIndex: 1,
        exitStatus: 1,
        timeMs: 20,
        stdout: '',
        stderr: 'runtime error',
      },
    ];
    const { container } = render(
      <MultiResultPanel buildResult={build} runResults={runs} />
    );
    expect(container.textContent).toContain('#1');
    expect(container.textContent).toContain('output0');
    expect(container.textContent).toContain('#2');
    expect(container.textContent).toContain('runtime error');
  });
});
