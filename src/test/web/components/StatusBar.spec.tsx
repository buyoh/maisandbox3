import React from 'react';
import renderer from 'react-test-renderer';

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

  const component = renderer.create(
    <StatusBar values={values} active={'key-0'} />
  );
  let tree = component.toJSON();
  expect(tree).toMatchSnapshot();
  component.update(<StatusBar values={values} active={'key-1'} />);
  tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});
