import React from 'react';
// import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { BackupService } from '../../../web/containers/BackupService';

test('BackupService', () => {
  // note: localstorageは空なので、updateCode等は呼ばれないかもしれない
  const { unmount } = render(
    <BackupService
      lang={'ruby'}
      code={'puts gets'}
      updateCode={() => 0}
      updateLang={() => 0}
    />
  );

  // unmount時にlocalstorageへ保存される
  unmount();

  // note: localstorageから引き出されて、updateCode等が呼ばれる
  const updateCode = jest.fn();
  const updateLang = jest.fn();
  render(
    <BackupService
      lang={'ruby'}
      code={'puts gets'}
      updateCode={updateCode}
      updateLang={updateLang}
    />
  );
  expect(updateLang.mock.calls.length).toEqual(1);
  expect(updateCode.mock.calls.length).toEqual(1);
  expect(updateLang.mock.calls[0]).toContain('ruby');
  expect(updateCode.mock.calls[0]).toContain('puts gets');
});
