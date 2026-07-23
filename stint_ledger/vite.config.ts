import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fetchTickers, parseSymbols, parseRange } from './api/_lib/yahoo';
import {
  parseInvestigateBody,
  runInvestigation,
  extractErrorMessage,
} from './api/_lib/investigate';

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

// Dev stand-in for api/investigate.ts. Needs ANTHROPIC_API_KEY in .env
// (gitignored); production reads it from the Vercel env instead. No rate
// limiting in dev.
function investigateDevApi(apiKey: string | undefined): Plugin {
  return {
    name: 'investigate-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/investigate', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'POST only' }));
          return;
        }
        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Add ANTHROPIC_API_KEY to .env for local dev' }));
          return;
        }
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
        });
        req.on('end', () => {
          let body: unknown = null;
          try {
            body = JSON.parse(raw);
          } catch {
            // falls through to the 400 below
          }
          const tickers = parseInvestigateBody(body);
          if (!tickers) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'body must be { tickers: [...] } with 1-4 entries' }));
            return;
          }
          runInvestigation(tickers, apiKey)
            .then((analysis) => {
              res.statusCode = 200;
              res.end(JSON.stringify({ analysis }));
            })
            .catch((e) => {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: extractErrorMessage(e) }));
            });
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Empty prefix so non-VITE_ vars (ANTHROPIC_API_KEY) come through from
  // .env; they are only used here in node, never exposed to the client.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tickersDevApi(),
      investigateDevApi(env.ANTHROPIC_API_KEY),
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
  };
});
