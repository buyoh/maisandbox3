import React from 'react';
import { AppProps } from 'next/app';

// insert global css here
// ref: https://github.com/zeit/next.js/blob/master/errors/css-global.md
import '../components/style/default.scss';

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return <Component {...pageProps} />;
}
App.displayName = 'App';
