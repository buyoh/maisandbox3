import React from 'react';
import { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { rootStore } from '../web/stores';

// insert global css here
// ref: https://github.com/zeit/next.js/blob/master/errors/css-global.md
import '../web/components/style/default.scss';

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <Provider store={rootStore}>
      <Component {...pageProps} />
    </Provider>
  );
}
App.displayName = 'App';
