import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// /tickers is a standalone, auth free market watch page. Both roots are
// lazy so the finance app (including the Supabase client and the login
// gate) is never even downloaded on /tickers, and the tickers code never
// loads in the main app. This is the entire router: two branches on
// pathname, no client side navigation between them.
const isTickers = window.location.pathname.replace(/\/+$/, '') === '/tickers';

const Root = React.lazy(() => (isTickers ? import('./tickers/TickersPage') : import('./App')));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={null}>
      <Root />
    </React.Suspense>
  </React.StrictMode>
);
