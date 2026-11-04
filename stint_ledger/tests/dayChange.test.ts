// Run with: npm test (node's built-in runner, no dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTotal, needsDaily, nyDate, sessionLabel, sessionMove } from '../src/tickers/dayChange.ts';

// Instants in New York (November 2026 is EST, UTC-5).
const at = (iso: string) => Date.parse(iso);
const sec = (iso: string) => at(iso) / 1000;
const WED_CLOSE = sec('2026-11-04T16:00:00-05:00');
const WED_OPEN = sec('2026-11-04T09:30:00-05:00');
const THU_OPEN = sec('2026-11-05T09:30:00-05:00');
const FRI_CLOSE = sec('2026-11-06T16:00:00-05:00');
const MON_OPEN = sec('2026-11-09T09:30:00-05:00');

const row = (symbol: string, price: number, prevClose: number, asOf: number, sessionStart: number, closes?: number[]) => ({
  symbol,
  ok: true,
  price,
  prevClose,
  asOf,
  sessionStart,
  closes,
});

test('nyDate uses the New York calendar day', () => {
  assert.equal(nyDate(at('2026-11-05T03:30:00Z')), '2026-11-04'); // 10:30pm Wed in New York
  assert.equal(nyDate(at('2026-11-05T05:30:00Z')), '2026-11-05');
});

test('during or after the session the 1D quote is used as is', () => {
  const r = row('ABCD', 110, 100, WED_CLOSE, WED_OPEN);
  assert.equal(needsDaily(r), false);
  assert.deepEqual(sessionMove(r), { perShare: 10, prevClose: 100, date: '2026-11-04' });
});

test('before the open the 1D quote reads $0, so the last two daily closes are used', () => {
  // Thu 7am: Yahoo's 1D chart covers Thursday, previous close = Wednesday's close = price.
  const r = row('ABCD', 110, 110, WED_CLOSE, THU_OPEN);
  assert.equal(needsDaily(r), true);
  assert.equal(sessionMove(r), null, 'no daily closes yet: no figure rather than $0');
  const daily = { symbol: 'ABCD', ok: true, closes: [95, 100, 110] };
  assert.deepEqual(sessionMove(r, daily), { perShare: 10, prevClose: 100, date: '2026-11-04' });
});

test('a daily bar already started for the coming day is skipped', () => {
  const r = row('ABCD', 110, 110, WED_CLOSE, THU_OPEN);
  assert.deepEqual(sessionMove(r, { symbol: 'ABCD', ok: true, closes: [95, 100, 110, 111.5] }), { perShare: 10, prevClose: 100, date: '2026-11-04' });
});

test('daily closes that do not line up with the last price give no figure', () => {
  const r = row('ABCD', 110, 110, WED_CLOSE, THU_OPEN);
  assert.equal(sessionMove(r, { symbol: 'ABCD', ok: true, closes: [95, 100, 104, 106] }), null);
  assert.equal(sessionMove(r, { symbol: 'ABCD', ok: false }), null);
});

test('failed or incomplete quotes give no figure', () => {
  assert.equal(sessionMove(undefined), null);
  assert.equal(sessionMove({ symbol: 'X', ok: false }), null);
  assert.equal(sessionMove({ symbol: 'X', ok: true, price: 10, asOf: WED_CLOSE }), null);
});

test('labels: Today, the weekday within a week, else the date', () => {
  assert.equal(sessionLabel('2026-11-04', at('2026-11-04T16:30:00-05:00')), 'Today');
  assert.equal(sessionLabel('2026-11-04', at('2026-11-04T23:30:00-05:00')), 'Today'); // late evening, still Wednesday in New York
  assert.equal(sessionLabel('2026-11-04', at('2026-11-05T07:00:00-05:00')), 'Wed'); // before Thursday's open
  assert.equal(sessionLabel('2026-11-06', at('2026-11-07T12:00:00-05:00')), 'Fri'); // Saturday
  assert.equal(sessionLabel('2026-11-06', at('2026-11-08T20:00:00-05:00')), 'Fri'); // Sunday evening
  assert.equal(sessionLabel('2026-11-06', at('2026-11-09T08:00:00-05:00')), 'Fri'); // Monday before the open
  assert.equal(sessionLabel('2026-10-23', at('2026-11-04T12:00:00-05:00')), 'Oct 23');
});

test('weekend: Friday\'s move, labelled Fri, never $0', () => {
  // Saturday: Yahoo's 1D chart may already point at Monday's session.
  const r = row('IWO', 356.73, 356.73, FRI_CLOSE, MON_OPEN);
  const m = sessionMove(r, { symbol: 'IWO', ok: true, closes: [348.8, 352.27, 356.73] });
  assert.ok(m);
  assert.ok(Math.abs(m.perShare - 4.46) < 1e-9);
  assert.notEqual(m.perShare, 0);
  assert.equal(sessionLabel(m.date, at('2026-11-07T10:00:00-05:00')), 'Fri');
});

const feed = (over: Record<string, unknown> = {}) => ({
  holdings: [
    { ticker: 'ABCD', shares: 12, market_value: 1320 },
    { ticker: 'WXYZ', shares: 5, market_value: 190 },
  ],
  sweep: { ticker: 'IWO', shares: 200 },
  cash_usd: 1000,
  ...over,
}) as never;

const mv = (perShare: number, prevClose: number, date = '2026-11-04') => ({ perShare, prevClose, date });

test('day total: shares x move for every holding plus the sweep; cash does not move', () => {
  const t = dayTotal(feed(), { ABCD: mv(2, 108), WXYZ: mv(-1, 39), IWO: mv(4.46, 352.27) });
  assert.ok(t);
  // 12 x 2 + 5 x -1 + 200 x 4.46 = 24 - 5 + 892 = 911
  assert.ok(Math.abs(t.change - 911) < 1e-9);
  // pot at the previous close: 12 x 108 + 5 x 39 + 200 x 352.27 + 1000 cash = 1296 + 195 + 70454 + 1000 = 72945
  assert.ok(Math.abs(t.pctOfPot! - (911 / 72945) * 100) < 1e-9);
  assert.equal(t.date, '2026-11-04');
  assert.equal(t.missing, 0);
});

test('the sweep is most of the move: leaving it out would be wrong', () => {
  const t = dayTotal(feed({ holdings: [] }), { IWO: mv(-3, 350) });
  assert.ok(t);
  assert.equal(t.change, -600);
  assert.ok(Math.abs(t.pctOfPot! - (-600 / (70000 + 1000)) * 100) < 1e-9);
});

test('missing quotes count as missing, and an older session is not mixed in', () => {
  const t = dayTotal(feed(), { ABCD: mv(2, 108), WXYZ: mv(5, 35, '2026-11-03'), IWO: null });
  assert.ok(t);
  assert.equal(t.change, 24);
  assert.equal(t.missing, 2);
  assert.equal(t.pctOfPot, null, 'the sweep has no prior close, so the pot base is unknown');
});

test('no sweep in the feed: the total says so', () => {
  const t = dayTotal(feed({ sweep: null }), { ABCD: mv(2, 108), WXYZ: mv(-1, 39) });
  assert.ok(t);
  assert.equal(t.change, 19);
  assert.equal(t.missing, 1);
  assert.equal(t.pctOfPot, null);
});

test('an empty sweep (0 shares) is not missing', () => {
  const t = dayTotal(feed({ sweep: { ticker: 'IWO', shares: 0 } }), { ABCD: mv(2, 108), WXYZ: mv(-1, 39) });
  assert.ok(t);
  assert.equal(t.missing, 0);
  assert.ok(Math.abs(t.pctOfPot! - (19 / (1296 + 195 + 1000)) * 100) < 1e-9);
});

test('nothing priced: no total', () => {
  assert.equal(dayTotal(feed(), { ABCD: null, WXYZ: undefined, IWO: null }), null);
});
