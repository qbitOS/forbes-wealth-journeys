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
  const LIFE_EVENTS_URL = 'data/profile-life-events.json';
  const PHYSIQUE_URL = 'data/profile-physique.json';
  const GEO_LOCATIONS_URL = 'data/entity-locations.json';
  const PERSONAL_LIFE_CATEGORIES = new Set(['marriage', 'divorce', 'dating', 'family', 'lawsuit', 'life']);
  const CONTEXT_CHIP_ORDER = {
    marriage: 1,
    divorce: 2,
    dating: 3,
    family: 4,
    lawsuit: 5,
    life: 6,
    wealth: 7,
    history: 8,
    science: 9,
    space: 10,
    tribal: 11,
    migration: 12,
  };
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
  let storyChartPerson = null;
  let storyChartOverlays = { life: false, losses: false };
  const LIFE_CHART_COLORS = {
    marriage: '#be185d',
    divorce: '#6b7280',
    dating: '#db2777',
    family: '#0f766e',
    lawsuit: '#b91c1c',
    life: '#7c3aed',
  };
  let snowflakeChart = null;
  let worldMapChart = null;
  let worldGeoReady = false;
  let entityLocations = { entities: {}, countries: {} };
  let buyingPowerTargets = [];
  let worldEventsByYear = new Map();
  let sectorEventsBySector = {};
  let profileLifeByRank = {};
  let profilePhysiqueByRank = {};
  let profilePhysiqueMeta = null;
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
    renderPhysiquePanel(person);
    renderSnowflakeChart(person);
    renderBuyingPowerList(person);
  }

  function normalizeEntityKey(raw) {
    if (!raw) return '';
    const norm = String(raw).toLowerCase().trim();
    const aliases = {
      'the boring company': 'boring-co',
      'boring company': 'boring-co',
      'x corp': 'x-corp',
      'x corp.': 'x-corp',
      x: 'x-corp',
      twitter: 'x-corp',
      xai: 'xai',
      'x.ai': 'xai',
      facebook: 'meta',
      'berkshire hathaway': 'berkshire',
      "l'oréal": 'loreal',
      loreal: "loreal",
      mars: 'mars-inc',
      'red bull': 'red_bull',
      'las vegas sands': 'lvs',
      uniqlo: 'fast-retailing',
    };
    if (aliases[norm]) return aliases[norm];
    return norm.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function entityLocForKey(key) {
    if (!key) return null;
    const id = normalizeEntityKey(key);
    return entityLocations.entities?.[id] || entityLocations.entities?.[String(key).toLowerCase().trim()] || null;
  }

  function entityLocForName(name) {
    if (!name) return null;
    const id = normalizeEntityKey(name);
    const direct = entityLocations.entities?.[id];
    if (direct) return direct;
    const norm = String(name).toLowerCase();
    for (const [entId, loc] of Object.entries(entityLocations.entities || {})) {
      const label = String(loc.label || entId).toLowerCase();
      if (norm.includes(entId) || entId.includes(norm.replace(/[^a-z0-9]/g, ''))) return loc;
      if (label.includes(norm) || norm.includes(label.split('·')[0].trim())) return loc;
    }
    return null;
  }

  function jitterLngLat(lng, lat, seed, index = 0) {
    let h = index * 9973;
    const s = String(seed);
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const angle = (h % 360) * (Math.PI / 180);
    const r = 0.35 + (h % 4) * 0.12;
    return [lng + Math.cos(angle) * r, lat + Math.sin(angle) * r * 0.55];
  }

  function buildVentureMapPoints(person) {
    const points = [];
    const seen = new Set();

    const add = (lng, lat, label, meta = {}) => {
      if (lng == null || lat == null || !label) return;
      const idKey = normalizeEntityKey(meta.key || label);
      if (seen.has(idKey)) return;
      seen.add(idKey);
      const [jLng, jLat] = jitterLngLat(lng, lat, idKey, seen.size);
      points.push({ name: label, value: [jLng, jLat], ...meta, key: idKey });
    };

    const addFromKey = (key, label) => {
      const loc = entityLocForKey(key) || entityLocForName(label || key);
      if (!loc) return;
      add(loc.lng, loc.lat, loc.label || label || key, { kind: 'venture', key: key || label });
    };

    (person.entities || []).forEach((ent) => addFromKey(ent.id, ent.name));
    (person.timeline || []).forEach((ev) => {
      if (ev.entityId) addFromKey(ev.entityId, ev.title);
    });
    (person.wealthBreakdown || []).forEach((row) => addFromKey(row.entity, row.entity));
    (person.companies || []).forEach((name) => addFromKey(name, name));

    const home = entityLocations.countries?.[person.country];
    if (home) {
      add(home.lng, home.lat, `${person.name} · ${person.country}`, { kind: 'home', key: `home-${person.rank}` });
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

    const ventureCount = ventures.filter((p) => p.kind === 'venture').length;

    if (legendEl) {
      legendEl.hidden = false;
      legendEl.innerHTML = `
        <span class="forbes-map-legend-item"><i class="forbes-map-dot is-home"></i> Residence</span>
        <span class="forbes-map-legend-item"><i class="forbes-map-dot is-venture"></i> Ventures (${ventureCount})</span>
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

  async function loadProfileLifeEvents() {
    try {
      const resp = await fetch(LIFE_EVENTS_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      profileLifeByRank = payload.profiles || {};
    } catch {
      profileLifeByRank = {};
    }
  }

  function sortContextEvents(events) {
    return [...events].sort((a, b) => {
      const ao = CONTEXT_CHIP_ORDER[a.category] ?? 99;
      const bo = CONTEXT_CHIP_ORDER[b.category] ?? 99;
      if (ao !== bo) return ao - bo;
      return String(a.label).localeCompare(String(b.label));
    });
  }

  function profileLifeForYear(person, year) {
    const events = profileLifeByRank[String(person.rank)] || [];
    return events.filter((ev) => ev.year === year);
  }

  async function loadProfilePhysique() {
    try {
      const resp = await fetch(PHYSIQUE_URL);
      if (!resp.ok) return;
      const payload = await resp.json();
      profilePhysiqueByRank = payload.profiles || {};
      profilePhysiqueMeta = { ancestoryUrl: payload.ancestoryUrl };
    } catch {
      profilePhysiqueByRank = {};
      profilePhysiqueMeta = null;
    }
  }

  function physiqueForPerson(person) {
    const catalog = profilePhysiqueByRank[String(person.rank)];
    const ancestoryUrl =
      profilePhysiqueMeta?.ancestoryUrl
      || ancestoryMeta?.ancestoryUrl
      || 'https://fornevercollective.github.io/ancestory/';
    if (catalog) return { ...catalog, ancestoryUrl, isFallback: false };

    return {
      height: '—',
      stature: 'Not cataloged',
      faceShape: 'oval',
      faceDetail: 'Add face shape in profile-physique.json',
      hair: '—',
      eyes: '—',
      build: '—',
      heritage: person.country || '—',
      birthplace: person.country || '—',
      citizenship: person.country || '—',
      languages: '—',
      notes: `Rank #${person.rank} — extend data/profile-physique.json for height, stature, and AnCEstory-style traits.`,
      tags: [person.sector, person.sourceOfWealth].filter(Boolean).slice(0, 3),
      ancestoryUrl,
      isFallback: true,
    };
  }

  function faceShapeSvg(shape) {
    const s = String(shape || 'oval').toLowerCase();
    const paths = {
      oval: '<ellipse cx="24" cy="28" rx="15" ry="21" />',
      round: '<circle cx="24" cy="28" r="17" />',
      square: '<rect x="9" y="13" width="30" height="32" rx="5" />',
      angular: '<polygon points="24,9 38,24 34,47 14,47 10,24" />',
      heart: '<path d="M24 48 C10 36 6 26 12 18 C16 13 24 16 24 16 C24 16 32 13 36 18 C42 26 38 36 24 48 Z" transform="translate(0,-6) scale(0.85) translate(3.6,4)" />',
    };
    const inner = paths[s] || paths.oval;
    return `<svg class="forbes-physique-face-svg" viewBox="0 0 48 56" aria-hidden="true" focusable="false">${inner}</svg>`;
  }

  function renderPhysiquePanel(person) {
    const panel = $('#forbes-physique-panel');
    if (!panel || !person) return;

    const p = physiqueForPerson(person);
    const tags = (p.tags || [])
      .map((t) => `<span class="forbes-physique-tag">${escapeHtml(t)}</span>`)
      .join('');
    const fields = [
      ['Height', p.height],
      ['Stature', p.stature],
      ['Face', p.faceDetail || p.faceShape],
      ['Build', p.build],
      ['Hair', p.hair],
      ['Eyes', p.eyes],
      ['Heritage', p.heritage],
      ['Born', p.birthplace],
      ['Citizenship', p.citizenship],
      ['Languages', p.languages],
    ].filter(([, val]) => val && val !== '—');

    panel.hidden = false;
    panel.innerHTML = `
      <h4 class="forbes-worth-physique-title">Physique · AnCEstory profile</h4>
      <div class="forbes-physique-card${p.isFallback ? ' is-fallback' : ''}">
        <div class="forbes-physique-visual" aria-hidden="true">
          ${faceShapeSvg(p.faceShape)}
          <span class="forbes-physique-face-label">${escapeHtml(p.faceShape || 'oval')}</span>
        </div>
        <div class="forbes-physique-body">
          <dl class="forbes-physique-grid">
            ${fields
              .map(
                ([label, val]) =>
                  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(val)}</dd></div>`,
              )
              .join('')}
          </dl>
          ${p.notes ? `<p class="forbes-physique-notes">${escapeHtml(p.notes)}</p>` : ''}
          ${tags ? `<div class="forbes-physique-tags">${tags}</div>` : ''}
          <p class="forbes-physique-source">
            Public biographical layer · paired with
            <a href="${escapeHtml(p.ancestoryUrl)}" target="_blank" rel="noopener">AnCEstory</a>
            life timelines
          </p>
        </div>
      </div>`;
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

  function selectedFilteredIndex() {
    return filtered.findIndex((b) => personKey(b) === selectedKey);
  }

  function navigateFilteredRank(delta) {
    const idx = selectedFilteredIndex();
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= filtered.length) return;
    selectedKey = personKey(filtered[nextIdx]);
    renderList($('#forbes-list'));
    renderDetail($('#forbes-detail'));
    syncUrl();
  }

  function updateRankNavButtons() {
    const idx = selectedFilteredIndex();
    const nextBtn = $('#forbes-rank-next');
    if (nextBtn) nextBtn.disabled = idx < 0 || idx >= filtered.length - 1;
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
    const profileLife = profileLifeByRank[String(person.rank)] || [];
    const hasBirthMarker = profileLife.some(
      (ev) => ev.year === birth && ev.category === 'family' && /born/i.test(ev.label),
    );
    if (year === birth && !hasBirthMarker) {
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
    const personal = profileLifeForYear(person, year);
    return sortContextEvents([...life, ...personal, ...global, ...sector]);
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
    const personal = events.filter((ev) => PERSONAL_LIFE_CATEGORIES.has(ev.category));
    const world = events.filter((ev) => !PERSONAL_LIFE_CATEGORIES.has(ev.category));
    let html = '';
    if (personal.length) {
      html += `<div class="forbes-ancestry-layer forbes-ancestry-layer-personal" aria-label="Personal life">${personal.map((ev) => renderAncestryChip(ev)).join('')}</div>`;
    }
    if (world.length) {
      html += `<div class="forbes-ancestry-layer forbes-ancestry-layer-world" aria-label="World and sector context">${world.map((ev) => renderAncestryChip(ev)).join('')}</div>`;
    }
    return html;
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
        <p class="forbes-ancestry-lead">Personal life, world history, and sector context layered on net worth — marriage, family, lawsuits, and milestones alongside <a href="${escapeHtml(ancestoryMeta?.ancestoryUrl || 'https://fornevercollective.github.io/ancestory/')}" target="_blank" rel="noopener">AnCEstory</a>-style markers.</p>
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

  function netWorthChartOption(series, { compact = false, markByYear = {}, extraMarkPoints = [] } = {}) {
    const years = series.map((p) => p.year);
    const values = series.map((p) => p.netWorthB);
    const milestonePoints = series
      .filter((p) => markByYear[p.year])
      .map((p) => ({
        name: markByYear[p.year],
        coord: [p.year, p.netWorthB],
        value: markByYear[p.year],
        symbol: 'pin',
        symbolSize: compact ? 22 : 42,
        itemStyle: { color: '#b45309' },
        label: { show: false },
      }));
    const markPoints = [...milestonePoints, ...extraMarkPoints];
    const lossByYear = {};
    extraMarkPoints
      .filter((p) => p.kind === 'loss')
      .forEach((p) => {
        lossByYear[p.coord[0]] = p.value;
      });
    const lifeByYear = {};
    extraMarkPoints
      .filter((p) => p.kind === 'life')
      .forEach((p) => {
        if (!lifeByYear[p.coord[0]]) lifeByYear[p.coord[0]] = [];
        lifeByYear[p.coord[0]].push(p.name);
      });

    return {
      backgroundColor: 'transparent',
      color: ['#171717'],
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          const year = Number(p.name);
          const parts = [`${p.name}: $${p.value}B`];
          const milestone = markByYear[year];
          if (milestone) parts.push(`<strong>Milestone:</strong> ${escapeHtml(milestone)}`);
          if (lifeByYear[year]?.length) {
            parts.push(`<strong>Life:</strong> ${lifeByYear[year].map((s) => escapeHtml(s)).join(' · ')}`);
          }
          if (lossByYear[year]) parts.push(`<strong>Loss:</strong> ${escapeHtml(lossByYear[year])}`);
          return parts.join('<br/>');
        },
      },
      grid: {
        left: 8,
        right: compact ? 8 : 16,
        top: compact ? (extraMarkPoints.length ? 28 : 8) : 16,
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
                label: { show: false },
                data: markPoints,
              }
            : undefined,
        },
      ],
    };
  }

  function netWorthByYearMap(series) {
    return Object.fromEntries(series.map((p) => [p.year, p.netWorthB]));
  }

  function detectMajorLosses(series, thresholdPct = 12) {
    const losses = [];
    for (let i = 1; i < series.length; i += 1) {
      const prev = series[i - 1].netWorthB;
      const curr = series[i].netWorthB;
      if (prev <= 0 || curr >= prev) continue;
      const pct = ((curr - prev) / prev) * 100;
      if (pct <= -thresholdPct) {
        losses.push({ year: series[i].year, netWorthB: curr, pct });
      }
    }
    return losses;
  }

  function buildLifeEventMarkPoints(person, series) {
    const nwByYear = netWorthByYearMap(series);
    const events = profileLifeByRank[String(person.rank)] || [];
    return events
      .map((ev, idx) => {
        const val = nwByYear[ev.year];
        if (val == null) return null;
        const color = LIFE_CHART_COLORS[ev.category] || '#be185d';
        return {
          kind: 'life',
          name: ev.label,
          coord: [ev.year, val],
          value: ev.label,
          symbol: 'circle',
          symbolSize: 9,
          symbolOffset: [idx % 2 ? 6 : -6, -8 - (idx % 3) * 4],
          itemStyle: { color: '#fff', borderColor: color, borderWidth: 2 },
          emphasis: { itemStyle: { color, borderColor: color } },
        };
      })
      .filter(Boolean);
  }

  function buildLossMarkPoints(series) {
    return detectMajorLosses(series).map((loss, idx) => ({
      kind: 'loss',
      name: `${loss.pct.toFixed(0)}% YoY drop`,
      coord: [loss.year, loss.netWorthB],
      value: `${loss.pct.toFixed(0)}% YoY`,
      symbol: 'triangle',
      symbolRotate: 180,
      symbolSize: 11,
      symbolOffset: [idx % 2 ? 5 : -5, 6],
      itemStyle: { color: '#dc2626', shadowBlur: 4, shadowColor: 'rgba(220,38,38,0.35)' },
    }));
  }

  function storyChartExtraMarkPoints(person, series) {
    const extra = [];
    if (storyChartOverlays.life) extra.push(...buildLifeEventMarkPoints(person, series));
    if (storyChartOverlays.losses) extra.push(...buildLossMarkPoints(series));
    return extra;
  }

  function syncStoryChartToolbar(visible) {
    const toolbar = $('#forbes-story-chart-toolbar');
    const lifeToggle = $('#forbes-story-toggle-life');
    const lossesToggle = $('#forbes-story-toggle-losses');
    if (toolbar) toolbar.hidden = !visible;
    if (lifeToggle) lifeToggle.checked = storyChartOverlays.life;
    if (lossesToggle) lossesToggle.checked = storyChartOverlays.losses;
  }

  function bindStoryChartToggles() {
    if (document.body.dataset.storyChartTogglesBound === '1') return;
    document.body.dataset.storyChartTogglesBound = '1';
    document.addEventListener('change', (e) => {
      if (e.target?.id === 'forbes-story-toggle-life') {
        storyChartOverlays.life = e.target.checked;
        if (storyChartPerson) renderStoryWealthChart(storyChartPerson);
      }
      if (e.target?.id === 'forbes-story-toggle-losses') {
        storyChartOverlays.losses = e.target.checked;
        if (storyChartPerson) renderStoryWealthChart(storyChartPerson);
      }
    });
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

    storyChartPerson = person;
    const series = expandHistoricalSeries(historicalSeries(person.rank));
    if (!series.length) {
      disposeStoryWealthChart();
      el.innerHTML = '';
      el.hidden = true;
      syncStoryChartToolbar(false);
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    el.hidden = false;
    syncStoryChartToolbar(true);

    if (!storyWealthChart) {
      el.innerHTML = '';
      storyWealthChart = echarts.init(el, null, { renderer: 'canvas' });
    }

    const extraMarkPoints = storyChartExtraMarkPoints(person, series);
    storyWealthChart.setOption(
      netWorthChartOption(series, {
        compact: true,
        markByYear: milestoneMarkMap(person),
        extraMarkPoints,
      }),
      true,
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
    updateRankNavButtons();
    showTab(tabIndex(detailTab));
  }

  function detailShellHtml() {
    return `
      <p id="forbes-detail-empty" class="forbes-empty">Select a person from the rankings.</p>
      <div id="modalContent" class="forbes-modal-content" data-forbes-detail-v2="5" hidden>
        <header class="forbes-detail-header">
          <div class="forbes-detail-nav">
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
            <button type="button" id="forbes-rank-next" class="forbes-rank-nav" aria-label="Next rank">
              Next →
            </button>
          </div>
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
            <section id="forbes-physique-panel" class="forbes-worth-physique-panel" aria-label="Physique and AnCEstory-style profile" hidden></section>
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
                <div class="forbes-story-chart-block">
                  <div id="forbes-story-chart-toolbar" class="forbes-story-chart-toolbar" hidden>
                    <span class="forbes-story-chart-toolbar-label">Chart overlays</span>
                    <label class="forbes-story-chart-toggle">
                      <input type="checkbox" id="forbes-story-toggle-life" />
                      Life events
                    </label>
                    <label class="forbes-story-chart-toggle">
                      <input type="checkbox" id="forbes-story-toggle-losses" />
                      Major losses
                    </label>
                  </div>
                  <div id="forbes-story-wealth-chart" class="forbes-story-wealth-chart" role="img" aria-label="Year-by-year net worth chart" hidden></div>
                </div>
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
      modal?.dataset.forbesDetailV2 === '5'
      && $('#forbes-story-timeline', container)
      && $('#forbes-story-wealth-chart', container)
      && $('#forbes-story-chart-toolbar', container)
      && $('#forbes-rank-next', container)
      && $('#forbes-snowflake-chart', container)
      && $('#forbes-world-map', container)
      && $('#forbes-physique-panel', container)
    ) return;
    disposeStoryWealthChart();
    storyChartPerson = null;
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
      if (e.target.closest('#forbes-rank-next')) return;
      if (e.target.closest('#forbes-rank-picker')) setListDrawer(true);
    });

    if (document.body.dataset.forbesRankNavBound !== '1') {
      document.body.dataset.forbesRankNavBound = '1';
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#forbes-rank-next')) return;
        e.preventDefault();
        navigateFilteredRank(1);
      });
    }

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
        loadProfileLifeEvents(),
        loadProfilePhysique(),
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
    bindStoryChartToggles();
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
