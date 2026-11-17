const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/transform.js');

const realNow = Date.now;
const now = Date.parse('2026-11-17T12:00:00Z');
beforeEach(() => { Date.now = () => now; });
after(() => { Date.now = realNow; });
const event = (name = 'Night Raid', map = 'Dam', start = now - 60000, end = now + 60000) =>
  ({ name, map, startTime: start, endTime: end });
const briefing = (data, extra = {}) => run({ data, ...extra }).briefing;
const madrid = { trmnl: { user: { time_zone_iana: 'Europe/Madrid' } } };

test('shows local times and dates across midnight', () => {
  Date.now = () => Date.parse('2026-11-17T22:30:00Z');
  const b = briefing([
    event('Night Raid', 'Dam', Date.parse('2026-11-17T22:00:00Z'), Date.parse('2026-11-17T22:50:00Z')),
    event('Cold Snap', 'Spaceport', Date.parse('2026-11-17T23:00:00Z'), Date.parse('2026-11-18T00:00:00Z'))
  ], madrid);
  assert.equal(b.live[0].time, '23:50');
  assert.equal(b.next[0].time, '18 Nov 00:00');
  assert.equal(b.next[0].when, '18 Nov 00:00–01:00');
});

test('empty and expired schedules differ from unavailable input', () => {
  assert.equal(briefing([]).status, 'No scheduled conditions');
  assert.equal(briefing([event('Night Raid', 'Dam', now - 7200000, now - 3600000)]).status, 'No scheduled conditions');
  for (const input of [undefined, null, {}, { error: 'backend down' }, { data: {} }, { data: [null] }]) {
    const b = run(input).briefing;
    assert.equal(b.status, 'Schedule unavailable');
    assert.deepEqual(b.live, []);
    assert.deepEqual(b.next, []);
  }
});

test('rounds remaining minutes up at hour boundaries', () => {
  const b = briefing([
    event('Night Raid', 'Dam', now - 60000, now + 1000),
    event('Cold Snap', 'Spaceport', now + 3600000, now + 3660000),
    event('Hurricane', 'Dam', now + 3600001, now + 3720000)
  ]);
  assert.equal(b.live[0].until_label, '1 min left');
  assert.equal(b.next[0].until_label, 'In 1h');
  assert.equal(b.next[1].until_label, 'In 1h 1m');
});

test('moves conditions at exact start and end boundaries and limits the next 24 hours', () => {
  const b = briefing([
    event('Night Raid', 'Dam', now - 3600000, now),
    event('Cold Snap', 'Spaceport', now, now + 3600000),
    event('Hurricane', 'Dam', now + 1, now + 3600001),
    event('Matriarch', 'Blue Gate', now + 86400000, now + 90000000),
    event('Hidden Bunker', 'Spaceport', now + 86400001, now + 90000001)
  ]);
  assert.deepEqual(b.live.map(e => e.name), ['Cold Snap']);
  assert.deepEqual(b.next.map(e => e.name), ['Hurricane', 'Matriarch']);
});

test('invalid timestamps and blank labels never crash or create display rows', () => {
  const invalid = [null, undefined, '', ' ', true, {}, [], NaN, Infinity, 1e20, 'invalid'];
  const rows = invalid.flatMap(value => [
    { ...event(), startTime: value }, { ...event(), endTime: value }
  ]);
  rows.push(event(' ', 'Dam'), event('Night Raid', ' '), event('Night Raid', 'Dam', now, now));
  const b = briefing(rows);
  assert.equal(b.status, 'Schedule unavailable');
  assert.deepEqual(b.live, []);
  assert.equal(briefing([...rows, event()]).live.length, 1);
  assert.equal(briefing([{ ...event(), startTime: String(now - 60000) }]).live.length, 1);
});

test('preserves API labels and deduplicates trimmed event names and map names', () => {
  const b = briefing([event(' Night Raid ', ' Dam '), event('Night Raid', 'Dam')]);
  assert.equal(b.live.length, 1);
  assert.equal(b.live[0].name, 'Night Raid');
  assert.equal(b.live[0].map, 'Dam');
  assert.equal(briefing([event('Cold Snap', 'Blue Gate')]).live[0].map, 'Blue Gate');
});

test('sorts active events by end time and keeps every active occurrence', () => {
  const b = briefing([
    event('Night Raid', 'Spaceport', now - 60000, now + 7200000),
    event('Night Raid', 'Dam'), event('Cold Snap', 'Blue Gate')
  ]);
  assert.deepEqual(b.live.map(e => [e.name, e.map]), [
    ['Cold Snap', 'Blue Gate'], ['Night Raid', 'Dam'], ['Night Raid', 'Spaceport']
  ]);
});

test('selects the earliest next occurrence per condition with stable map ties', () => {
  const rows = [
    event('Night Raid', 'Spaceport', now + 3600000, now + 7200000),
    event('Night Raid', 'Dam', now + 3600000, now + 7200000),
    event('Night Raid', 'Dam', now + 10800000, now + 14400000),
    event('Cold Snap', 'Dam', now + 7200000, now + 10800000)
  ];
  const b = briefing(rows);
  assert.deepEqual(b.next.map(e => [e.name, e.map]), [['Night Raid', 'Dam'], ['Cold Snap', 'Dam']]);
  assert.deepEqual(briefing(rows.reverse()).next, b.next);
});

test('marks stale source data independently of valid schedule contents', () => {
  assert.equal(briefing([event()], { cachedAt: now - 10800001 }).stale, true);
  assert.equal(briefing([], { cachedAt: now - 10800001 }).stale, true);
  for (const cachedAt of [undefined, null, '', 1e20, now, now - 10800000]) {
    assert.equal(briefing([event()], { cachedAt }).stale, false);
  }
});

test('dates both ends of an overnight window', () => {
  Date.now = () => Date.parse('2026-11-17T22:30:00Z');
  const b = briefing([event('Night Raid', 'Dam', Date.parse('2026-11-17T22:00:00Z'), Date.parse('2026-11-17T23:00:00Z'))], madrid);
  assert.equal(b.live[0].when, '17 Nov 23:00–18 Nov 00:00');
  assert.equal(b.live[0].time, '18 Nov 00:00');
});

test('uses the correct offsets across a daylight-saving change', () => {
  Date.now = () => Date.parse('2026-03-29T00:00:00Z');
  const b = briefing([event('Night Raid', 'Dam', Date.parse('2026-03-29T00:30:00Z'), Date.parse('2026-03-29T01:30:00Z'))], madrid);
  assert.equal(b.next[0].when, '01:30 CET–03:30 CEST');
});

test('falls back to UTC and preserves unknown text', () => {
  const b = briefing([event('<script>new condition</script>', 'Unknown map')], {
    region: 'north-america', trmnl: { user: { time_zone_iana: 'invalid' } }
  });
  assert.equal(b.live[0].time, '12:01');
  assert.equal(b.region, 'north-america');
  assert.equal(b.live[0].name, '<script>new condition</script>');
});


test('unknown labels cannot collide with object prototype properties', () => {
  const b = briefing([event('constructor', '__proto__')], { region: 'constructor' });
  assert.equal(b.region, 'constructor');
  assert.equal(b.live[0].map, '__proto__');
});

test('distinguishes the repeated hour when daylight saving ends', () => {
  Date.now = () => Date.parse('2026-10-25T00:15:00Z');
  const b = briefing([event('Night Raid', 'Dam', Date.parse('2026-10-25T00:00:00Z'), Date.parse('2026-10-25T01:00:00Z'))], madrid);
  assert.equal(b.live[0].when, '02:00 CEST–02:00 CET');
  assert.equal(b.live[0].time, '02:00 CET');
});
