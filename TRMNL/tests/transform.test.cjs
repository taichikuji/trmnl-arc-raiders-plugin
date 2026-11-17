const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../src/transform.js');

const realNow = Date.now;
after(() => { Date.now = realNow; });

test('shows event times in the user time zone, including the date across midnight', () => {
  Date.now = () => Date.parse('2026-11-17T22:30:00Z');
  const briefing = run({
    region: 'europe',
    trmnl: { user: { time_zone_iana: 'Europe/Madrid' } },
    data: [
      { name: 'Night Raid', map: 'Dam', startTime: Date.parse('2026-11-17T22:00:00Z'), endTime: Date.parse('2026-11-17T22:50:00Z') },
      { name: 'Cold Snap', map: 'Spaceport', startTime: Date.parse('2026-11-17T23:00:00Z'), endTime: Date.parse('2026-11-18T00:00:00Z') }
    ]
  }).briefing;
  assert.equal(briefing.live[0].time, '23:50');
  assert.equal(briefing.next[0].time, '18 NOV 00:00');
  assert.equal(briefing.next[0].when, '18 NOV 00:00–01:00');
  assert.equal(briefing.feature.time, '23:50');
  assert.equal(briefing.live[0].until_label, '20 MIN');
  assert.equal(briefing.next[0].until_label, '30 MIN');
});

test('empty data has a safe display state', () => {
  const briefing = run({ data: [] }).briefing;
  assert.equal(briefing.status, 'NO DATA');
  assert.equal(briefing.has_feature, false);
  assert.deepEqual(briefing.live, []);
});

test('rounds the remaining time up and formats hour boundaries', () => {
  Date.now = () => Date.parse('2026-11-17T12:00:00Z');
  const event = (name, start, end) => ({ name, map: 'Dam', startTime: Date.now() + start, endTime: Date.now() + end });
  const b = run({ data: [
    event('Night Raid', -60000, 1000),
    event('Cold Snap', 60 * 60000, 61 * 60000),
    event('Hurricane', 60 * 60000 + 1, 62 * 60000)
  ] }).briefing;
  assert.equal(b.feature.until_label, '1 MIN');
  assert.equal(b.next[0].until_label, '1H');
  assert.equal(b.next[1].until_label, '1H 1M');
});

test('moves conditions between upcoming and active at their exact boundaries', () => {
  Date.now = () => Date.parse('2026-11-17T12:00:00Z');
  const now = Date.now();
  const b = run({ data: [
    { name: 'Night Raid', map: 'Dam', startTime: now - 3600000, endTime: now },
    { name: 'Cold Snap', map: 'Spaceport', startTime: now, endTime: now + 3600000 },
    { name: 'Hurricane', map: 'Dam', startTime: now + 1, endTime: now + 3600001 }
  ] }).briefing;
  assert.deepEqual(b.live.map(e => e.name), ['COLD SNAP']);
  assert.deepEqual(b.next.map(e => e.name), ['HURRICANE']);
  assert.equal(b.live[0].until_label, '1H');
  assert.equal(b.next[0].until_label, '1 MIN');
});
