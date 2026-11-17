// MetaForge supplies millisecond timestamps; TRMNL handles the single HTTP request.
function run(input) {
  const now = Date.now();
  const raw = Array.isArray(input?.data) ? input.data : null;
  let zone = input?.trmnl?.user?.time_zone_iana || 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }); }
  catch (_) { zone = 'UTC'; }
  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone });
  const zonedClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone, timeZoneName: 'short' });
  const zoneName = epoch => zonedClock.formatToParts(epoch).find(part => part.type === 'timeZoneName').value;
  const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: zone });
  const day = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone });
  const displayTime = (epoch, formatter = clock) => (day.format(epoch) === day.format(now) ? '' : date.format(epoch) + ' ') + formatter.format(epoch);
  const region = input?.region || input?.trmnl?.plugin_settings?.custom_fields_values?.region || 'unknown';
  const timestamp = value => {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return NaN;
    const epoch = Number(value);
    return Number.isFinite(epoch) && Number.isFinite(new Date(epoch).getTime()) ? epoch : NaN;
  };
  const seen = new Set();
  const all = (raw || []).flatMap(item => {
    if (typeof item?.name !== 'string' || typeof item?.map !== 'string') return [];
    const label = item.name.trim();
    const map = item.map.trim();
    const start = timestamp(item.startTime);
    const end = timestamp(item.endTime);
    if (!label || !map || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const event = { name: label.slice(0, 70), map: map.slice(0, 60), start, end };
    const key = JSON.stringify([event.name.toLowerCase(), event.map.toLowerCase(), start, end]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [event];
  });
  const byName = (a, b) => a.name.localeCompare(b.name) || a.map.localeCompare(b.map);
  const active = all.filter(ev => ev.start <= now && now < ev.end).sort((a, b) => a.end - b.end || byName(a, b));
  const nextNames = new Set();
  const upcoming = all.filter(ev => now < ev.start && ev.start <= now + 86400000)
    .sort((a, b) => a.start - b.start || byName(a, b) || a.end - b.end)
    .filter(ev => {
      const name = ev.name.toLowerCase();
      if (nextNames.has(name)) return false;
      nextNames.add(name);
      return true;
    });
  const decorate = (ev, active) => {
    const minutes = Math.ceil(((active ? ev.end : ev.start) - now) / 60000);
    const hours = Math.floor(minutes / 60);
    const remaining = hours ? hours + 'h' + (minutes % 60 ? ' ' + minutes % 60 + 'm' : '') : minutes + ' min';
    const dated = day.format(ev.start) !== day.format(ev.end);
    const intervalClock = zoneName(ev.start) === zoneName(ev.end) ? clock : zonedClock;
    return {
      name: ev.name, map: ev.map, active,
      time: displayTime(active ? ev.end : ev.start, intervalClock),
      when: (dated ? date.format(ev.start) + ' ' + intervalClock.format(ev.start) : displayTime(ev.start, intervalClock)) + '–' +
        (dated ? date.format(ev.end) + ' ' : '') + intervalClock.format(ev.end),
      until_label: active ? remaining + ' left' : 'In ' + remaining
    };
  };
  const cachedAt = timestamp(input?.cachedAt);
  const unavailable = !raw || (raw.length > 0 && all.length === 0);
  return {
    briefing: {
      region: typeof region === 'string' ? region : 'unknown',
      status: unavailable ? 'Schedule unavailable' : active.length || upcoming.length ? 'Schedule ready' : 'No scheduled conditions',
      stale: Number.isFinite(cachedAt) && now - cachedAt > 10800000,
      live: active.map(ev => decorate(ev, true)),
      next: upcoming.map(ev => decorate(ev, false))
    }
  };
}
if (typeof module !== 'undefined') module.exports = { run };
