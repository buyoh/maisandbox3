import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { rootStore } from './web/stores';

// insert global css here
// ref: https://github.com/zeit/next.js/blob/master/errors/css-global.md
import '../web/components/style/default.scss';
import Index from './pages/index';

export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <Provider store={rootStore}>
      <Component {...pageProps} />
    </Provider>
  );
}
App.displayName = 'App';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={rootStore}>
      <Index />
    </Provider>
  </React.StrictMode>
);
