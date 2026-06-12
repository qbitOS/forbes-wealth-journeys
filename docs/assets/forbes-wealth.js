/**
 * Forbes Wealth Journeys — billionaire list + tabbed detail (Story / Portfolio / Entities / History)
 * Data: data/forbes-billionaires.json, data/entities.json
 */
(function () {
  'use strict';

  const DATA_URL = 'data/forbes-billionaires.json';
  const ENTITIES_URL = 'data/entities.json';
  const HISTORICAL_URL = 'data/historical-net-worth.json';
  const HOLDINGS_13F_URL = 'data/13f-top20.json';
  const BUYING_POWER_URL = 'data/buying-power-catalog.json';
  const CONTEXT_URL = 'data/world-context-events.json';
  const GEO_LOCATIONS_URL = 'data/entity-locations.json';
  const WORLD_GEO_URL = 'https://cdn.jsdelivr.net/npm/echarts@4/map/json/world.json';
  const BREAKDOWN_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#78716c'];

  let billionaires = [];
  let filtered = [];
  let selectedKey = '';
  let searchQuery = '';
  let entityCatalog = new Map();
  let historicalByRank = {};
  let holdings13fByRank = {};
  let holdings13fMeta = null;
  let breakdownChart = null;
  let historyChart = null;
  let storyWealthChart = null;
  let snowflakeChart = null;
  let worldMapChart = null;
  let worldGeoReady = false;
  let entityLocations = { entities: {}, countries: {} };
  let buyingPowerTargets = [];
  let worldEventsByYear = new Map();
  let sectorEventsBySector = {};
  let ancestoryMeta = null;
  let detailTab = 'story';
  let lastRenderedKey = '';
  let listDrawerOpen = false;

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function personKey(b) {
    return `${b.rank}::${b.name}`;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNetWorth(raw) {
    if (raw && typeof raw === 'object' && raw.value != null) {
      const sym = raw.currency === 'USD' ? '$' : `${raw.currency || ''} `;
      const asOf = raw.asOf ? ` <span class="forbes-asof">as of ${escapeHtml(raw.asOf)}</span>` : '';
      return `${sym}${raw.value}${raw.unit || 'B'}${asOf}`;
    }
    const s = String(raw).replace(/^\$/, '').trim();
    return s.endsWith('B') || s.endsWith('M') ? `$${s}` : `$${s}B`;
  }

  function formatUsdB(val) {
    if (val == null || val === '') return '—';
    return `$${val}B`;
  }

  function netWorthUsdB(person) {
    const nw = person?.netWorth;
    if (nw && typeof nw === 'object' && nw.value != null) return Number(nw.value);
    return 0;
  }

  function clampMetric(v) {
    return Math.max(0, Math.min(100, v));
  }

  function buildSnowflakeMetrics(person) {
    const nw = netWorthUsdB(person);
    const maxNw = Math.max(...billionaires.map(netWorthUsdB), nw, 1);
    const entities = (person.entities || []).length;
    const milestones = (person.timeline || []).length;
    const breakdown = person.wealthBreakdown || [];
    const hasStakes = breakdown.some((w) => w.stakePct != null);
    const publicShare = breakdown.length
      ? breakdown.filter((w) => w.type === 'public').length / breakdown.length
      : 0;
    const hist = historicalByRank[String(person.rank)] || [];
    const growth = hist.length > 1
      ? hist[hist.length - 1].netWorthB / Math.max(hist[0].netWorthB, 0.01)
      : 1;

    return {
      indicators: [
        { name: 'Wealth scale', max: 100 },
        { name: 'Portfolio depth', max: 100 },
        { name: 'Entity reach', max: 100 },
        { name: 'Milestones', max: 100 },
        { name: 'Public markets', max: 100 },
        { name: 'Trajectory', max: 100 },
      ],
      values: [
        clampMetric((nw / maxNw) * 100),
        clampMetric(hasStakes ? breakdown.length * 22 : breakdown.length * 8),
        clampMetric(Math.min(entities * 18, 100)),
        clampMetric(Math.min(milestones * 14, 100)),
        clampMetric(publicShare * 100),
        clampMetric(hist.length ? Math.min(Math.log10(growth + 1) * 45, 100) : 25),
      ],
    };
  }

  function buyingPowerPct(nw, costUsdB) {
    if (!costUsdB) return 0;
    return (nw / costUsdB) * 100;
  }

  function buyingPowerVerdict(pct) {
    if (pct >= 100) return 'Could hold full card';
    if (pct >= 75) return 'Near takeover threshold';
    if (pct >= 50) return 'Major bloc control';
    if (pct >= 25) return 'Strategic stake potential';
    return 'Influence tier';
  }

  function topBuyingPowerTargets(nw, targets, limit = 5) {
    const scored = targets
      .map((t) => ({ ...t, pct: buyingPowerPct(nw, t.costUsdB) }))
      .sort((a, b) => b.pct - a.pct);
    const pool = scored.filter((t) => t.pct >= 5);
    const candidates = pool.length ? pool : scored;
    const out = [];
    const seenTypes = new Set();

    for (const item of candidates) {
      if (out.length >= limit) break;
      if (seenTypes.has(item.type) && out.length < limit - 1) continue;
      out.push(item);
      seenTypes.add(item.type);
    }
    for (const item of candidates) {
      if (out.length >= limit) break;
      if (!out.some((o) => o.id === item.id)) out.push(item);
    }
    return out.slice(0, limit);
  }

  function disposeSnowflakeChart() {
    if (snowflakeChart) {
      snowflakeChart.dispose();
      snowflakeChart = null;
    }
  }

  function renderSnowflakeChart(person) {
    const el = $('#forbes-snowflake-chart');
    if (!el || typeof echarts === 'undefined') return;

    disposeSnowflakeChart();
    el.innerHTML = '';
    const { indicators, values } = buildSnowflakeMetrics(person);

    snowflakeChart = echarts.init(el, null, { renderer: 'canvas' });
    snowflakeChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {},
      radar: {
        indicator: indicators,
        radius: '58%',
        splitNumber: 4,
        axisName: { color: '#737373', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        splitArea: { show: false },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } },
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: '#2563eb' },
        itemStyle: { color: '#2563eb' },
        areaStyle: { color: 'rgba(37, 99, 235, 0.14)' },
        data: [{ value: values, name: person.name }],
      }],
    });
  }

  function renderBuyingPowerList(person) {
    const list = $('#forbes-buying-power-list');
    if (!list) return;

    const nw = netWorthUsdB(person);
    if (!buyingPowerTargets.length) {
      list.innerHTML = '<li class="forbes-buying-power-empty">No buying-power catalog loaded.</li>';
      return;
    }

    const top = topBuyingPowerTargets(nw, buyingPowerTargets);
    list.innerHTML = top
      .map(
        (t, i) => `
      <li class="forbes-buying-power-item">
        <span class="forbes-buying-power-rank">${i + 1}</span>
        <span class="forbes-buying-power-body">
          <span class="forbes-buying-power-label">${t.emoji || '🎯'} ${escapeHtml(t.label)}</span>
          <span class="forbes-buying-power-meta">${escapeHtml(t.type)} · $${t.costUsdB}B target</span>
          <span class="forbes-buying-power-verdict${t.pct >= 100 ? ' is-full' : ''}">${t.pct.toFixed(0)}% · ${escapeHtml(buyingPowerVerdict(t.pct))}</span>
        </span>
      </li>`,
      )
      .join('');
  }

  function renderWealthInsights(person) {
    renderWorldMap(person);
    renderSnowflakeChart(person);
    renderBuyingPowerList(person);
  }

  function entityLocForKey(key) {
    if (!key) return null;
    const id = String(key).toLowerCase().trim();
    return entityLocations.entities?.[id] || null;
  }

  function entityLocForName(name) {
    if (!name) return null;
    const norm = String(name).toLowerCase();
    const direct = entityLocations.entities?.[norm.replace(/\s+/g, '-')];
    if (direct) return direct;
    for (const [id, loc] of Object.entries(entityLocations.entities || {})) {
      if (norm.includes(id) || id.includes(norm.replace(/[^a-z0-9]/g, ''))) return loc;
    }
    return null;
  }

  function buildVentureMapPoints(person) {
    const points = [];
    const seen = new Set();

    const add = (lng, lat, label, meta = {}) => {
      if (lng == null || lat == null) return;
      const key = `${lng.toFixed(2)}:${lat.toFixed(2)}:${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      points.push({ name: label, value: [lng, lat], ...meta });
    };

    (person.entities || []).forEach((ent) => {
      const loc = entityLocForKey(ent.id);
      if (loc) add(loc.lng, loc.lat, loc.label || ent.name, { kind: 'venture' });
    });

    (person.wealthBreakdown || []).forEach((row) => {
      const loc = entityLocForName(row.entity);
      if (loc) add(loc.lng, loc.lat, row.entity, { kind: 'venture' });
    });

    const home = entityLocations.countries?.[person.country];
    if (home) {
      add(home.lng, home.lat, `${person.name} · ${person.country}`, { kind: 'home' });
    }

    return points;
  }

  function buildRiskMapPoints(person) {
    const nw = netWorthUsdB(person);
    return topBuyingPowerTargets(nw, buyingPowerTargets)
      .filter((t) => t.lat != null && t.lng != null)
      .map((t) => ({
        name: `${t.emoji || '🎯'} ${t.label} · ${t.pct.toFixed(0)}%`,
        value: [t.lng, t.lat, t.pct],
        pct: t.pct,
        kind: 'risk',
      }));
  }

  function disposeWorldMapChart() {
    if (worldMapChart) {
      worldMapChart.dispose();
      worldMapChart = null;
    }
  }

  async function ensureWorldGeoMap() {
    if (worldGeoReady || typeof echarts === 'undefined') return worldGeoReady;
    try {
      const resp = await fetch(WORLD_GEO_URL);
      if (!resp.ok) return false;
      const geo = await resp.json();
      echarts.registerMap('world', geo);
      worldGeoReady = true;
      return true;
    } catch {
      return false;
    }
  }

  async function renderWorldMap(person) {
    const el = $('#forbes-world-map');
    const legendEl = $('#forbes-map-legend');
    if (!el) return;

    disposeWorldMapChart();
    el.innerHTML = '';

    const ready = await ensureWorldGeoMap();
    if (!ready) {
      el.innerHTML = '<p class="forbes-map-empty">Map unavailable offline — venture and RISK pins need world GeoJSON.</p>';
      if (legendEl) legendEl.hidden = true;
      return;
    }

    const ventures = buildVentureMapPoints(person);
    const risks = buildRiskMapPoints(person);

    if (legendEl) {
      legendEl.hidden = false;
      legendEl.innerHTML = `
        <span class="forbes-map-legend-item"><i class="forbes-map-dot is-home"></i> Residence</span>
        <span class="forbes-map-legend-item"><i class="forbes-map-dot is-venture"></i> Ventures</span>
        <span class="forbes-map-legend-item"><i class="forbes-map-dot is-risk"></i> RISK targets (top 5)</span>`;
    }

    worldMapChart = echarts.init(el, null, { renderer: 'canvas' });
    worldMapChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter(params) {
          return params.name || '';
        },
      },
      geo: {
        map: 'world',
        roam: false,
        zoom: 1.12,
        center: [12, 18],
        itemStyle: {
          areaColor: '#eef2f7',
          borderColor: '#cbd5e1',
          borderWidth: 0.6,
        },
        emphasis: {
          itemStyle: { areaColor: '#e2e8f0' },
          label: { show: false },
        },
      },
      series: [
        {
          name: 'Ventures',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: ventures.filter((p) => p.kind === 'venture'),
          symbolSize: 11,
          itemStyle: { color: '#2563eb', shadowBlur: 6, shadowColor: 'rgba(37,99,235,0.35)' },
          z: 3,
        },
        {
          name: 'Residence',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: ventures.filter((p) => p.kind === 'home'),
          symbol: 'pin',
          symbolSize: 28,
          itemStyle: { color: '#171717' },
          z: 4,
        },
        {
          name: 'RISK targets',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: risks,
          symbolSize(val) {
            return Math.min(18, 8 + (val[2] || 0) / 80);
          },
          showEffectOn: 'render',
          rippleEffect: { brushType: 'stroke', scale: 2.4, period: 5 },
          itemStyle: { color: '#b45309', shadowBlur: 8, shadowColor: 'rgba(180,83,9,0.45)' },
          z: 2,
        },
      ],
    });
  }

  async function loadEntityLocations() {
    try {
      const resp = await fetch(GEO_LOCATIONS_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      entityLocations = {
        entities: payload.entities || {},
        countries: payload.countries || {},
      };
    } catch {
      entityLocations = { entities: {}, countries: {} };
    }
  }

  async function loadWorldContext() {
    try {
      const resp = await fetch(CONTEXT_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      ancestoryMeta = { ancestoryUrl: payload.ancestoryUrl };
      worldEventsByYear = new Map();
      (payload.events || []).forEach((ev) => {
        if (ev?.year == null) return;
        if (!worldEventsByYear.has(ev.year)) worldEventsByYear.set(ev.year, []);
        worldEventsByYear.get(ev.year).push(ev);
      });
      sectorEventsBySector = payload.sectorEvents || {};
    } catch {
      worldEventsByYear = new Map();
      sectorEventsBySector = {};
      ancestoryMeta = null;
    }
  }

  async function loadBuyingPowerCatalog() {
    try {
      const resp = await fetch(BUYING_POWER_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      buyingPowerTargets = payload.targets || [];
    } catch {
      buyingPowerTargets = [];
    }
  }

  function personHaystack(b) {
    const entityNames = (b.entities || []).map((e) => e.name);
    const breakdown = (b.wealthBreakdown || []).map((w) => w.entity);
    return [
      b.name,
      b.country,
      b.sector,
      b.sourceOfWealth,
      ...(b.companies || []),
      ...entityNames,
      ...breakdown,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function findPerson(key) {
    return billionaires.find((b) => personKey(b) === key);
  }

  function catalogEntry(entity) {
    if (!entity?.id) return entity;
    const cat = entityCatalog.get(entity.id);
    if (!cat) return entity;
    return {
      ...entity,
      name: entity.name || cat.name,
      founded: entity.founded ?? cat.founded,
      status: entity.status || cat.status,
      ticker: entity.ticker || cat.ticker,
      valuationUsdB: entity.valuationUsdB ?? cat.valuationUsdB,
    };
  }

  function applyFilter() {
    const q = searchQuery.trim().toLowerCase();
    filtered = q
      ? billionaires.filter((b) => personHaystack(b).includes(q))
      : [...billionaires];
    if (!filtered.some((b) => personKey(b) === selectedKey) && filtered.length) {
      selectedKey = personKey(filtered[0]);
    }
  }

  function renderList(container) {
    if (!filtered.length) {
      container.innerHTML = '<p class="forbes-empty">No profiles match your search.</p>';
      return;
    }

    container.innerHTML = filtered
      .map((b) => {
        const key = personKey(b);
        const active = key === selectedKey;
        return `
      <button
        type="button"
        class="forbes-list-item${active ? ' is-active' : ''}"
        data-key="${escapeHtml(key)}"
        aria-pressed="${active}"
      >
        <span class="forbes-rank">#${b.rank}</span>
        <span class="forbes-list-body">
          <strong class="forbes-name">${escapeHtml(b.name)}</strong>
          <span class="forbes-meta">${escapeHtml(b.sector)} · ${escapeHtml(b.country)}</span>
        </span>
        <span class="forbes-worth">${formatNetWorth(b.netWorth)}</span>
      </button>`;
      })
      .join('');

    container.querySelectorAll('.forbes-list-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedKey = btn.dataset.key;
        renderList(container);
        renderDetail($('#forbes-detail'));
        syncUrl();
        setListDrawer(false);
      });
    });
  }

  function formatShares(shares) {
    if (shares == null || shares === '') return '—';
    const n = Number(shares);
    if (Number.isNaN(n)) return '—';
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    return n.toLocaleString();
  }

  function holdings13fForRank(rank) {
    return holdings13fByRank[String(rank)] || null;
  }

  function render13fTable(rows) {
    if (!rows?.length) {
      return '<p class="forbes-empty">No 13F holdings on file.</p>';
    }
    return `
      <table class="forbes-table forbes-13f-table">
        <thead>
          <tr><th>Ticker</th><th>Shares</th><th>Value</th><th>% portfolio</th></tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td><span class="forbes-ticker">${escapeHtml(r.ticker)}</span></td>
              <td>${formatShares(r.shares)}</td>
              <td>${formatUsdB(r.valueUsdB)}</td>
              <td>${r.pctPortfolio != null ? `${r.pctPortfolio}%` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function render13fSection(person) {
    const section = $('#forbes-13f-section');
    const metaEl = $('#forbes-13f-meta');
    const tableEl = $('#forbes-13f-table');
    if (!section || !tableEl) return;

    const entry = holdings13fForRank(person.rank);
    if (!entry?.holdings?.length) {
      section.hidden = true;
      tableEl.innerHTML = '';
      if (metaEl) metaEl.textContent = '';
      return;
    }

    section.hidden = false;
    if (metaEl && holdings13fMeta) {
      const parts = [];
      if (holdings13fMeta.asOf) parts.push(`as of ${holdings13fMeta.asOf}`);
      if (holdings13fMeta.source) parts.push(holdings13fMeta.source);
      metaEl.textContent = parts.join(' · ');
    }
    tableEl.innerHTML = render13fTable(entry.holdings);
  }

  function renderWealthBreakdownTable(rows) {
    if (!rows || !rows.length) {
      return '<p class="forbes-empty">No stake-level breakdown yet.</p>';
    }
    return `
      <table class="forbes-table">
        <thead>
          <tr><th>Entity</th><th>Type</th><th>Stake</th><th>Value</th></tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.entity)}${r.ticker ? ` <span class="forbes-ticker">${escapeHtml(r.ticker)}</span>` : ''}</td>
              <td>${escapeHtml(r.type || '—')}</td>
              <td>${r.stakePct != null ? `${r.stakePct}%` : '—'}</td>
              <td>${formatUsdB(r.valueUsdB)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  const TAB_KEYS = ['story', 'portfolio', 'entities', 'history'];

  function tabIndex(tab) {
    const i = TAB_KEYS.indexOf(tab);
    return i >= 0 ? i : 0;
  }

  function renderEntityCardsHtml(entities) {
    const list = (entities || []).map(catalogEntry);
    if (!list.length) {
      return '<p class="forbes-empty">No linked entities yet.</p>';
    }
    return list
      .map(
        (e) => `
          <article class="forbes-entity-card">
            <h4 class="forbes-entity-card-name">${escapeHtml(e.name)}</h4>
            <p class="forbes-entity-card-meta">${escapeHtml(e.role || '—')}${e.founded ? ` · ${e.founded}` : ''} · ${escapeHtml(e.status || '—')}</p>
            <p class="forbes-entity-card-val">${e.ticker ? `<span class="forbes-ticker">${escapeHtml(e.ticker)}</span> · ` : ''}${e.valuationUsdB ? `${formatUsdB(e.valuationUsdB)} mkt cap` : ''}</p>
            <code class="forbes-entity-id">${escapeHtml(e.id)}</code>
          </article>`,
      )
      .join('');
  }

  function parseTimelineYear(raw) {
    const s = String(raw ?? '').trim();
    const decade = s.match(/^(\d{4})s$/);
    if (decade) return Number(decade[1]) + 5;
    const year = s.match(/\d{4}/);
    return year ? Number(year[0]) : null;
  }

  function expandHistoricalSeries(hist) {
    if (!hist?.length) return [];
    const sorted = [...hist].sort((a, b) => a.year - b.year);
    if (sorted.length === 1) return [{ ...sorted[0], anchor: true }];

    const out = [];
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      out.push({ year: a.year, netWorthB: a.netWorthB, anchor: true });
      for (let y = a.year + 1; y < b.year; y += 1) {
        const t = (y - a.year) / (b.year - a.year);
        const netWorthB = Math.round((a.netWorthB + t * (b.netWorthB - a.netWorthB)) * 100) / 100;
        out.push({ year: y, netWorthB, interpolated: true });
      }
    }
    out.push({ year: sorted[sorted.length - 1].year, netWorthB: sorted[sorted.length - 1].netWorthB, anchor: true });
    return out;
  }

  function milestonesByYear(events) {
    const map = new Map();
    (events || []).forEach((ev) => {
      const y = parseTimelineYear(ev.year);
      if (y == null) return;
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(ev);
    });
    return map;
  }

  function estimateBirthYear(person) {
    const age = Number(person?.age);
    if (!Number.isFinite(age) || age <= 0) return null;
    const asOf = person?.netWorth?.asOf || '2026';
    const anchorYear = Number(String(asOf).slice(0, 4));
    if (!Number.isFinite(anchorYear)) return null;
    return anchorYear - age;
  }

  function decadeStart(raw) {
    const s = String(raw ?? '').trim();
    const decade = s.match(/^(\d{4})s$/);
    if (decade) return Number(decade[1]);
    return parseTimelineYear(s);
  }

  function lifeContextForYear(person, year) {
    const birth = estimateBirthYear(person);
    if (birth == null) return [];
    const out = [];
    if (year === birth) {
      out.push({
        year,
        label: `Born · ${person.country || '—'}`,
        category: 'life',
        description: `${person.name} — life timeline anchor (AnCEstory-style).`,
      });
    }
    const age = year - birth;
    if (age > 0 && [16, 18, 21, 25, 30, 40, 50, 60, 70].includes(age)) {
      out.push({
        year,
        label: `Age ${age}`,
        category: 'life',
        description: age === 25 ? 'Quarter-century — early founder window for many tech fortunes.' : `Life-stage marker at ${age}.`,
      });
    }
    const fortuneStart = decadeStart(person.firstFortuneDecade);
    if (fortuneStart != null && year === fortuneStart) {
      out.push({
        year,
        label: `First fortune era · ${person.firstFortuneDecade}`,
        category: 'life',
        description: person.sourceOfWealth ? `Source: ${person.sourceOfWealth}` : 'Wealth-building decade from profile.',
      });
    }
    return out;
  }

  function worldContextForYear(person, year) {
    const global = worldEventsByYear.get(year) || [];
    const sector = (sectorEventsBySector[person.sector] || []).filter((ev) => ev.year === year);
    const life = lifeContextForYear(person, year);
    return [...life, ...global, ...sector];
  }

  function buildWealthJourneyRows(person) {
    const expanded = expandHistoricalSeries(historicalSeries(person.rank));
    const byYear = milestonesByYear(person.timeline);

    if (!expanded.length) {
      return (person.timeline || [])
        .map((ev) => {
          const y = parseTimelineYear(ev.year);
          return {
            year: y,
            yearLabel: String(ev.year),
            netWorthB: null,
            milestones: [ev],
            context: y != null ? worldContextForYear(person, y) : [],
          };
        })
        .filter((row) => row.year != null)
        .sort((a, b) => a.year - b.year);
    }

    return expanded.map((point) => ({
      year: point.year,
      yearLabel: String(point.year),
      netWorthB: point.netWorthB,
      interpolated: Boolean(point.interpolated),
      anchor: Boolean(point.anchor),
      milestones: byYear.get(point.year) || [],
      context: worldContextForYear(person, point.year),
    }));
  }

  function renderAncestryChip(ev) {
    const cat = ev.category || 'history';
    const desc = ev.description ? ` title="${escapeHtml(ev.description)}"` : '';
    return `<span class="forbes-ancestry-chip" data-category="${escapeHtml(cat)}"${desc}>${escapeHtml(cat)} · ${escapeHtml(ev.label)}</span>`;
  }

  function renderAncestryLayer(events) {
    if (!events?.length) return '';
    return `<div class="forbes-ancestry-layer" aria-label="Historical and life context">${events.map((ev) => renderAncestryChip(ev)).join('')}</div>`;
  }

  function renderMilestoneBlock(ev) {
    const type = ev.type ? `<span class="forbes-event-type">${escapeHtml(ev.type)}</span>` : '';
    const val = ev.valuationUsdB != null ? `<p class="forbes-journey-val">Valuation ${formatUsdB(ev.valuationUsdB)}</p>` : '';
    const src = ev.source ? `<p class="forbes-journey-source"><a href="${escapeHtml(ev.source)}" target="_blank" rel="noopener">Source</a></p>` : '';
    return `
      <div class="forbes-journey-milestone">
        ${type}
        <strong class="forbes-journey-title">${escapeHtml(ev.title)}</strong>
        ${ev.entityId ? `<p class="forbes-journey-entity">${escapeHtml(ev.entityId)}</p>` : ''}
        ${ev.description ? `<p class="forbes-journey-desc">${escapeHtml(ev.description)}</p>` : ''}
        ${ev.impact ? `<p class="forbes-journey-impact"><span>Impact</span> ${escapeHtml(ev.impact)}</p>` : ''}
        ${val}
        ${src}
      </div>`;
  }

  function renderWealthJourney(person) {
    const rows = buildWealthJourneyRows(person);
    if (!rows.length) {
      return '<p class="forbes-empty">No wealth journey data yet.</p>';
    }

    return `
      <div class="forbes-ancestry-intro">
        <p class="forbes-ancestry-lead">World, sector, and life-stage context layered on net worth — inspired by <a href="${escapeHtml(ancestoryMeta?.ancestoryUrl || 'https://fornevercollective.github.io/ancestory/')}" target="_blank" rel="noopener">AnCEstory</a>.</p>
      </div>
      <ol class="forbes-journey forbes-journey-yearly">
        ${rows
          .map((row, idx) => {
            const prev = idx > 0 ? rows[idx - 1].netWorthB : null;
            let delta = '';
            if (row.netWorthB != null && prev != null && prev > 0) {
              const pct = ((row.netWorthB - prev) / prev) * 100;
              const sign = pct >= 0 ? '+' : '';
              delta = `<span class="forbes-journey-delta ${pct >= 0 ? 'is-up' : 'is-down'}">${sign}${pct.toFixed(0)}% YoY</span>`;
            }
            const worthMeta = row.interpolated
              ? '<span class="forbes-journey-est">est.</span>'
              : row.anchor
                ? '<span class="forbes-journey-anchor">recorded</span>'
                : '';
            const milestoneHtml = row.milestones.length
              ? row.milestones.map((ev) => renderMilestoneBlock(ev)).join('')
              : '';
            const contextHtml = renderAncestryLayer(row.context);
            const hasStory = row.milestones.length || row.context.length;
            const itemClass = [
              'forbes-journey-item',
              row.milestones.length ? 'has-milestone' : 'is-year-only',
              row.context.length ? 'has-context' : '',
              hasStory ? 'has-story' : '',
              row.interpolated ? 'is-interpolated' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return `
          <li class="${itemClass}">
            <span class="forbes-journey-year">${escapeHtml(row.yearLabel)}</span>
            <div class="forbes-journey-body">
              ${
                row.netWorthB != null
                  ? `<p class="forbes-journey-networth">${formatUsdB(row.netWorthB)} ${worthMeta} ${delta}</p>`
                  : ''
              }
              ${contextHtml}
              ${milestoneHtml}
            </div>
          </li>`;
          })
          .join('')}
      </ol>`;
  }

  function renderTimeline(events) {
    if (!events || !events.length) {
      return '<p class="forbes-empty">No timeline entries yet.</p>';
    }

    return `
      <ol class="forbes-journey">
        ${events
          .map((ev) => {
            const type = ev.type ? `<span class="forbes-event-type">${escapeHtml(ev.type)}</span>` : '';
            const val = ev.valuationUsdB != null ? `<p class="forbes-journey-val">Valuation ${formatUsdB(ev.valuationUsdB)}</p>` : '';
            const src = ev.source ? `<p class="forbes-journey-source"><a href="${escapeHtml(ev.source)}" target="_blank" rel="noopener">Source</a></p>` : '';
            return `
          <li class="forbes-journey-item">
            <span class="forbes-journey-year">${escapeHtml(ev.year)}</span>
            <div class="forbes-journey-body">
              ${type}
              <strong class="forbes-journey-title">${escapeHtml(ev.title)}</strong>
              ${ev.entityId ? `<p class="forbes-journey-entity">${escapeHtml(ev.entityId)}</p>` : ''}
              ${ev.description ? `<p class="forbes-journey-desc">${escapeHtml(ev.description)}</p>` : ''}
              ${ev.impact ? `<p class="forbes-journey-impact"><span>Impact</span> ${escapeHtml(ev.impact)}</p>` : ''}
              ${val}
              ${src}
            </div>
          </li>`;
          })
          .join('')}
      </ol>`;
  }

  function disposeBreakdownChart() {
    if (breakdownChart) {
      breakdownChart.dispose();
      breakdownChart = null;
    }
  }

  function disposeHistoryChart() {
    if (historyChart) {
      historyChart.dispose();
      historyChart = null;
    }
  }

  function disposeStoryWealthChart() {
    if (storyWealthChart) {
      storyWealthChart.dispose();
      storyWealthChart = null;
    }
  }

  function netWorthChartOption(series, { compact = false, markByYear = {} } = {}) {
    const years = series.map((p) => p.year);
    const values = series.map((p) => p.netWorthB);
    const markPoints = series
      .filter((p) => markByYear[p.year])
      .map((p) => ({
        name: markByYear[p.year],
        coord: [p.year, p.netWorthB],
        value: markByYear[p.year],
      }));

    return {
      backgroundColor: 'transparent',
      color: ['#171717'],
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          const mark = markByYear[Number(p.name)];
          return mark
            ? `${p.name}: $${p.value}B<br/><strong>Milestone:</strong> ${mark}`
            : `${p.name}: $${p.value}B`;
        },
      },
      grid: {
        left: 8,
        right: compact ? 8 : 16,
        top: compact ? 8 : 16,
        bottom: compact ? 24 : 32,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: years,
        boundaryGap: false,
        axisLabel: { color: '#737373', fontSize: compact ? 9 : 10, interval: compact ? 'auto' : 0 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } },
      },
      yAxis: {
        type: 'value',
        name: compact ? '$B' : 'Net Worth (B USD)',
        nameTextStyle: { color: '#737373', fontSize: compact ? 9 : 10 },
        axisLabel: { color: '#737373', fontSize: compact ? 9 : 10 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      },
      series: [
        {
          name: 'Net worth',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: compact ? 4 : 6,
          lineStyle: { width: 2, color: '#171717' },
          itemStyle: { color: '#171717' },
          areaStyle: { color: 'rgba(0, 0, 0, 0.06)' },
          data: values,
          markPoint: markPoints.length
            ? {
                symbol: 'pin',
                symbolSize: compact ? 28 : 42,
                itemStyle: { color: '#b45309' },
                label: { show: false },
                data: markPoints,
              }
            : undefined,
        },
      ],
    };
  }

  function historicalSeries(rank) {
    return historicalByRank[String(rank)] || null;
  }

  function milestoneMarkMap(person) {
    const marks = {};
    (person.timeline || []).forEach((ev) => {
      const y = parseTimelineYear(ev.year);
      if (y != null && ev.title) marks[y] = ev.title;
    });
    return marks;
  }

  function renderHistoryChart(person) {
    const el = $('#historyChart');
    const emptyEl = $('#forbes-history-empty');
    if (!el || typeof echarts === 'undefined') return;

    disposeHistoryChart();
    const series = historicalSeries(person.rank);
    if (!series?.length) {
      el.innerHTML = '';
      el.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    el.hidden = false;
    el.innerHTML = '';

    historyChart = echarts.init(el, null, { renderer: 'canvas' });
    historyChart.setOption(netWorthChartOption(series));
  }

  function renderStoryWealthChart(person) {
    const el = $('#forbes-story-wealth-chart');
    const emptyEl = $('#forbes-story-wealth-empty');
    if (!el || typeof echarts === 'undefined') return;

    disposeStoryWealthChart();
    const series = expandHistoricalSeries(historicalSeries(person.rank));
    if (!series.length) {
      el.innerHTML = '';
      el.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    el.hidden = false;
    el.innerHTML = '';

    storyWealthChart = echarts.init(el, null, { renderer: 'canvas' });
    storyWealthChart.setOption(
      netWorthChartOption(series, { compact: true, markByYear: milestoneMarkMap(person) }),
    );
  }

  function renderBreakdownChart(person) {
    const el = $('#breakdownChart');
    if (!el || typeof echarts === 'undefined') return;

    disposeBreakdownChart();
    const rows = (person.wealthBreakdown || []).filter((r) => r.valueUsdB != null);
    if (!rows.length) {
      el.innerHTML = '<p class="forbes-empty">Chart unavailable — no valueUsdB in breakdown.</p>';
      return;
    }
    el.innerHTML = '';

    breakdownChart = echarts.init(el, null, { renderer: 'canvas' });
    breakdownChart.setOption({
      backgroundColor: 'transparent',
      color: BREAKDOWN_COLORS,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) =>
          params
            .filter((p) => p.value > 0)
            .map((p) => `${p.seriesName}: $${p.value}B`)
            .join('<br/>'),
      },
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: '#737373', fontSize: 11 },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 48, containLabel: true },
      xAxis: {
        type: 'value',
        name: '$B',
        nameTextStyle: { color: '#737373', fontSize: 10 },
        axisLabel: { color: '#737373', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      },
      yAxis: {
        type: 'category',
        data: ['Wealth composition'],
        axisLabel: { color: '#737373', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: rows.map((row, i) => ({
        name: row.ticker ? `${row.entity} (${row.ticker})` : row.entity,
        type: 'bar',
        stack: 'total',
        barWidth: 36,
        emphasis: { focus: 'series' },
        data: [row.valueUsdB],
        itemStyle: { color: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] },
      })),
    });
  }

  function showTab(n) {
    const idx = Number(n);
    if (Number.isNaN(idx) || idx < 0 || idx > 3) return;

    detailTab = TAB_KEYS[idx];
    const modal = $('#modalContent');
    if (!modal) return;

    modal.querySelectorAll('.forbes-modal-tab').forEach((btn) => {
      const active = Number(btn.dataset.tabIndex) === idx;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    [0, 1, 2, 3].forEach((i) => {
      const panel = $(`#tab${i}`);
      if (!panel) return;
      const show = i === idx;
      panel.hidden = !show;
      panel.classList.toggle('active', show);
    });

    const person = findPerson(selectedKey);
    if (!person) return;

    if (idx === 1) {
      requestAnimationFrame(() => {
        renderBreakdownChart(person);
        breakdownChart?.resize();
      });
    }
    if (idx === 3) {
      requestAnimationFrame(() => {
        renderHistoryChart(person);
        historyChart?.resize();
      });
    }
  }

  function renderFacts(person) {
    const factsEl = $('#forbes-facts');
    if (!factsEl) return;

    const legacySource = person.sourceOfWealth
      ? `<div><dt>Source of wealth</dt><dd>${escapeHtml(person.sourceOfWealth)}</dd></div>`
      : '';
    const legacyDecade = person.firstFortuneDecade
      ? `<div><dt>First fortune</dt><dd>${escapeHtml(person.firstFortuneDecade)}</dd></div>`
      : '';

    factsEl.innerHTML = `
      <div><dt>Age</dt><dd>${person.age ?? '—'}</dd></div>
      <div><dt>Country</dt><dd>${escapeHtml(person.country || '—')}</dd></div>
      <div><dt>Sector</dt><dd>${escapeHtml(person.sector || '—')}</dd></div>
      ${legacySource}
      ${legacyDecade}`;
  }

  function renderDetailLinks(person) {
    const linksEl = $('#forbes-detail-links');
    if (!linksEl) return;

    const links = [
      ['Forbes', person.forbesProfile],
      ['Wikipedia', person.wikipediaLink],
    ].filter(([, url]) => url);

    if (!links.length) {
      linksEl.hidden = true;
      linksEl.innerHTML = '';
      return;
    }

    linksEl.hidden = false;
    linksEl.innerHTML = links
      .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`)
      .join('');
  }

  function grokipediaPageUrl(name) {
    if (!name) return null;
    const slug = String(name).trim().replace(/\s+/g, '_');
    return `https://grokipedia.com/page/${encodeURIComponent(slug).replace(/%20/g, '_')}`;
  }

  function grokipediaUrlForPerson(person) {
    if (!person?.name) return person?.grokipediaLink || null;
    const legacy = person.grokipediaLink || '';
    if (legacy.includes('grok.x.ai/wiki') || legacy.includes('grokipedia.com')) {
      return grokipediaPageUrl(person.name);
    }
    return legacy || grokipediaPageUrl(person.name);
  }

  function renderStoryAside(person) {
    const aside = $('.forbes-story-aside');
    if (!aside || !person) return;

    const grokUrl = grokipediaUrlForPerson(person);
    const wikiUrl = person.wikipediaLink;
    const forbesUrl = person.forbesProfile;
    const companies = (person.companies || []).slice(0, 6);
    const milestones = (person.timeline || []).slice(0, 4);
    const birthYear = estimateBirthYear(person);

    aside.innerHTML = `
      <article class="forbes-wiki-card">
        <header class="forbes-wiki-header">
          <p class="forbes-wiki-kicker">Grokipedia · Forbes #${person.rank}</p>
          <h3 class="forbes-wiki-title">${escapeHtml(person.name)}</h3>
          <p class="forbes-wiki-worth">${formatNetWorth(person.netWorth)}</p>
        </header>
        ${person.summary ? `<p class="forbes-wiki-lead">${escapeHtml(person.summary)}</p>` : ''}
        <dl class="forbes-wiki-infobox">
          <div><dt>Born</dt><dd>${birthYear ? `${birthYear} · age ${person.age ?? '—'}` : escapeHtml(person.age != null ? `age ${person.age}` : '—')}</dd></div>
          <div><dt>Country</dt><dd>${escapeHtml(person.country || '—')}</dd></div>
          <div><dt>Sector</dt><dd>${escapeHtml(person.sector || '—')}</dd></div>
          <div><dt>Source of wealth</dt><dd>${escapeHtml(person.sourceOfWealth || '—')}</dd></div>
          <div><dt>First fortune</dt><dd>${escapeHtml(person.firstFortuneDecade || '—')}</dd></div>
        </dl>
        ${
          companies.length
            ? `<section class="forbes-wiki-section">
          <h4 class="forbes-wiki-heading">Associated ventures</h4>
          <p class="forbes-wiki-copy">Companies most closely tied to this profile's Forbes wealth classification.</p>
          <ul class="forbes-wiki-list">${companies.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        </section>`
            : ''
        }
        ${
          milestones.length
            ? `<section class="forbes-wiki-section">
          <h4 class="forbes-wiki-heading">Selected milestones</h4>
          <ul class="forbes-wiki-list forbes-wiki-milestones">
            ${milestones
              .map(
                (ev) =>
                  `<li><strong>${escapeHtml(ev.year)}</strong> · ${escapeHtml(ev.title)}${ev.type ? `<span class="forbes-wiki-tag">${escapeHtml(ev.type)}</span>` : ''}</li>`,
              )
              .join('')}
          </ul>
        </section>`
            : ''
        }
        <section class="forbes-wiki-section forbes-wiki-disclaimer">
          <p class="forbes-wiki-copy">Lead and infobox draw from Forbes list data and Grok enrichment in this repo. The linked Grokipedia article is an independent AI-generated encyclopedia entry.</p>
        </section>
        <div class="forbes-wiki-actions">
          ${grokUrl ? `<a id="grokipediaBtn" class="forbes-grokipedia-btn" href="${escapeHtml(grokUrl)}" target="_blank" rel="noopener">Read full Grokipedia article →</a>` : ''}
          <div class="forbes-wiki-secondary-links">
            ${wikiUrl ? `<a class="forbes-wiki-link" href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}
            ${forbesUrl ? `<a class="forbes-wiki-link" href="${escapeHtml(forbesUrl)}" target="_blank" rel="noopener">Forbes</a>` : ''}
          </div>
        </div>
      </article>`;
  }

  function updateGrokipediaBtn(person) {
    renderStoryAside(person);
  }

  function renderStoryTab(person) {
    renderStoryWealthChart(person);
    const timelineEl = $('#forbes-story-timeline');
    if (timelineEl) {
      timelineEl.innerHTML = renderWealthJourney(person);
    }
    updateGrokipediaBtn(person);
  }

  function renderHistoryTab(person) {
    renderHistoryChart(person);
  }

  function renderPortfolioTab(person) {
    const tableEl = $('#forbes-breakdown-table');
    if (tableEl) {
      tableEl.innerHTML = renderWealthBreakdownTable(person.wealthBreakdown);
    }
    render13fSection(person);
  }

  function renderEntitiesTab(person) {
    const listEl = $('#entitiesList');
    if (!listEl) return;
    listEl.innerHTML = renderEntityCardsHtml(person.entities);
  }

  function renderDetail(container) {
    const person = findPerson(selectedKey);
    const emptyEl = $('#forbes-detail-empty');
    const modal = $('#modalContent');

    if (!person) {
      disposeBreakdownChart();
      disposeHistoryChart();
      disposeStoryWealthChart();
      disposeSnowflakeChart();
      disposeWorldMapChart();
      if (emptyEl) emptyEl.hidden = false;
      if (modal) modal.hidden = true;
      return;
    }

    if (selectedKey !== lastRenderedKey) {
      detailTab = 'story';
      lastRenderedKey = selectedKey;
    }

    disposeBreakdownChart();
    disposeHistoryChart();
    disposeStoryWealthChart();
    disposeWorldMapChart();

    if (emptyEl) emptyEl.hidden = true;
    if (modal) modal.hidden = false;

    const rankLabel = $('#forbes-rank-label');
    if (rankLabel) rankLabel.textContent = `Forbes rank #${person.rank}`;

    const nameEl = $('#modalName');
    if (nameEl) nameEl.textContent = person.name;

    const worthEl = $('#forbes-detail-worth');
    if (worthEl) worthEl.innerHTML = formatNetWorth(person.netWorth);

    const summaryEl = $('#forbes-detail-summary');
    if (summaryEl) summaryEl.textContent = person.summary || '';

    renderWealthInsights(person);
    renderDetailLinks(person);
    renderFacts(person);
    renderStoryTab(person);
    renderPortfolioTab(person);
    renderEntitiesTab(person);
    renderHistoryTab(person);
    showTab(tabIndex(detailTab));
  }

  function detailShellHtml() {
    return `
      <p id="forbes-detail-empty" class="forbes-empty">Select a person from the rankings.</p>
      <div id="modalContent" class="forbes-modal-content" data-forbes-detail-v2="2" hidden>
        <header class="forbes-detail-header">
          <button
            type="button"
            class="forbes-rank-picker"
            id="forbes-rank-picker"
            aria-expanded="false"
            aria-controls="forbes-list-drawer"
          >
            <span class="forbes-rank-picker-icon" aria-hidden="true">☰</span>
            <span id="forbes-rank-label">Forbes rank</span>
            <span class="forbes-rank-picker-hint">Browse all</span>
          </button>
        </header>
        <h2 id="modalName" class="forbes-detail-name"></h2>
        <div class="forbes-worth-row">
          <div class="forbes-worth-primary">
            <p id="forbes-detail-worth" class="forbes-detail-worth"></p>
            <p id="forbes-detail-summary" class="forbes-detail-summary"></p>
            <section class="forbes-worth-map-panel" aria-label="Global venture footprint and RISK targets">
              <h4 class="forbes-worth-map-title">Global footprint · RISK map</h4>
              <div id="forbes-world-map" class="forbes-world-map" role="img" aria-label="World map of ventures and buying-power targets"></div>
              <div id="forbes-map-legend" class="forbes-map-legend" hidden></div>
            </section>
          </div>
          <aside class="forbes-worth-insights" aria-label="Wealth metrics and buying power">
            <div id="forbes-snowflake-chart" class="forbes-snowflake-chart" role="img" aria-label="Profile metrics radar chart"></div>
            <section class="forbes-buying-power">
              <h4 class="forbes-buying-power-title">Buying power · RISK scale</h4>
              <ol id="forbes-buying-power-list" class="forbes-buying-power-list"></ol>
            </section>
          </aside>
        </div>
        <nav id="forbes-detail-links" class="forbes-links" aria-label="External profiles" hidden></nav>
        <dl id="forbes-facts" class="forbes-facts"></dl>
        <div class="forbes-modal-tabs" role="tablist" aria-label="Profile sections">
          <button type="button" role="tab" class="forbes-modal-tab active" data-tab-index="0" aria-selected="true">Story</button>
          <button type="button" role="tab" class="forbes-modal-tab" data-tab-index="1" aria-selected="false">Portfolio</button>
          <button type="button" role="tab" class="forbes-modal-tab" data-tab-index="2" aria-selected="false">Entities</button>
          <button type="button" role="tab" class="forbes-modal-tab" data-tab-index="3" aria-selected="false">History</button>
        </div>
        <div id="tab0" class="forbes-detail-tabpanel active" role="tabpanel">
          <div class="forbes-story-layout">
            <div class="forbes-story-main">
              <section class="forbes-panel">
                <h4 class="forbes-journey-heading">Wealth journey</h4>
                <p id="forbes-story-wealth-empty" class="forbes-empty" hidden>No yearly net-worth series for this rank.</p>
                <div id="forbes-story-wealth-chart" class="forbes-story-wealth-chart" role="img" aria-label="Year-by-year net worth chart" hidden></div>
                <div id="forbes-story-timeline" class="forbes-story-timeline"></div>
              </section>
            </div>
            <aside class="forbes-story-aside" aria-label="Grokipedia article summary"></aside>
          </div>
        </div>
        <div id="tab1" class="forbes-detail-tabpanel" role="tabpanel" hidden>
          <h3 class="forbes-journey-heading">Wealth Breakdown</h3>
          <div id="breakdownChart" class="forbes-breakdown-chart" role="img" aria-label="Stacked bar chart of wealth breakdown"></div>
          <div id="forbes-breakdown-table"></div>
          <section id="forbes-13f-section" class="forbes-panel forbes-13f-panel" hidden>
            <h4 class="forbes-journey-heading">13F public holdings</h4>
            <p id="forbes-13f-meta" class="forbes-13f-meta"></p>
            <div id="forbes-13f-table"></div>
          </section>
        </div>
        <div id="tab2" class="forbes-detail-tabpanel" role="tabpanel" hidden>
          <h3 class="forbes-journey-heading">Key Entities</h3>
          <div id="entitiesList" class="forbes-entity-grid"></div>
        </div>
        <div id="tab3" class="forbes-detail-tabpanel" role="tabpanel" hidden>
          <h3 class="forbes-journey-heading">Net Worth History</h3>
          <p id="forbes-history-empty" class="forbes-empty" hidden>No historical series for this rank.</p>
          <div id="historyChart" class="forbes-history-chart" role="img" aria-label="Line chart of estimated net worth by year"></div>
        </div>
      </div>`;
  }

  function ensureDetailShell(container) {
    if (!container) return;
    const modal = $('#modalContent', container);
    if (
      modal?.dataset.forbesDetailV2 === '2'
      && $('#forbes-story-timeline', container)
      && $('#forbes-story-wealth-chart', container)
      && $('#forbes-snowflake-chart', container)
      && $('#forbes-world-map', container)
    ) return;
    container.innerHTML = detailShellHtml();
  }

  function bindDetailTabs() {
    const modal = $('#modalContent');
    if (!modal || modal.dataset.tabsBound === 'true') return;
    modal.dataset.tabsBound = 'true';

    modal.querySelectorAll('.forbes-modal-tab').forEach((btn) => {
      btn.addEventListener('click', () => showTab(btn.dataset.tabIndex));
    });
  }

  function setListDrawer(open) {
    listDrawerOpen = open;
    const drawer = $('#forbes-list-drawer');
    const picker = $('#forbes-rank-picker');
    if (!drawer) return;

    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (picker) picker.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      requestAnimationFrame(() => {
        $('#forbes-search')?.focus();
        breakdownChart?.resize();
        historyChart?.resize();
      });
    } else {
      requestAnimationFrame(() => {
        breakdownChart?.resize();
        historyChart?.resize();
      });
    }
  }

  function bindListDrawer() {
    const drawer = $('#forbes-list-drawer');
    const detailEl = $('#forbes-detail');
    if (!drawer || drawer.dataset.bound === 'true') return;
    drawer.dataset.bound = 'true';

    $('#forbes-drawer-close')?.addEventListener('click', () => setListDrawer(false));

    detailEl?.addEventListener('click', (e) => {
      if (e.target.closest('#forbes-rank-picker')) setListDrawer(true);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && listDrawerOpen) {
        e.preventDefault();
        setListDrawer(false);
        $('#forbes-rank-picker')?.focus();
      }
    });
  }

  function syncUrl() {
    const person = findPerson(selectedKey);
    if (!person) return;
    const url = new URL(window.location.href);
    url.hash = `forbes?rank=${person.rank}&name=${encodeURIComponent(person.name)}`;
    history.replaceState(null, '', url);
    notifyProfileSelection(person);
  }

  function notifyProfileSelection(person) {
    window.dispatchEvent(new CustomEvent('forbes:select', { detail: { person } }));
  }

  function readSelectionFromUrl() {
    const hash = window.location.hash;
    const nameMatch = hash.match(/[?&]name=([^&]+)/);
    const rankMatch = hash.match(/[?&]rank=(\d+)/);

    if (nameMatch) {
      const name = decodeURIComponent(nameMatch[1]);
      const byName = billionaires.find((b) => b.name === name);
      if (byName) {
        selectedKey = personKey(byName);
        return;
      }
    }

    if (rankMatch) {
      const rank = Number(rankMatch[1]);
      const tied = billionaires.filter((b) => b.rank === rank);
      if (tied.length === 1) {
        selectedKey = personKey(tied[0]);
      } else if (tied.length > 1 && !nameMatch) {
        selectedKey = personKey(tied[0]);
      }
    }
  }

  function renderMeta(countEl) {
    if (!countEl) return;
    const q = searchQuery.trim();
    if (q) {
      countEl.textContent = `Showing ${filtered.length} of ${billionaires.length} profiles`;
      return;
    }
    const enriched = billionaires.filter((b) =>
      (b.wealthBreakdown || []).some((w) => w.stakePct != null),
    ).length;
    const historical = Object.keys(historicalByRank).length;
    const with13f = Object.keys(holdings13fByRank).length;
    countEl.textContent = `${billionaires.length} profiles · ${enriched} with stake breakdown · ${historical} with historical net worth · ${with13f} with 13F · schema v2`;
  }

  async function loadEntityCatalog() {
    try {
      const resp = await fetch(ENTITIES_URL);
      if (!resp.ok) return;
      const rows = await resp.json();
      entityCatalog = new Map(rows.filter((e) => e.id).map((e) => [e.id, e]));
    } catch {
      entityCatalog = new Map();
    }
  }

  async function load13fHoldings() {
    try {
      const resp = await fetch(HOLDINGS_13F_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      const ranks = Array.isArray(payload) ? payload : payload.ranks || [];
      holdings13fMeta = {
        asOf: payload.asOf,
        source: payload.source,
        note: payload.note,
      };
      holdings13fByRank = {};
      ranks.forEach((row) => {
        if (row?.rank != null) holdings13fByRank[String(row.rank)] = row;
      });
    } catch {
      holdings13fByRank = {};
      holdings13fMeta = null;
    }
  }

  async function loadHistoricalNetWorth() {
    try {
      const resp = await fetch(HISTORICAL_URL);
      if (!resp.ok) return;
      historicalByRank = await resp.json();
    } catch {
      historicalByRank = {};
    }
  }

  async function initForbesWealth() {
    const root = $('#forbes-wealth');
    const listEl = $('#forbes-list');
    const detailEl = $('#forbes-detail');
    const countEl = $('#forbes-count');
    const searchEl = $('#forbes-search');
    if (!root || !listEl || !detailEl) return;

    window.addEventListener('resize', () => {
      breakdownChart?.resize();
      historyChart?.resize();
      storyWealthChart?.resize();
      snowflakeChart?.resize();
      worldMapChart?.resize();
    });

    try {
      await Promise.all([
        loadEntityCatalog(),
        loadHistoricalNetWorth(),
        load13fHoldings(),
        loadBuyingPowerCatalog(),
        loadWorldContext(),
        loadEntityLocations(),
      ]);
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      billionaires = await resp.json();
      billionaires.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      if (!selectedKey && billionaires.length) {
        selectedKey = personKey(billionaires[0]);
      }
    } catch (err) {
      root.classList.add('forbes-error');
      root.innerHTML = `<p class="forbes-empty">Could not load ${DATA_URL}: ${escapeHtml(err.message)}</p>`;
      return;
    }

    readSelectionFromUrl();
    applyFilter();
    ensureDetailShell(detailEl);
    bindListDrawer();
    bindDetailTabs();
    renderMeta(countEl);
    renderList(listEl);
    renderDetail(detailEl);
    notifyProfileSelection(findPerson(selectedKey));

    if (searchEl) {
      searchEl.addEventListener('input', () => {
        searchQuery = searchEl.value;
        applyFilter();
        renderMeta(countEl);
        renderList(listEl);
        renderDetail(detailEl);
        notifyProfileSelection(findPerson(selectedKey));
      });
    }

    window.addEventListener('hashchange', () => {
      readSelectionFromUrl();
      renderList(listEl);
      renderDetail(detailEl);
      notifyProfileSelection(findPerson(selectedKey));
    });
  }

  window.showTab = showTab;
  window.Forbes13F = {
    forRank: (rank) => holdings13fForRank(rank),
    meta: () => holdings13fMeta,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForbesWealth);
  } else {
    initForbesWealth();
  }
})();
