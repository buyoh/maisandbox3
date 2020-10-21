import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import renderer from 'react-test-renderer';
import { act, Simulate } from 'react-dom/test-utils';

import StatusBar, { Item } from '../../../web/components/StatusBar';

test('aaa', () => {
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
