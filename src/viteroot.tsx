import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'jotai';

import './web/styles/default.scss';
import Index from './web/pages/index';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider>
      <Index />
    </Provider>
  </React.StrictMode>
);
