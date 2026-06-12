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

  function historicalSeries(rank) {
    return historicalByRank[String(rank)] || null;
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

    const years = series.map((p) => p.year);
    const values = series.map((p) => p.netWorthB);

    historyChart = echarts.init(el, null, { renderer: 'canvas' });
    historyChart.setOption({
      backgroundColor: 'transparent',
      color: ['#171717'],
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `${p.name}: $${p.value}B`;
        },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: years,
        boundaryGap: false,
        axisLabel: { color: '#737373', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.12)' } },
      },
      yAxis: {
        type: 'value',
        name: 'Net Worth (B USD)',
        nameTextStyle: { color: '#737373', fontSize: 10 },
        axisLabel: { color: '#737373', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
      },
      series: [
        {
          name: 'Net worth',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: '#171717' },
          itemStyle: { color: '#171717' },
          areaStyle: { color: 'rgba(0, 0, 0, 0.06)' },
          data: values,
        },
      ],
    });
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

  function renderStoryTab(person) {
    const tab0 = $('#tab0');
    if (!tab0) return;

    tab0.innerHTML = `
      <section class="forbes-panel">
        <h4 class="forbes-journey-heading">Wealth journey</h4>
        ${renderTimeline(person.timeline)}
      </section>`;
  }

  function renderHistoryTab(person) {
    renderHistoryChart(person);
  }

  function renderPortfolioTab(person) {
    const tableEl = $('#forbes-breakdown-table');
    const grokBtn = $('#grokipediaBtn');
    if (tableEl) {
      tableEl.innerHTML = renderWealthBreakdownTable(person.wealthBreakdown);
    }
    render13fSection(person);
    if (grokBtn) {
      if (person.grokipediaLink) {
        grokBtn.href = person.grokipediaLink;
        grokBtn.hidden = false;
      } else {
        grokBtn.hidden = true;
      }
    }
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

    renderDetailLinks(person);
    renderFacts(person);
    renderStoryTab(person);
    renderPortfolioTab(person);
    renderEntitiesTab(person);
    renderHistoryTab(person);
    showTab(tabIndex(detailTab));
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
    document.body.classList.toggle('forbes-drawer-open', open);

    if (open) {
      requestAnimationFrame(() => $('#forbes-search')?.focus());
    }
  }

  function bindListDrawer() {
    const drawer = $('#forbes-list-drawer');
    const detailEl = $('#forbes-detail');
    if (!drawer || drawer.dataset.bound === 'true') return;
    drawer.dataset.bound = 'true';

    $('#forbes-drawer-close')?.addEventListener('click', () => setListDrawer(false));
    drawer.querySelector('.forbes-list-backdrop')?.addEventListener('click', () => setListDrawer(false));

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
    });

    try {
      await Promise.all([loadEntityCatalog(), loadHistoricalNetWorth(), load13fHoldings()]);
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
