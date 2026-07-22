import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fetchTickers, parseSymbols, parseRange } from './api/_lib/yahoo';

// Dev stand-in for the Vercel function in api/tickers.ts. A plain
// server.proxy entry cannot fan one /api/tickers request out to several
// Yahoo requests, so this middleware reuses the same shared fetch logic
// and returns the same response shape as production. No caching in dev.
function tickersDevApi(): Plugin {
  return {
    name: 'tickers-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/tickers', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const symbols = parseSymbols(url.searchParams.get('symbols'));
        res.setHeader('Content-Type', 'application/json');
        if (symbols.length === 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'symbols query param required, comma separated' }));
          return;
        }
        fetchTickers(symbols, parseRange(url.searchParams.get('range')))
          .then((tickers) => {
            res.statusCode = 200;
            res.end(JSON.stringify({ tickers }));
          })
          .catch((e) => {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tickersDevApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Stint Ledger',
        short_name: 'Stint Ledger',
        description: 'Personal financial dashboard for freelance Creative Director',
        theme_color: '#0a0c10',
        background_color: '#0a0c10',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/xxsjfeafpzzcmadyvuue\.supabase\.co/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
});
