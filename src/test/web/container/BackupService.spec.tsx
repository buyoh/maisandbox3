import React from 'react';
import renderer from 'react-test-renderer';

import { BackupService } from '../../../web/containers/BackupService';

test('BackupService', () => {
  const updateLang = jest.fn();
  const updateCode = jest.fn();

  let component: renderer.ReactTestRenderer;

  // note: localstorageは空なので、updateCode等は呼ばれないかもしれない
  renderer.act(() => {
    component = renderer.create(
      <BackupService
        lang={'ruby'}
        code={'puts gets'}
        updateCode={() => 0}
        updateLang={() => 0}
      />
    );
  });
  // unmount時にlocalstorageへ保存される
  renderer.act(() => {
    component.unmount();
  });
  // note: localstorageから引き出されて、updateCode等が呼ばれる
  renderer.act(() => {
    renderer.create(
      <BackupService
        lang={''}
        code={''}
        updateCode={updateCode}
        updateLang={updateLang}
      />
    );
  });
  expect(updateLang.mock.calls.length).toEqual(1);
  expect(updateCode.mock.calls.length).toEqual(1);
  expect(updateLang.mock.calls[0]).toContain('ruby');
  expect(updateCode.mock.calls[0]).toContain('puts gets');
});
