/**
 * Industry stream — unified Forbes wealth × crossover view
 * Data: data/industry-stream.json · sector: data/sector-activity/
 */
(function () {
  'use strict';

  const DATA_URL = 'data/industry-stream.json';
  const SECTOR_INDEX = 'data/sector-activity/index.json';

  const KIND_LABELS = {
    flip: 'Flip',
    grok_branch: 'Grok',
    milestone: 'Milestone',
    world: 'World',
  };

  const KIND_COLORS = {
    flip: () => FWJColor.kind('flip'),
    grok_branch: () => FWJColor.kind('grok_branch'),
    milestone: () => FWJColor.kind('milestone'),
    world: () => FWJColor.kind('world'),
  };

  function kindColor(kind) {
    const resolver = KIND_COLORS[kind];
    return resolver ? resolver() : FWJColor.token('--fwj-accent', '#78a9ff');
  }

  const FLIP_SHORT = {
    macd_bullish: 'MACD↑',
    macd_bearish: 'MACD↓',
    histogram_bullish: 'Hist↑',
    histogram_bearish: 'Hist↓',
    bb_upper_breakout: 'BB↑brk',
    bb_upper_reentry: 'BB↑↩',
    bb_lower_breakdown: 'BB↓brk',
    bb_lower_reentry: 'BB↓↩',
    bb_middle_bullish: 'SMA↑',
    bb_middle_bearish: 'SMA↓',
  };

  let data = null;
  const state = {
    filterTicker: null,
    filterRank: null,
    filterBranch: null,
    kinds: new Set(['flip', 'grok_branch', 'milestone', 'world']),
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function biasKind(bias) {
    if (!bias) return 'neutral';
    const b = String(bias).toLowerCase();
    if (b.includes('bull')) return 'bull';
    if (b.includes('bear')) return 'bear';
    return 'neutral';
  }

  function flipLabel(type) {
    return FLIP_SHORT[type] || (type || '—').replace(/_/g, ' ');
  }

  function scoreLevel(n) {
    if (n >= 60) return 'high';
    if (n >= 35) return 'mid';
    return 'low';
  }

  function linkedFilter(ev) {
    if (state.filterBranch && ev.branch !== state.filterBranch && ev.kind !== 'grok_branch') {
      if (!ev.tags?.includes(state.filterBranch)) return false;
    }
    if (state.filterRank != null && ev.forbesRank !== state.filterRank) {
      if (ev.kind === 'grok_branch' || ev.kind === 'world') {
        /* keep industry context visible */
      } else if (ev.forbesRank !== state.filterRank) return false;
    }
    if (state.filterTicker) {
      if (ev.ticker === state.filterTicker) return true;
      const link = (data?.interlinks || []).find((r) => r.ticker === state.filterTicker);
      if (link) {
        if (ev.entity && link.entity && ev.entity.toLowerCase() === link.entity.toLowerCase()) return true;
        if (ev.forbesRank === link.forbesRank && ev.kind === 'milestone') return true;
        if (ev.branch && (link.branches || []).includes(ev.branch)) return true;
      }
      if (ev.kind === 'grok_branch' || ev.kind === 'world') return true;
      return false;
    }
    return true;
  }

  function filteredStream() {
    if (!data?.stream) return [];
    return data.stream.filter((ev) => state.kinds.has(ev.kind) && linkedFilter(ev));
  }

  function updateFilterLabel() {
    const el = $('#stream-filter-label');
    if (!el) return;
    const parts = [];
    if (state.filterTicker) parts.push(state.filterTicker);
    if (state.filterRank != null) parts.push(`#${state.filterRank}`);
    if (state.filterBranch) parts.push(state.filterBranch);
    el.textContent = parts.length ? parts.join(' · ') : 'All events';
  }

  function renderMeta() {
    const el = $('#through-line-meta') || $('#industry-meta');
    if (!el || !data) return;
    const tl = data.throughLineSummary;
    if (tl?.winner || tl?.winPct != null || tl?.alignmentPct != null) {
      const parts = [];
      const pct = tl.alignmentPct ?? tl.winPct;
      const pctLabel = tl.alignmentPct != null ? 'alignment' : 'signal win';
      if (pct != null) parts.push(`${Math.round(pct)}% ${pctLabel}`);
      if (tl.winner) {
        parts.push(tl.winnerDetail ? `${tl.winner} leads (${tl.winnerDetail})` : `${tl.winner} leads`);
      }
      if (tl.totalFlips) parts.push(`${tl.totalFlips} flips`);
      el.textContent = parts.join(' · ');
      return;
    }
    const s = data.summary || {};
    const parts = [
      `${s.streamEvents ?? 0} events`,
      `${s.compressionSymbols ?? 0} compression`,
      `${s.interlinks ?? 0} interlinks`,
      `as of ${data.asOf || '—'}`,
    ];
    if (s.winner) {
      parts.splice(1, 0, s.winRate != null ? `${s.winner} ${s.winRate}%` : s.winner);
    }
    if (s.potentialPct != null) {
      const sign = s.potentialPct > 0 ? '+' : '';
      parts.splice(parts.length - 1, 0, `${sign}${s.potentialPct}% pot`);
    }
    el.textContent = parts.join(' · ');
  }

  function renderThroughLineSummary() {
    const el = $('#through-line-summary');
    if (!el || !data) return;
    const tl = data.throughLineSummary;
    if (!tl) {
      el.textContent = '';
      return;
    }
    const parts = [];
    const pct = tl.alignmentPct ?? tl.winPct;
    const pctLabel = tl.alignmentPct != null ? 'alignment' : 'signal win';
    if (pct != null) {
      parts.push(`<span class="through-stat-pct">${Math.round(pct)}%</span> ${pctLabel}`);
    }
    if (tl.winner) {
      const detail = tl.winnerDetail ? ` (${escapeHtml(tl.winnerDetail)})` : '';
      parts.push(`<strong class="through-stat-winner">${escapeHtml(tl.winner)}</strong> leads${detail}`);
    }
    if (tl.totalFlips) parts.push(`${tl.totalFlips} flips`);
    el.innerHTML = parts.join(' · ');
  }

  function renderCompressionMeta() {
    const el = $('#compression-meta');
    if (!el || !data) return;
    const s = data.compressionSummary;
    if (!s?.totalTickers) {
      el.textContent = '';
      return;
    }
    const tie = s.tiedAtTop > 1 ? ` · ${s.tiedAtTop}-way tie` : '';
    const entity = s.winnerEntity ? ` · ${escapeHtml(s.winnerEntity)}` : '';
    el.innerHTML = `<strong class="meta-winner">${escapeHtml(s.winner)}</strong> leads${entity}${tie} · ${s.winPct}% squeeze · avg ${s.avgSqueezePct}% · ${s.totalTickers} tickers`;
  }

  function renderThroughLine() {
    const root = $('#through-line-cards');
    if (!root || !data) return;
    const items = data.narratives || [];
    if (!items.length) {
      root.innerHTML = '<p class="muted">Rebuild with forbes_crossover.py for lifecycle↔flip alignments.</p>';
      return;
    }
    root.innerHTML = items
      .map(
        (n) => `
      <article class="through-card"${n.branch ? ` data-branch="${escapeHtml(n.branch)}"` : ''}>
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.subtitle || '')}${n.daysApart != null ? ` · ${n.daysApart}d apart` : ''}</p>
        ${n.ticker ? `<ul class="through-refs"><li>${escapeHtml(n.ticker)}${n.entity ? ` · ${escapeHtml(n.entity)}` : ''}</li></ul>` : ''}
      </article>`
      )
      .join('');
  }

  function renderCompression() {
    const root = $('#compression-grid');
    if (!root || !data?.compression) return;
    const rows = data.compression;
    if (!rows.length) {
      root.innerHTML = '<p class="muted">No Q/M/W/D data — pass flip-board rows to build_industry_stream.py</p>';
      return;
    }
    const tfOrder = ['quarter', 'month', 'week', 'day'];
    const tfLabel = { quarter: 'Q', month: 'M', week: 'W', day: 'D' };
    root.innerHTML = rows
      .map((c) => {
        const tfs = c.timeframes || {};
        const frames = tfOrder
          .map((tf) => {
            const f = tfs[tf];
            if (!f) {
              return `<div class="frame-badge empty"><span class="frame-tf">${tfLabel[tf]}</span><span class="frame-flip">—</span></div>`;
            }
            const flip = f.lastFlip?.label || flipLabel(f.lastFlip?.type);
            return `
            <div class="frame-badge">
              <span class="frame-tf">${tfLabel[tf]}</span>
              <span class="frame-flip">${escapeHtml(flip)}</span>
              <span class="frame-pill" data-kind="${biasKind(f.macdBias)}">${escapeHtml(f.macdBias || '—')}</span>
            </div>`;
          })
          .join('');
        const active = state.filterTicker === c.ticker ? ' active' : '';
        const level = scoreLevel(c.squeezeScore || 0);
        return `
        <article class="compression-card${active}" data-ticker="${escapeHtml(c.ticker)}" tabindex="0">
          <header class="compression-head">
            <div>
              <span class="compression-ticker">${escapeHtml(c.ticker)}</span>
              <span class="compression-entity">${escapeHtml(c.entity || c.name)}</span>
            </div>
            <div class="compression-score-wrap">
              <span class="compression-score" data-level="${level}">${c.squeezeScore ?? 0}</span>
              <span class="compression-score-label">squeeze</span>
            </div>
          </header>
          <p class="compression-meta">#${c.forbesRank ?? '—'} ${escapeHtml(c.forbesName || '')} · ${escapeHtml(c.sector || '')}</p>
          <div class="compression-frames">${frames}</div>
        </article>`;
      })
      .join('');

    root.querySelectorAll('.compression-card').forEach((card) => {
      const pick = () => {
        const t = card.dataset.ticker;
        state.filterTicker = state.filterTicker === t ? null : t;
        state.filterRank = null;
        state.filterBranch = null;
        updateFilterLabel();
        renderCompression();
        renderInterplay();
        renderStream();
      };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
    });
  }

  function renderInterplayMeta() {
    const el = $('#interplay-meta');
    if (!el || !data) return;
    const s = data.interplaySummary;
    if (s?.totalLinks) {
      const tie = s.tiedAtTop > 1 ? ` · ${s.tiedAtTop}-way tie` : '';
      const entity = s.winnerEntity ? ` · ${escapeHtml(s.winnerEntity)}` : '';
      const rank = s.winnerRank ? ` · #${s.winnerRank}` : '';
      const pct = s.winPct != null ? ` · ${s.winPct}% stake` : '';
      el.innerHTML = `<strong class="meta-winner">${escapeHtml(s.winner || s.winnerName || '—')}</strong>${rank}${entity}${tie}${pct} · ${s.totalLinks} interlinks`;
      return;
    }
    const n = data.summary?.interlinks ?? data.interlinks?.length ?? 0;
    if (!n) {
      el.textContent = '';
      return;
    }
    el.textContent = `${n} interlinks`;
  }

  function renderInterplay() {
    const root = $('#interplay-rows');
    if (!root || !data?.interlinks) return;
    const byRank = new Map();
    for (const row of data.interlinks) {
      const r = row.forbesRank;
      if (!byRank.has(r)) {
        byRank.set(r, { rank: r, name: row.forbesName, sector: row.sector, entities: [] });
      }
      byRank.get(r).entities.push(row);
    }

    let ranks = [...byRank.values()].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    if (state.filterTicker) {
      ranks = ranks
        .map((g) => ({ ...g, entities: g.entities.filter((e) => e.ticker === state.filterTicker) }))
        .filter((g) => g.entities.length);
    }

    root.innerHTML = ranks
      .slice(0, 40)
      .map((g) => {
        const active = state.filterRank === g.rank ? ' active' : '';
        return `
        <article class="interplay-row${active}" data-rank="${g.rank}">
          <header class="interplay-head">
            <span class="interplay-rank">#${g.rank}</span>
            <span class="interplay-name">${escapeHtml(g.name)}</span>
            <span class="interplay-sector">${escapeHtml(g.sector || '')}</span>
          </header>
          <div class="interplay-entities">
            ${g.entities
              .map((e) => {
                const m = e.market || {};
                const flip = m.lastFlip?.type ? flipLabel(m.lastFlip.type) : '';
                return `
              <button type="button" class="interplay-entity" data-ticker="${escapeHtml(e.ticker || '')}" data-rank="${g.rank}">
                <span class="interplay-entity-ticker">${escapeHtml(e.ticker || 'private')}</span>
                <span class="interplay-entity-name">${escapeHtml(e.entity || '')}</span>
                ${flip ? `<span class="interplay-flip" data-kind="${biasKind(m.macdBias)}">${escapeHtml(flip)}</span>` : ''}
                ${e.squeezeScore != null ? `<span class="interplay-squeeze">sq ${e.squeezeScore}</span>` : ''}
              </button>`;
              })
              .join('')}
          </div>
        </article>`;
      })
      .join('');

    root.querySelectorAll('.interplay-entity').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = btn.dataset.ticker;
        state.filterTicker = t || null;
        state.filterRank = Number(btn.dataset.rank) || null;
        updateFilterLabel();
        renderCompression();
        renderInterplay();
        renderStream();
      });
    });
  }

  function renderStreamFilters() {
    const root = $('#stream-filters');
    if (!root) return;
    const branches = ['colossus', 'terrafab', 'grok', 'spacex-ipo', 'tesla', 'spacex-ops'];
    root.innerHTML = branches
      .map(
        (b) =>
          `<button type="button" class="stream-filter-chip${state.filterBranch === b ? ' active' : ''}" data-branch="${b}">${escapeHtml(b)}</button>`
      )
      .join('');
    root.querySelectorAll('.stream-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const b = chip.dataset.branch;
        state.filterBranch = state.filterBranch === b ? null : b;
        updateFilterLabel();
        renderStreamFilters();
        renderStream();
      });
    });
  }

  function renderStream() {
    const root = $('#stream-feed');
    if (!root) return;
    const items = filteredStream().slice(0, 150);
    if (!items.length) {
      root.innerHTML = '<p class="muted" style="padding:16px">No events match filters.</p>';
      return;
    }
    root.innerHTML = items
      .map((ev) => {
        const color = kindColor(ev.kind);
        const links = [];
        if (ev.ticker) links.push(ev.ticker);
        if (ev.branch) links.push(ev.branch);
        if (ev.forbesRank) links.push(`#${ev.forbesRank}`);
        return `
      <article class="stream-item" data-kind="${escapeHtml(ev.kind)}" style="--stream-accent:${color}">
        <div class="stream-rail"></div>
        <div class="stream-body">
          <header class="stream-head">
            <span class="stream-kind">${escapeHtml(KIND_LABELS[ev.kind] || ev.kind)}</span>
            <time class="stream-date">${escapeHtml(ev.date || ev.sortKey || '')}</time>
          </header>
          <p class="stream-title">${escapeHtml(ev.title)}</p>
          ${ev.description ? `<p class="stream-sub">${escapeHtml(ev.description)}</p>` : ''}
          ${ev.forbesName ? `<p class="stream-sub">#${ev.forbesRank} ${escapeHtml(ev.forbesName)}</p>` : ''}
          ${
            links.length
              ? `<div class="stream-links">${links.map((l) => `<span class="stream-link">${escapeHtml(l)}</span>`).join('')}</div>`
              : ''
          }
        </div>
      </article>`;
      })
      .join('');
  }

  async function loadSectorIndex() {
    try {
      const res = await fetch(SECTOR_INDEX);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function loadSector(slug) {
    const res = await fetch(`data/sector-activity/${encodeURIComponent(slug)}.json`);
    if (!res.ok) return null;
    return res.json();
  }

  async function showSector(slug, title) {
    const root = $('#sector-branches');
    const meta = $('#sector-meta');
    if (root) root.innerHTML = '<p class="muted">Loading sector flips…</p>';
    const sectorData = await loadSector(slug);
    if (!sectorData) {
      if (root) root.innerHTML = '<p class="muted">Sector bundle not embedded — Agentic list available locally.</p>';
      return;
    }
    if (meta) {
      meta.textContent = `${sectorData.eventCount ?? 0} flips · ${sectorData.symbolCount ?? 0} symbols · ${sectorData.window?.start ?? ''} → ${sectorData.window?.end ?? ''}`;
    }
    if (window.TimelineCluster?.renderGroupsInto && root) {
      window.TimelineCluster.renderGroupsInto(sectorData, root);
    } else if (root) {
      root.innerHTML = '<p class="muted">timeline-cluster.js required for heatmaps.</p>';
    }
  }

  async function initSectorActivity() {
    const index = await loadSectorIndex();
    const chips = $('#sector-chips');
    if (!index?.sectors?.length || !chips) return;

    const embedded = index.sectors.filter((s) => s.slug === 'agentic' || s.file === 'agentic.json');
    const list = embedded.length ? embedded : index.sectors.slice(0, 1);

    chips.innerHTML = list
      .map(
        (s) =>
          `<button type="button" class="sector-activity-chip" data-slug="${escapeHtml(s.slug)}">${escapeHtml(s.sector)} <span class="muted">${s.eventCount} flips</span></button>`
      )
      .join('');

    chips.querySelectorAll('.sector-activity-chip').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        chips.querySelectorAll('.sector-activity-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        showSector(btn.dataset.slug);
      });
      if (i === 0) {
        btn.classList.add('active');
        showSector(btn.dataset.slug);
      }
    });
  }

  function bindToolbar() {
    const clear = $('#stream-filter-clear');
    if (clear) {
      clear.addEventListener('click', () => {
        state.filterTicker = null;
        state.filterRank = null;
        state.filterBranch = null;
        updateFilterLabel();
        renderStreamFilters();
        renderCompression();
        renderInterplay();
        renderStream();
      });
    }
  }

  const DRAWER_STORAGE_KEY = 'industry-stream-drawer';

  function isDrawerMobile() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  function setDrawerOpen(open) {
    const body = document.body;
    const toggle = $('#stream-drawer-toggle');
    const headerToggle = $('#stream-drawer-header-toggle');
    const backdrop = $('#stream-drawer-backdrop');
    body.classList.toggle('stream-drawer-open', open);
    body.classList.toggle('stream-drawer-closed', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    if (headerToggle) headerToggle.setAttribute('aria-expanded', String(open));
    if (backdrop) {
      backdrop.hidden = !open || !isDrawerMobile();
      backdrop.setAttribute('aria-hidden', String(!open || !isDrawerMobile()));
    }
    try {
      localStorage.setItem(DRAWER_STORAGE_KEY, open ? 'open' : 'closed');
    } catch {
      /* ignore */
    }
  }

  function bindDrawer() {
    const toggle = $('#stream-drawer-toggle');
    const headerToggle = $('#stream-drawer-header-toggle');
    const backdrop = $('#stream-drawer-backdrop');
    let saved = null;
    try {
      saved = localStorage.getItem(DRAWER_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (saved === 'open') setDrawerOpen(true);
    else if (saved === 'closed') setDrawerOpen(false);
    else setDrawerOpen(!isDrawerMobile());

    const flip = () => setDrawerOpen(!document.body.classList.contains('stream-drawer-open'));

    toggle?.addEventListener('click', flip);
    headerToggle?.addEventListener('click', flip);
    backdrop?.addEventListener('click', () => setDrawerOpen(false));

    document.querySelectorAll('a.stream-nav-link, a[href="#industry-stream"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setDrawerOpen(true);
        const drawer = $('#industry-stream');
        drawer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    window.addEventListener('resize', () => {
      const open = document.body.classList.contains('stream-drawer-open');
      if (backdrop) {
        backdrop.hidden = !open || !isDrawerMobile();
        backdrop.setAttribute('aria-hidden', String(!open || !isDrawerMobile()));
      }
    });
  }

  function renderAll() {
    renderMeta();
    renderThroughLineSummary();
    renderThroughLine();
    renderCompressionMeta();
    renderCompression();
    renderInterplayMeta();
    renderInterplay();
    renderStreamFilters();
    renderStream();
    updateFilterLabel();
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`${res.status}`);
      data = await res.json();
      renderAll();
      bindToolbar();
      bindDrawer();
      initSectorActivity();
    } catch (err) {
      const main = $('.unified-main');
      if (main) {
        main.innerHTML = `<p class="muted" style="padding:24px">Failed to load ${DATA_URL}: ${escapeHtml(err.message)}. Run <code>python3 scripts/build_industry_stream.py</code>.</p>`;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
