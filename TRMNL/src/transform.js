/* ARC Raiders TRMNL — normalize MetaForge's published event schedule.
 * Contract: { data: [{ name, map, startTime, endTime, icon }], cachedAt, region }.
 * No extra HTTP requests: TRMNL handles the single polling URL.
 */
function run(input) {
  const now = Date.now();
  const raw = Array.isArray(input?.data) ? input.data : [];
  const zone = input?.trmnl?.user?.time_zone_iana || 'UTC';
  const region = typeof input?.region === 'string' ? input.region : 'unknown';
  const regionLabels = {
    europe: 'EUROPE', 'north-america': 'NORTH AMERICA', north_america: 'NORTH AMERICA',
    'south-america': 'SOUTH AMERICA', south_america: 'SOUTH AMERICA',
    brazil: 'BRAZIL', asia: 'ASIA', 'east-asia': 'EAST ASIA', east_asia: 'EAST ASIA',
    oceania: 'OCEANIA'
  };
  const regionLabel = regionLabels[region.toLowerCase()] || region.replace(/[-_]/g, ' ').toUpperCase();
  const majorNames = new Set([
    'night raid', 'electromagnetic storm', 'hurricane', 'cold snap',
    'close scrutiny', 'hidden bunker', 'locked gate', 'arc frigate'
  ]);
  // Whitelist for our own embedded SVG symbols; unknown API events get a generic icon.
  const iconIds = new Set([
    'arc-frigate', 'close-scrutiny', 'cold-snap', 'electromagnetic-storm',
    'hidden-bunker', 'hurricane', 'locked-gate', 'night-raid', 'bird-city',
    'harvester', 'husk-graveyard', 'launch-tower-loot', 'lush-blooms',
    'matriarch', 'redirection', 'beachcombing', 'prospecting-probes',
    'uncovered-caches'
  ]);
  function iconId(name) {
    const key = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'arc-icon-' + (iconIds.has(key) ? key : 'default');
  }
  function untilLabel(minutes) {
    if (minutes < 60) return minutes + ' MIN';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + 'H' + (rest ? ' ' + rest + 'M' : '');
  }
  function formatTime(epoch) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone
      }).format(new Date(epoch));
    } catch (_) {
      return new Date(epoch).toISOString().slice(11, 16) + ' UTC';
    }
  }
  function displayTime(epoch) {
    const time = formatTime(epoch);
    try {
      const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: zone });
      return date.format(new Date(epoch)) === date.format(new Date(now))
        ? time : date.format(new Date(epoch)).toUpperCase() + ' ' + time;
    } catch (_) {
      return new Date(epoch).toISOString().slice(0, 10) + ' ' + time;
    }
  }
  function shorterMap(map) {
    const labels = {
      'Dam Battlegrounds': 'DAM', 'The Blue Gate': 'BLUE GATE', 'Blue Gate': 'BLUE GATE',
      'Buried City': 'BURIED CITY', 'Spaceport': 'SPACEPORT', 'Stella Montis': 'STELLA MONTIS',
      'Riven Tides': 'RIVEN TIDES', 'Pendola Pass': 'PENDOLA PASS', 'Dam': 'DAM'
    };
    return labels[map] || map.toUpperCase();
  }
  function kind(ev) { return majorNames.has(ev.name.toLowerCase()) ? 'MAJOR' : 'EVENT'; }
  function normalize(item) {
    if (!item || typeof item.name !== 'string' || typeof item.map !== 'string') return null;
    const start = Number(item.startTime);
    const end = Number(item.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end < now - 86400000) return null;
    return { name: item.name.slice(0, 70), map: item.map.slice(0, 60), start, end };
  }
  const seen = new Set();
  const all = raw.map(normalize).filter(Boolean).filter(ev => {
    const key = [ev.name, ev.map, ev.start, ev.end].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
  const active = all.filter(ev => ev.start <= now && now < ev.end);
  const upcoming = all.filter(ev => now < ev.start && ev.start <= now + 86400000);
  const decorate = (ev, live) => {
    const remaining = Math.ceil(((live ? ev.end : ev.start) - now) / 60000);
    return {
      name: ev.name.toUpperCase(), map: shorterMap(ev.map), level: 'MAP CONDITION',
      when: displayTime(ev.start) + '–' + formatTime(ev.end),
      time: displayTime(live ? ev.end : ev.start),
      remaining, until_label: untilLabel(remaining),
      state: live ? 'LIVE' : 'NEXT', long: ev.name.length > 15,
      icon_id: iconId(ev.name)
    };
  };
  // Keep order chronological in each group; the feature pane prioritizes major live conditions.
  const featured = active.find(ev => kind(ev) === 'MAJOR') || active[0] || upcoming[0] || null;
  const featureLive = Boolean(featured && featured.start <= now);
  const cachedAt = Number(input?.cachedAt) || 0;
  const ageHours = cachedAt ? (now - cachedAt) / 3600000 : null;
  return {
    briefing: {
      region: regionLabel,
      clock: formatTime(now),
      status: raw.length === 0 ? 'NO DATA' : (!featured ? 'NO EVENTS' : 'SCHEDULE READY'),
      age: ageHours !== null && ageHours > 3 ? 'FEED AGED' : '',
      live_count: active.length,
      has_live: active.length > 0,
      has_next: upcoming.length > 0,
      next_count: upcoming.length,
      has_feature: Boolean(featured),
      feature: featured ? decorate(featured, featureLive) : {},
      feature_live: featureLive,
      live: active.slice(0, 8).map(ev => decorate(ev, true)),
      next: upcoming.slice(0, 12).map(ev => decorate(ev, false)),
      has_data: raw.length > 0,
      // Disclose source prominently, as required by MetaForge's public-project terms.
      attribution: 'DATA: METAFORGE.APP/ARC-RAIDERS'
    }
  };
}
if (typeof module !== 'undefined') module.exports = { run };
