// Run with: npm test (node's built-in runner, no dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFeed } from '../api/_lib/olindaFeed.ts';

const holding = {
  ticker: 'ABCD',
  shares: 12,
  cost_basis: 1200,
  market_value: 1320,
  gain_usd: 120,
  gain_pct: 10,
  stop_price: 77,
  stop_type: 'trail',
  stop_pct: 30,
  thesis_grade: 'on_track',
};

const body = (over: Record<string, unknown> = {}) => ({
  as_of: '2026-11-04T21:05:00.000Z',
  paper: true,
  pot_value: 100234.57,
  return_since_start_pct: 0.23,
  olinda_minus_spy_pts: -0.77,
  holdings: [holding],
  sweep: { ticker: 'IWO', shares: 201.5 },
  cash_usd: 1234,
  ...over,
});

test('passes exactly the whitelisted keys at every level, extras dropped', () => {
  const feed = pickFeed(body({ secret: 'x', sweep: { ticker: 'IWO', shares: 201.5, market_value: 70000 }, holdings: [{ ...holding, entry_reason: 'thesis' }] }));
  assert.ok(feed);
  assert.deepEqual(Object.keys(feed).sort(), ['as_of', 'cash_usd', 'holdings', 'olinda_minus_spy_pts', 'paper', 'pot_value', 'return_since_start_pct', 'sweep']);
  assert.deepEqual(Object.keys(feed.sweep!).sort(), ['shares', 'ticker']);
  assert.deepEqual(Object.keys(feed.holdings[0]).sort(), Object.keys(holding).sort());
  assert.deepEqual(feed.sweep, { ticker: 'IWO', shares: 201.5 });
  assert.equal(feed.cash_usd, 1234);
});

test('a missing or malformed sweep becomes null, the rest still passes', () => {
  for (const sweep of [undefined, null, 'IWO', {}, { ticker: 'IWO' }, { ticker: 'IWO', shares: '200' }, { ticker: 'IWO', shares: -1 }, { ticker: 'iwo<script>', shares: 1 }, { ticker: 'IWO', shares: Number.POSITIVE_INFINITY }]) {
    const feed = pickFeed(body({ sweep }));
    assert.ok(feed);
    assert.equal(feed.sweep, null, JSON.stringify(sweep));
    assert.equal(feed.holdings.length, 1);
  }
  assert.deepEqual(pickFeed(body({ sweep: { ticker: 'IWO', shares: 0 } }))!.sweep, { ticker: 'IWO', shares: 0 });
});

test('cash_usd must be a finite number', () => {
  assert.equal(pickFeed(body({ cash_usd: '1234' }))!.cash_usd, null);
  assert.equal(pickFeed(body({ cash_usd: undefined }))!.cash_usd, null);
  assert.equal(pickFeed(body({ cash_usd: Number.NaN }))!.cash_usd, null);
});

test('an older Olinda without the new fields still parses', () => {
  const { sweep, cash_usd, ...old } = body();
  const feed = pickFeed(old);
  assert.ok(feed);
  assert.equal(feed.sweep, null);
  assert.equal(feed.cash_usd, null);
});

test('non-paper bodies are refused', () => {
  assert.equal(pickFeed(body({ paper: false })), null);
  assert.equal(pickFeed(null), null);
});
