import { parseTaskResult } from '../../../web/services/parse-task-result';
import { TaskResult } from '../../../interfaces/result-types';

describe('parseTaskResult', () => {
  it('extracts stdout from "out" detail', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result',
      continue: true,
      details: [{ type: 'out', text: 'hello\n' }],
    };
    const result = parseTaskResult(data);
    expect(result.stdout).toBe('hello\n');
  });

  it('extracts errLog from "log" detail and creates text detail', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result',
      continue: true,
      details: [{ type: 'log', text: 'error msg' }],
    };
    const result = parseTaskResult(data);
    expect(result.errLog).toBe('error msg');
    expect(result.details).toEqual([
      { type: 'text', title: 'stderr', text: 'error msg' },
    ]);
  });

  it('extracts status from "status" detail', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result',
      continue: true,
      details: [{ type: 'status', status: 'success' }],
    };
    const result = parseTaskResult(data);
    expect(result.status).toBe('success');
  });

  it('passes through "text" and "param" details', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result',
      continue: true,
      details: [
        { type: 'text', title: 'info', text: 'some text' },
        { type: 'param', key: 'time', value: 0.5 },
      ],
    };
    const result = parseTaskResult(data);
    expect(result.details).toEqual([
      { type: 'text', title: 'info', text: 'some text' },
      { type: 'param', key: 'time', value: 0.5 },
    ]);
  });

  it('collects annotations', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result',
      continue: true,
      details: [
        {
          type: 'annotation',
          annotations: [{ row: 1, column: 0, type: 'error', text: 'err' }],
        },
      ],
    };
    const result = parseTaskResult(data);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].text).toBe('err');
  });

  it('uses gray status when not running', () => {
    const data: TaskResult = {
      success: true,
      summary: 'done',
      running: false,
      continue: false,
    };
    const result = parseTaskResult(data);
    expect(result.status).toBe('gray');
  });

  it('uses light status when running', () => {
    const data: TaskResult = {
      success: true,
      summary: 'exec...',
      running: true,
      continue: true,
    };
    const result = parseTaskResult(data);
    expect(result.status).toBe('light');
  });

  it('returns continues=false when data.continue is not true', () => {
    const data: TaskResult = {
      success: true,
      summary: 'finalize',
      continue: false,
    };
    const result = parseTaskResult(data);
    expect(result.continues).toBe(false);
  });

  it('returns null details when data has no details', () => {
    const data: TaskResult = {
      success: true,
      summary: 'setup',
      continue: true,
    };
    const result = parseTaskResult(data);
    expect(result.details).toBeNull();
    expect(result.stdout).toBeNull();
  });

  it('returns empty summary when data.summary is missing', () => {
    const data: TaskResult = {
      success: true,
      summary: '',
      continue: true,
    };
    const result = parseTaskResult(data);
    expect(result.summary).toBe('');
  });

  it('handles multiple detail types in one response', () => {
    const data: TaskResult = {
      success: true,
      summary: 'result(exec)',
      continue: true,
      details: [
        { type: 'status', status: 'success' },
        { type: 'param', key: 'time', value: 0.05 },
        { type: 'param', key: 'exitstatus', value: 0 },
        { type: 'out', text: 'hello world\n' },
        { type: 'log', text: 'debug info\n' },
        {
          type: 'annotation',
          annotations: [{ row: 3, type: 'warning', text: 'unused var' }],
        },
      ],
    };
    const result = parseTaskResult(data);
    expect(result.stdout).toBe('hello world\n');
    expect(result.errLog).toBe('debug info\n');
    expect(result.status).toBe('success');
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].text).toBe('unused var');
    // details should contain param + text(from log) items, but NOT out/status/annotation
    expect(result.details).toHaveLength(3); // 2 params + stderr-text
    expect(result.details![0]).toEqual({
      type: 'param',
      key: 'time',
      value: 0.05,
    });
    expect(result.details![1]).toEqual({
      type: 'param',
      key: 'exitstatus',
      value: 0,
    });
    expect(result.details![2]).toEqual({
      type: 'text',
      title: 'stderr',
      text: 'debug info\n',
    });
  });
});
