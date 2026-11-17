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
  assert.equal(briefing.feature.time, '23:50');
});

test('empty data has a safe display state', () => {
  const briefing = run({ data: [] }).briefing;
  assert.equal(briefing.status, 'NO DATA');
  assert.equal(briefing.has_feature, false);
  assert.deepEqual(briefing.live, []);
});
