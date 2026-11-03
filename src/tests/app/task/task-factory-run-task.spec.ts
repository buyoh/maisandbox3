import { FakeLauncherClient } from '../../../app/launcher/fake-launcher-client';
import { TaskFactoryRunTask } from '../../../app/task/task-factory';
import { TaskRunTask } from '../../../app/task/task-run-task';
import { TaskResult } from '../../../interfaces/result-types';

describe('TaskFactoryRunTask', () => {
  let factory: TaskFactoryRunTask;
  let client: FakeLauncherClient;

  beforeEach(() => {
    factory = new TaskFactoryRunTask();
    client = new FakeLauncherClient();
  });

  const emitter = (_: TaskResult) => {};
  const finalize = () => {};

  test('returns TaskRunTask for any language', () => {
    for (const lang of ['ruby', 'cpp', 'clay', 'python', 'go']) {
      const task = factory.generate(client, emitter, finalize, {
        lang,
        info: { type: 'filestdin', code: '', stdin: '' },
      });
      expect(task).toBeInstanceOf(TaskRunTask);
    }
  });

  test('returns null for empty lang', () => {
    const task = factory.generate(client, emitter, finalize, {
      lang: '',
      info: { type: 'filestdin', code: '', stdin: '' },
    });
    expect(task).toBeNull();
  });

  test('passes options to TaskRunTask', () => {
    const task = factory.generate(client, emitter, finalize, {
      lang: 'cpp',
      info: { type: 'filestdin', code: '', stdin: '' },
      options: { std: 'c++17' },
    });
    expect(task).toBeInstanceOf(TaskRunTask);
    // options is stored internally - verify via startAsync behavior in integration tests
    expect((task as any).options).toEqual({ std: 'c++17' });
  });
});
