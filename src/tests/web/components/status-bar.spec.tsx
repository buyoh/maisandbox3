import React from 'react';
// import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import StatusBar, { Item } from '../../../web/components/StatusBar';

test('StatusBar', () => {
  const values: Item[] = [
    {
      color: 'gray',
      text: 'zero',
      key: 'key-0',
    },
    {
      color: 'success',
      text: 'one',
      key: 'key-1',
    },
  ];

  {
    const { asFragment } = render(
      <StatusBar values={values} active={'key-0'} />
    );
    const rendered = asFragment();
    expect(rendered).toMatchSnapshot();
  }
  {
    const { asFragment } = render(
      <StatusBar values={values} active={'key-1'} />
    );
    const rendered = asFragment();
    expect(rendered).toMatchSnapshot();
  }
});
