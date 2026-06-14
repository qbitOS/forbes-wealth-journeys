/**
 * Industry stream — unified Forbes wealth × crossover view
 * Data: data/industry-stream.json · sector: data/sector-activity/
 */
(function () {
  'use strict';

  const DATA_URL = 'data/industry-stream.json';
  const HISTORICAL_INDEX_URL = 'data/forbes-historical-index.json';
  const DATA_CACHE_BUST = '20260613s';
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
  let historicalIndex = null;
  let historicalByRank = {};
  let yearRankCache = new Map();
  let forbesPersonCompanies = null;
  let forbesRankByCompanyKey = null;
  const tlCharts = [];
  const HEATMAP_MIN_DATE = '2023-01-01';

  const state = {
    filterTicker: null,
    filterEntityId: null,
    filterRank: null,
    filterListYear: null,
    filterBranch: null,
    filterHeatmapDate: null,
    highlightWeek: null,
    heatmapViewYear: null,
    throughLineQuery: '',
    throughLineSort: 'pct-desc',
    compressionViewMode: 'year',
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

  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatHeatmapRangeLabel(range, fallback) {
    if (fallback) return fallback;
    if (!range?.length) return '';
    const fmt = (iso) => {
      const d = new Date(`${iso}T12:00:00Z`);
      return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    };
    const start = range[0];
    const end = range[1] || start;
    return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  }

  function heatmapDaySymbols(hm, dateStr) {
    const byDate = hm?.byDate || {};
    return byDate[dateStr] || [];
  }

  function heatmapDataBounds(hm) {
    if (!hm) {
      return { minDate: HEATMAP_MIN_DATE, maxDate: HEATMAP_MIN_DATE, minYear: 2023, maxYear: 2023 };
    }
    const cal = hm.calendar || [];
    let minDate = hm.range?.[0] || cal[0]?.[0] || HEATMAP_MIN_DATE;
    let maxDate = hm.range?.[1] || cal[cal.length - 1]?.[0] || minDate;
    for (const row of cal) {
      const dateStr = row[0];
      if (dateStr < minDate) minDate = dateStr;
      if (dateStr > maxDate) maxDate = dateStr;
    }
    if (minDate < HEATMAP_MIN_DATE) minDate = HEATMAP_MIN_DATE;
    return {
      minDate,
      maxDate,
      minYear: parseInt(minDate.slice(0, 4), 10),
      maxYear: parseInt(maxDate.slice(0, 4), 10),
    };
  }

  function resolveHeatmapViewYear(hm) {
    const { minYear, maxYear } = heatmapDataBounds(hm);
    if (state.heatmapViewYear != null) {
      return Math.max(minYear, Math.min(maxYear, state.heatmapViewYear));
    }
    return maxYear;
  }

  function heatmapViewWindow(hm, viewYear) {
    const { minDate, maxDate } = heatmapDataBounds(hm);
    const yearStart = `${viewYear}-01-01`;
    const yearEnd = `${viewYear}-12-31`;
    const start = yearStart < minDate ? minDate : yearStart;
    const end = yearEnd > maxDate ? maxDate : yearEnd;
    const range = start === end ? start : [start, end];
    return { viewYear, start, end, range, rangeLabel: formatHeatmapRangeLabel(range) };
  }

  function filterHeatmapCalendar(cal, start, end) {
    return cal.filter(([dateStr]) => dateStr >= start && dateStr <= end);
  }

  function syncHeatmapSelectionToView(window) {
    if (state.filterHeatmapDate && (state.filterHeatmapDate < window.start || state.filterHeatmapDate > window.end)) {
      state.filterHeatmapDate = null;
    }
    if (state.highlightWeek) {
      const week = parseIsoWeek(state.highlightWeek);
      if (week.endStr < window.start || week.startStr > window.end) {
        state.highlightWeek = null;
      }
    }
  }

  function updateHeatmapYearNav() {
    const hm = data?.throughLineHeatmap;
    if (!hm) return;
    const { minYear, maxYear } = heatmapDataBounds(hm);
    const viewYear = resolveHeatmapViewYear(hm);
    const prev = $('#through-line-heatmap-prev');
    const next = $('#through-line-heatmap-next');
    if (prev) {
      prev.disabled = viewYear <= minYear;
      prev.setAttribute('aria-disabled', String(viewYear <= minYear));
    }
    if (next) {
      next.disabled = viewYear >= maxYear;
      next.setAttribute('aria-disabled', String(viewYear >= maxYear));
    }
  }

  function shiftHeatmapYear(delta) {
    const hm = data?.throughLineHeatmap;
    if (!hm || !delta) return;
    const { minYear, maxYear } = heatmapDataBounds(hm);
    const nextYear = resolveHeatmapViewYear(hm) + delta;
    if (nextYear < minYear || nextYear > maxYear) return;
    state.heatmapViewYear = nextYear;
    syncHeatmapSelectionToView(heatmapViewWindow(hm, nextYear));
    disposeThroughLineCharts();
    renderThroughLineUniverse();
    renderThroughLineHeatmap();
    renderSpeedChart();
  }

  function heatmapCellValue(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw?.value) return raw.value;
    return [];
  }

  function isoWeekKeyFromDate(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  function parseIsoWeek(weekKey) {
    const [yearS, weekS] = weekKey.split('-W');
    const year = parseInt(yearS, 10);
    const week = parseInt(weekS, 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const toIso = (dt) => dt.toISOString().slice(0, 10);
    return { start: monday, end: sunday, startStr: toIso(monday), endStr: toIso(sunday) };
  }

  function fmtShortDate(isoOrDate) {
    const d = typeof isoOrDate === 'string' ? new Date(`${isoOrDate}T12:00:00Z`) : isoOrDate;
    return `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  function enrichSpeedWeek(week, index, weeks) {
    const bounds = parseIsoWeek(week.week);
    const weekStart = week.weekStart || bounds.startStr;
    const weekEnd = week.weekEnd || bounds.endStr;
    const prior = index > 0 ? weeks[index - 1] : null;
    const deltaSymbolDays =
      week.deltaSymbolDays != null ? week.deltaSymbolDays : prior ? week.symbolDays - prior.symbolDays : null;
    const deltaPct =
      week.deltaPct != null
        ? week.deltaPct
        : prior?.symbolDays
          ? Math.round((deltaSymbolDays / prior.symbolDays) * 1000) / 10
          : null;
    return { ...week, weekStart, weekEnd, deltaSymbolDays, deltaPct };
  }

  function speedAxisLabel(weekKey, index, weeks) {
    const w = weeks[index];
    const startIso = w.weekStart || parseIsoWeek(weekKey).startStr;
    const start = new Date(`${startIso}T12:00:00Z`);
    const month = start.getUTCMonth();
    const prevMonth =
      index > 0
        ? new Date(`${weeks[index - 1].weekStart || parseIsoWeek(weeks[index - 1].week).startStr}T12:00:00Z`).getUTCMonth()
        : -1;
    if (index === 0 || month !== prevMonth || index === weeks.length - 1) {
      return fmtShortDate(start);
    }
    return '';
  }

  function formatSpeedDelta(delta, deltaPct) {
    if (delta == null || deltaPct == null) return '— vs prior week';
    const sign = delta >= 0 ? '+' : '';
    const pctSign = deltaPct >= 0 ? '+' : '';
    return `${sign}${delta} (${pctSign}${deltaPct}%) vs prior week`;
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

  function holdingIsActive(h) {
    if (state.filterEntityId) return h.entityId === state.filterEntityId;
    const key = h.dataTicker || h.ticker;
    return state.filterTicker && key === state.filterTicker;
  }

  function holdingMatchesFilter(h) {
    if (state.filterEntityId) return h.entityId === state.filterEntityId;
    if (state.filterTicker) {
      return h.ticker === state.filterTicker || h.dataTicker === state.filterTicker;
    }
    return true;
  }

  function filterEntityLabel() {
    if (state.filterEntityId && data?.forbesRankings) {
      for (const person of data.forbesRankings) {
        const match = (person.holdings || []).find((h) => h.entityId === state.filterEntityId);
        if (match) return match.entity || state.filterEntityId;
      }
    }
    return state.filterEntityId;
  }

  function applyHoldingFilter({ ticker, entityId, rank, clearBranch = true }) {
    if (ticker) {
      if (state.filterTicker === ticker && state.filterRank === rank) {
        state.filterTicker = null;
        state.filterEntityId = null;
        state.filterRank = null;
      } else {
        state.filterTicker = ticker;
        state.filterEntityId = null;
        state.filterRank = rank ?? null;
      }
    } else if (entityId) {
      if (state.filterEntityId === entityId && state.filterRank === rank) {
        state.filterTicker = null;
        state.filterEntityId = null;
        state.filterRank = null;
      } else {
        state.filterEntityId = entityId;
        state.filterTicker = null;
        state.filterRank = rank ?? null;
      }
    }
    if (clearBranch) state.filterBranch = null;
    updateFilterLabel();
    renderThroughLineForbesUsers();
    renderThroughLineUniverse();
    renderCompression();
    renderStream();
    renderSectorBranches();
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
    if (state.filterEntityId) {
      if (ev.entityId === state.filterEntityId) return true;
      const label = filterEntityLabel();
      if (label && ev.entity && ev.entity.toLowerCase() === label.toLowerCase()) return true;
      const branchHints = {
        spacex: ['spacex', 'spacex-ipo', 'spacex-ops'],
        xai: ['grok', 'colossus', 'xai'],
        'x-corp': ['x-corp', 'x'],
      };
      const branches = branchHints[state.filterEntityId] || [state.filterEntityId];
      if (ev.branch && branches.includes(ev.branch)) return true;
      if (ev.tags?.some((t) => branches.includes(t))) return true;
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
    if (state.filterEntityId) parts.push(filterEntityLabel() || state.filterEntityId);
    if (state.filterRank != null) parts.push(`#${state.filterRank}`);
    if (state.filterBranch) parts.push(state.filterBranch);
    el.textContent = parts.length ? parts.join(' · ') : 'All events';
  }

  function throughLineCompanyLabel(company) {
    if (!company) return '—';
    if (company.displayLabel) return company.displayLabel;
    const name = (company.name || '').trim();
    const ticker = (company.ticker || '').trim();
    if (ticker && name && name.toUpperCase() !== ticker.toUpperCase()) return `${name} (${ticker})`;
    return name || ticker || '—';
  }

  function throughLineLeaderLabel(tl) {
    if (!tl) return null;
    if (tl.leaderLabel) return tl.leaderLabel;
    if (!tl.leader && !tl.leaderName) return null;
    const match = (data?.throughLineUniverse || []).find(
      (c) =>
        (tl.leaderTicker && c.ticker === tl.leaderTicker) ||
        (tl.leader && (c.ticker === tl.leader || c.name === tl.leader))
    );
    if (match) return throughLineCompanyLabel(match);
    return throughLineCompanyLabel({ name: tl.leaderName || tl.leader, ticker: tl.leaderTicker || tl.leader });
  }

  function renderMeta() {
    const el = $('#through-line-meta') || $('#industry-meta');
    if (!el || !data) return;
    const tl = data.throughLineSummary;
    if (tl?.totalCompanies) {
      const parts = [`${tl.totalCompanies} companies`];
      if (tl.tradableWithPct != null) parts.push(`${tl.tradableWithPct} with %`);
      if (tl.avgActivityPct != null) parts.push(`${tl.avgActivityPct}% avg activity`);
      if (tl.leader) {
        const kind = tl.leaderKind === 'alignment' ? 'alignment' : 'activity';
        parts.push(`${throughLineLeaderLabel(tl)} ${tl.leaderPct}% ${kind}`);
      }
      el.textContent = parts.join(' · ');
      return;
    }
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
    const lead = $('#through-line-lead');
    if (!el || !data) return;
    const tl = data.throughLineSummary;
    if (lead && tl?.totalCompanies) {
      lead.textContent = `All ${tl.totalCompanies} Forbes billionaire companies — activity % over the last year, aggregate tape heatmap (Jan 2023 onward), and weekly velocity.`;
    }
    if (!tl) {
      el.textContent = '';
      return;
    }
    const parts = [];
    if (tl.totalCompanies) {
      parts.push(`<strong>${tl.totalCompanies}</strong> companies`);
      if (tl.tradableWithPct != null) parts.push(`${tl.tradableWithPct} tradable with metrics`);
      if (tl.privateCount) parts.push(`${tl.privateCount} private`);
    }
    if (tl.avgActivityPct != null) {
      parts.push(`<span class="through-stat-pct">${tl.avgActivityPct}%</span> avg active days`);
    }
    if (tl.alignmentCount) parts.push(`${tl.alignmentCount} alignment signal${tl.alignmentCount === 1 ? '' : 's'}`);
    if (tl.leader && tl.leaderPct != null) {
      const kind = tl.leaderKind === 'alignment' ? 'alignment' : 'activity';
      parts.push(
        `<strong class="through-stat-winner">${escapeHtml(throughLineLeaderLabel(tl))}</strong> leads at ${tl.leaderPct}% ${kind}`
      );
    }
    if (!parts.length) {
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
    }
    el.innerHTML = parts.join(' · ');
  }

  function throughLineBadge(company) {
    if (company.pct == null) return '<span class="tl-universe-badge tl-universe-badge-na" title="No tradable tape">—</span>';
    const kind = company.pctKind === 'alignment' ? 'alignment' : 'activity';
    const level = scoreLevel(company.pct);
    return `<span class="tl-universe-badge" data-kind="${kind}" data-level="${level}" title="${kind === 'alignment' ? 'Lifecycle↔flip alignment' : 'Active trading days / 252'}">${company.pct}%</span>`;
  }

  function throughLineTypeLabel(type) {
    if (type === 'us') return 'US';
    if (type === 'foreign') return 'ADR/foreign';
    if (type === 'private') return 'private';
    return type || '';
  }

  const THROUGH_LINE_TYPE_ORDER_US = { us: 0, foreign: 1, private: 2 };
  const THROUGH_LINE_TYPE_ORDER_FOREIGN = { foreign: 0, us: 1, private: 2 };

  const THROUGH_LINE_TYPE_ORDER_PRIVATE = { private: 0, us: 1, foreign: 2 };

  function throughLineHasActiveDays() {
    return (data?.throughLineUniverse || []).some((c) => c.activeDays != null);
  }

  function compareThroughLineNullable(a, b, dir = 1) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return (a - b) * dir;
  }

  function bestForbesRank(company) {
    if (!forbesRankByCompanyKey) {
      forbesRankByCompanyKey = new Map();
      for (const person of data?.forbesRankings || []) {
        const keys = getForbesPersonCompanies().get(person.rank);
        if (!keys) continue;
        for (const key of keys) {
          const prev = forbesRankByCompanyKey.get(key);
          if (prev == null || person.rank < prev) forbesRankByCompanyKey.set(key, person.rank);
        }
      }
    }
    const key = throughLineCompanyKey(company);
    return key ? forbesRankByCompanyKey.get(key) : null;
  }

  function sortThroughLineUniverse(list) {
    const sort = state.throughLineSort;
    const out = [...list];
    out.sort((a, b) => {
      switch (sort) {
        case 'pct-asc':
          return compareThroughLineNullable(a.pct, b.pct, 1) || a.name.localeCompare(b.name);
        case 'name-asc':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'ticker-asc': {
          const ta = (a.ticker || '\uffff').toUpperCase();
          const tb = (b.ticker || '\uffff').toUpperCase();
          return ta.localeCompare(tb) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        case 'rank-asc':
          return (
            compareThroughLineNullable(bestForbesRank(a), bestForbesRank(b), 1) ||
            compareThroughLineNullable(b.pct, a.pct, 1) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        case 'type-us': {
          const oa = THROUGH_LINE_TYPE_ORDER_US[a.type] ?? 9;
          const ob = THROUGH_LINE_TYPE_ORDER_US[b.type] ?? 9;
          return oa - ob || compareThroughLineNullable(b.pct, a.pct, 1) || a.name.localeCompare(b.name);
        }
        case 'type-foreign': {
          const oa = THROUGH_LINE_TYPE_ORDER_FOREIGN[a.type] ?? 9;
          const ob = THROUGH_LINE_TYPE_ORDER_FOREIGN[b.type] ?? 9;
          return oa - ob || compareThroughLineNullable(b.pct, a.pct, 1) || a.name.localeCompare(b.name);
        }
        case 'type-private': {
          const oa = THROUGH_LINE_TYPE_ORDER_PRIVATE[a.type] ?? 9;
          const ob = THROUGH_LINE_TYPE_ORDER_PRIVATE[b.type] ?? 9;
          return oa - ob || compareThroughLineNullable(b.pct, a.pct, 1) || a.name.localeCompare(b.name);
        }
        case 'days-desc':
          return (
            compareThroughLineNullable(b.activeDays, a.activeDays, 1) ||
            compareThroughLineNullable(b.pct, a.pct, 1) ||
            a.name.localeCompare(b.name)
          );
        case 'pct-desc':
        default:
          return compareThroughLineNullable(b.pct, a.pct, 1) || a.name.localeCompare(b.name);
      }
    });
    return out;
  }

  function throughLineCompanyKey(company) {
    if (company?.ticker) return `ticker:${String(company.ticker).toUpperCase()}`;
    if (company?.entityId) return `entity:${company.entityId}`;
    if (company?.name) return `name:${String(company.name).toLowerCase()}`;
    return null;
  }

  function buildForbesPersonCompanies() {
    const universe = data?.throughLineUniverse || [];
    const byTicker = new Map();
    const byEntityId = new Map();
    const byName = new Map();
    for (const company of universe) {
      if (company.ticker) byTicker.set(String(company.ticker).toUpperCase(), company);
      if (company.entityId) byEntityId.set(company.entityId, company);
      if (company.name) byName.set(String(company.name).toLowerCase(), company);
    }

    const map = new Map();
    for (const person of data?.forbesRankings || []) {
      const keys = new Set();
      for (const holding of person.holdings || []) {
        const ticker = holding.dataTicker || holding.ticker;
        let matched = null;
        if (ticker) matched = byTicker.get(String(ticker).toUpperCase());
        if (!matched && holding.entityId) matched = byEntityId.get(holding.entityId);
        if (!matched && holding.entity) matched = byName.get(String(holding.entity).toLowerCase());
        if (matched) {
          const key = throughLineCompanyKey(matched);
          if (key) keys.add(key);
        } else if (holding.entity || ticker) {
          keys.add(
            ticker
              ? `ticker:${String(ticker).toUpperCase()}`
              : `name:${String(holding.entity).toLowerCase()}`
          );
        }
      }
      map.set(person.rank, keys);
    }
    return map;
  }

  function getForbesPersonCompanies() {
    if (!forbesPersonCompanies) forbesPersonCompanies = buildForbesPersonCompanies();
    return forbesPersonCompanies;
  }

  function companyMatchesForbesRank(company, rank) {
    const keys = getForbesPersonCompanies().get(rank);
    if (!keys?.size) return false;
    const key = throughLineCompanyKey(company);
    if (key && keys.has(key)) return true;
    if (company?.ticker && keys.has(`ticker:${String(company.ticker).toUpperCase()}`)) return true;
    if (company?.name && keys.has(`name:${String(company.name).toLowerCase()}`)) return true;
    return false;
  }

  function forbesProfileHref(person) {
    const params = new URLSearchParams({ rank: String(person.rank), name: person.name || '' });
    const embedded = document.body.classList.contains('stream-embedded');
    return embedded ? `#forbes?${params.toString()}` : `index.html#forbes?${params.toString()}`;
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
    out.push({
      year: sorted[sorted.length - 1].year,
      netWorthB: sorted[sorted.length - 1].netWorthB,
      anchor: true,
    });
    return out;
  }

  function netWorthAtYear(rank, year) {
    const expanded = expandHistoricalSeries(historicalByRank[String(rank)] || []);
    const pt = expanded.find((p) => p.year === year);
    return pt?.netWorthB ?? null;
  }

  /** Forbes list order for a calendar year — rank by interpolated net worth across profiles. */
  function yearRankSnapshot(year) {
    if (yearRankCache.has(year)) return yearRankCache.get(year);
    const people = data?.forbesRankings || [];
    const ranked = [];
    people.forEach((p) => {
      const netWorthB = netWorthAtYear(p.rank, year);
      if (netWorthB != null) ranked.push({ profileRank: p.rank, netWorthB });
    });
    ranked.sort((a, b) => b.netWorthB - a.netWorthB || a.profileRank - b.profileRank);
    const byProfile = new Map();
    ranked.forEach((row, i) => {
      byProfile.set(row.profileRank, { yearRank: i + 1, netWorthB: row.netWorthB });
    });
    yearRankCache.set(year, byProfile);
    return byProfile;
  }

  function compressionRankLabel(person, year) {
    const rank = person.yearRank ?? person.rank;
    if (year == null) return `#${rank}`;
    return `#${rank}<span class="compression-rank-year"> · ${year}</span>`;
  }

  function listYearBounds() {
    const cov = historicalIndex?.dataCoverage || {};
    return {
      min: cov.sliderMinYear || 1982,
      max: cov.sliderMaxYear || 2026,
    };
  }

  function activeListYear() {
    return state.filterListYear ?? listYearBounds().max;
  }

  function renderContextRail(rootId) {
    const root = $(rootId);
    if (!root || !historicalIndex?.timelineAnchors?.length) return;
    const year = activeListYear();
    const anchors = historicalIndex.timelineAnchors.filter((a) => a.year <= year);
    const visible = anchors.slice(-6);
    root.innerHTML = `
      <p class="context-rail-label">Timeline · through ${year}${year < 1982 ? ' (pre-Forbes list)' : ''}</p>
      <ol class="context-rail-list">
        ${visible.map((a) => `<li class="context-rail-item context-rail-${escapeHtml(a.era || 'other')}"><span class="context-rail-year">${a.year}</span> ${escapeHtml(a.label)}</li>`).join('')}
      </ol>`;
  }

  function scrollToForbesCompression(rank) {
    const row = document.querySelector(`.forbes-person.compression-row[data-rank="${rank}"]`);
    if (!row) return;
    row.closest('details')?.setAttribute('open', '');
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function selectForbesPerson(rank, { scroll = true } = {}) {
    const nextRank = state.filterRank === rank ? null : rank;
    state.filterRank = nextRank;
    state.filterTicker = null;
    state.filterEntityId = null;
    state.filterBranch = null;
    updateFilterLabel();
    renderThroughLineForbesUsers();
    renderThroughLineUniverse();
    renderCompression();
    renderStreamFilters();
    renderStream();
    renderSectorBranches();
    if (scroll && nextRank != null) scrollToForbesCompression(nextRank);
  }

  function filteredThroughLineUniverse() {
    let list = data?.throughLineUniverse || [];
    if (state.filterHeatmapDate) {
      const symbols = new Set(heatmapDaySymbols(data?.throughLineHeatmap, state.filterHeatmapDate));
      list = list.filter((c) => c.ticker && symbols.has(c.ticker));
    }
    if (state.filterRank != null) {
      list = list.filter((company) => companyMatchesForbesRank(company, state.filterRank));
    }
    const q = state.throughLineQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const hay = [c.name, c.displayLabel, c.ticker, c.entityId, c.type, c.pctReason]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return sortThroughLineUniverse(list);
  }

  function renderThroughLineForbesUsers() {
    const root = $('#through-line-forbes-users');
    if (!root || !data) return;
    let people = (data.forbesRankings || []).filter((p) => (p.holdings || []).length);
    const year = activeListYear();
    people = [...people].sort((a, b) => {
      const nwA = netWorthAtYear(a.rank, year) ?? 0;
      const nwB = netWorthAtYear(b.rank, year) ?? 0;
      if (nwB !== nwA) return nwB - nwA;
      return a.rank - b.rank;
    });
    if (!people.length) {
      root.innerHTML = '<p class="muted">No Forbes rankings</p>';
      return;
    }
    root.innerHTML = people
      .map((person) => {
        const active = state.filterRank === person.rank ? ' active' : '';
        const href = forbesProfileHref(person);
        const snap = netWorthAtYear(person.rank, year);
        const worthLabel = snap != null ? `$${snap}B` : '—';
        return `<a href="${escapeHtml(href)}" class="tl-forbes-user-chip${active}" data-rank="${person.rank}" title="#${person.rank} ${escapeHtml(person.name)} · ${worthLabel} @ ${year}">
          <span class="tl-forbes-user-rank">#${person.rank}</span>
          <span class="tl-forbes-user-name">${escapeHtml(person.name)}</span>
          <span class="tl-forbes-user-worth">${worthLabel}</span>
        </a>`;
      })
      .join('');
    root.querySelectorAll('.tl-forbes-user-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        selectForbesPerson(Number(chip.dataset.rank));
      });
    });
  }

  function renderThroughLineUniverse() {
    const root = $('#through-line-universe');
    const countEl = $('#through-line-universe-count');
    if (!root || !data) return;
    const list = filteredThroughLineUniverse();
    const total = (data.throughLineUniverse || []).length;
    if (countEl) {
      const rankSuffix = state.filterRank != null ? ` · #${state.filterRank}` : '';
      if (state.filterHeatmapDate) {
        const dayCount = heatmapDaySymbols(data?.throughLineHeatmap, state.filterHeatmapDate).length;
        countEl.textContent =
          list.length === total
            ? `${total} companies · ${state.filterHeatmapDate} (${dayCount} active)${rankSuffix}`
            : `${list.length} of ${total} · ${state.filterHeatmapDate}${rankSuffix}`;
      } else {
        countEl.textContent =
          list.length === total ? `${total} companies${rankSuffix}` : `${list.length} of ${total}${rankSuffix}`;
      }
    }
    if (!list.length) {
      root.innerHTML = '<p class="muted">No companies match this filter.</p>';
      return;
    }
    root.innerHTML = list
      .map((c) => {
        const label = throughLineCompanyLabel(c);
        const showTicker = c.ticker && !label.includes(`(${c.ticker})`);
        const ticker = showTicker ? `<span class="tl-universe-ticker">${escapeHtml(c.ticker)}</span>` : '';
        const active = state.filterTicker && c.ticker === state.filterTicker ? ' active' : '';
        return `<button type="button" class="tl-universe-chip${active}" data-type="${escapeHtml(c.type || '')}"${
          c.ticker ? ` data-ticker="${escapeHtml(c.ticker)}"` : ''
        } title="${escapeHtml(c.pctReason || c.pctKind || c.type || '')}">
          ${throughLineBadge(c)}
          <span class="tl-universe-name">${escapeHtml(label)}</span>
          ${ticker}
          <span class="tl-universe-type">${escapeHtml(throughLineTypeLabel(c.type))}</span>
        </button>`;
      })
      .join('');
    root.querySelectorAll('.tl-universe-chip[data-ticker]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const ticker = chip.dataset.ticker;
        state.filterTicker = state.filterTicker === ticker ? null : ticker;
        renderAll();
      });
    });
  }

  function disposeThroughLineCharts() {
    while (tlCharts.length) {
      const chart = tlCharts.pop();
      try {
        chart?.dispose?.();
      } catch {
        /* ignore */
      }
    }
  }

  function renderThroughLineHeatmap() {
    const host = $('#through-line-heatmap');
    if (!host || !data?.throughLineHeatmap || typeof echarts === 'undefined') return;
    disposeChartOnHost(host);
    const hm = data.throughLineHeatmap;
    const viewYear = resolveHeatmapViewYear(hm);
    state.heatmapViewYear = viewYear;
    const viewWindow = heatmapViewWindow(hm, viewYear);
    const calData = filterHeatmapCalendar(hm.calendar || [], viewWindow.start, viewWindow.end);
    const lead = $('#through-line-heatmap-lead');
    if (!calData.length) {
      host.innerHTML = '<p class="muted">No daily tape in this year — try another year or run fetch:robinhood-year in robinhood-agentic.</p>';
      if (lead) {
        lead.textContent = `${viewWindow.rangeLabel} · No activity in this window`;
      }
      updateHeatmapYearNav();
      return;
    }
    host.innerHTML = '';
    const theme = FWJColor.chartTheme();
    const accent = FWJColor.token('--fwj-accent', '#78a9ff');
    const rangeVal = viewWindow.range;
    const rangeLabel = viewWindow.rangeLabel;
    const selectedDate = state.filterHeatmapDate;
    const highlightWeek = state.highlightWeek;
    const gold = FWJColor.token('--fwj-gold', '#e6c068');
    const viewMax = calData.reduce((max, [, count]) => Math.max(max, count), 0);
    const seriesData = calData.map((row) => {
      const [dateStr, count] = row;
      if (highlightWeek && isoWeekKeyFromDate(dateStr) === highlightWeek) {
        return {
          value: [dateStr, count],
          itemStyle: { borderColor: gold, borderWidth: 3 },
        };
      }
      return row;
    });
    if (lead) {
      const hintParts = ['Click a day to filter companies below'];
      if (selectedDate) hintParts.unshift(`Filtered: ${selectedDate}`);
      if (highlightWeek) hintParts.push(`Week ${highlightWeek} highlighted`);
      lead.textContent = `${rangeLabel} · ${hintParts.join(' · ')}`;
    }
    updateHeatmapYearNav();
    const chart = echarts.init(host, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: theme.background,
      tooltip: {
        backgroundColor: theme.heatmapTrack,
        borderColor: theme.heatmapGrid,
        textStyle: { color: theme.text, fontSize: 11 },
        formatter: (p) => {
          const [dateStr, count] = heatmapCellValue(p.data);
          const symbols = heatmapDaySymbols(hm, dateStr);
          const top = symbols.slice(0, 6);
          const extra = symbols.length - top.length;
          const lines = [
            `<strong>${dateStr}</strong>`,
            `${count} symbol-day${count === 1 ? '' : 's'}`,
          ];
          if (top.length) {
            lines.push(`Top: ${top.join(', ')}${extra > 0 ? ` +${extra}` : ''}`);
          }
          lines.push('<span style="opacity:.75">Click to filter list</span>');
          return lines.join('<br/>');
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(2, viewMax),
        show: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 10,
        itemHeight: 48,
        text: ['High', 'Low'],
        textStyle: { color: theme.textMuted, fontSize: 9 },
        inRange: { color: FWJColor.heatmapScale(accent) },
      },
      calendar: {
        range: rangeVal,
        cellSize: ['auto', 10],
        top: 48,
        left: 28,
        right: 12,
        bottom: 40,
        itemStyle: {
          borderWidth: 2,
          borderColor: theme.heatmapTrack,
          color: FWJColor.token('--fwj-heatmap-empty', '#1a1f28'),
        },
        yearLabel: { show: false },
        monthLabel: {
          show: true,
          color: theme.textMuted,
          fontSize: 9,
          nameMap: 'en',
          margin: 8,
          align: 'center',
        },
        dayLabel: {
          firstDay: 0,
          color: theme.textMuted,
          fontSize: 8,
          nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: seriesData,
          emphasis: {
            itemStyle: { borderColor: accent, borderWidth: 2 },
          },
          select: {
            itemStyle: { borderColor: accent, borderWidth: 2 },
          },
          selectedMode: 'single',
        },
      ],
    });
    if (selectedDate) {
      const idx = calData.findIndex((row) => row[0] === selectedDate);
      if (idx >= 0) {
        chart.dispatchAction({ type: 'select', seriesIndex: 0, dataIndex: idx });
      }
    }
    chart.on('click', (params) => {
      const [dateStr] = heatmapCellValue(params.data);
      if (params.componentType !== 'series' || !dateStr) return;
      state.filterHeatmapDate = state.filterHeatmapDate === dateStr ? null : dateStr;
      state.highlightWeek = null;
      renderThroughLineUniverse();
      renderThroughLineHeatmap();
    });
    tlCharts.push(chart);
    requestAnimationFrame(() => chart.resize());
  }

  function colorWithAlpha(color, alpha) {
    if (!color) return color;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        const a = Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0');
        return `#${hex}${a}`;
      }
      return color;
    }
    const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
    return color;
  }

  function disposeChartOnHost(host) {
    if (!host || typeof echarts === 'undefined') return;
    const existing = echarts.getInstanceByDom(host);
    if (!existing) return;
    const idx = tlCharts.indexOf(existing);
    if (idx >= 0) tlCharts.splice(idx, 1);
    try {
      existing.dispose();
    } catch {
      /* ignore */
    }
  }

  function speedWeeksForView(speed, viewWindow) {
    const rawWeeks = speed?.weeks || [];
    const weeks = rawWeeks.map((w, i) => enrichSpeedWeek(w, i, rawWeeks));
    if (!viewWindow) return weeks;
    return weeks.filter((w) => w.weekEnd >= viewWindow.start && w.weekStart <= viewWindow.end);
  }

  function speedEventColor(eventId, kind) {
    const map = {
      july4: '--fwj-branch-tesla',
      thanksgiving: '--fwj-branch-terrafab',
      christmas: '--fwj-branch-spacex',
      new_year: '--fwj-tf-1h',
      nye: '--fwj-tf-1h',
      labor: '--fwj-gold',
      memorial: '--fwj-tf-week',
      mlk: '--fwj-accent',
      presidents: '--fwj-tf-month',
      good_friday: '--fwj-violet',
      easter: '--fwj-violet',
      juneteenth: '--fwj-branch-colossus',
      fomc: '--fwj-gold',
    };
    const fallbacks = {
      july4: '#ff8389',
      thanksgiving: '#ffb366',
      christmas: '#be95ff',
      new_year: '#42beaa',
      nye: '#42beaa',
      labor: '#e6c068',
      memorial: '#42d392',
      mlk: '#78a9ff',
      presidents: '#78a9ff',
      good_friday: '#c6a0f6',
      easter: '#c6a0f6',
      juneteenth: '#42d392',
      fomc: '#e6c068',
    };
    const tokenName = map[eventId] || (kind === 'event' ? '--fwj-gold' : '--fwj-accent');
    const fallback = fallbacks[eventId] || (kind === 'event' ? '#e6c068' : '#78a9ff');
    return FWJColor.token(tokenName, fallback);
  }

  function weekPrimaryEvent(weekKey, events) {
    const weekEvents = (events || []).filter((ev) => ev.week === weekKey);
    if (!weekEvents.length) return null;
    const priority = { holiday: 0, event: 1 };
    weekEvents.sort((a, b) => {
      const pa = priority[a.kind] ?? 9;
      const pb = priority[b.kind] ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.date || '').localeCompare(b.date || '');
    });
    return weekEvents[0];
  }

  function speedBarStyle(week, accent, events) {
    const primary = weekPrimaryEvent(week.week, events);
    const highlighted = state.highlightWeek === week.week;
    if (primary) {
      const color = speedEventColor(primary.eventId, primary.kind);
      return {
        color: highlighted ? color : colorWithAlpha(color, 0.55),
        opacity: state.highlightWeek && !highlighted ? 0.45 : 1,
        eventId: primary.eventId,
      };
    }
    return {
      color: highlighted ? accent : colorWithAlpha(accent, 0.33),
      opacity: state.highlightWeek && !highlighted ? 0.5 : 1,
      eventId: null,
    };
  }

  function renderSpeedEventsList(speed, weeks, viewWindow) {
    const root = $('#through-line-events-list');
    if (!root) return;
    const filtered = (speed.events || []).filter((ev) => {
      if (!viewWindow) return true;
      return ev.weekEnd >= viewWindow.start && ev.weekStart <= viewWindow.end;
    });
    const weekMap = new Map(weeks.map((w) => [w.week, w]));
    if (!filtered.length) {
      root.innerHTML = `<p class="through-line-events-empty muted">${viewWindow ? `${viewWindow.viewYear} · ` : ''}No holidays or market events in this window</p>`;
      return;
    }
    root.innerHTML = filtered
      .map((ev) => {
        const color = speedEventColor(ev.eventId, ev.kind);
        const days = ev.symbolDays ?? weekMap.get(ev.week)?.symbolDays ?? '—';
        const active = state.highlightWeek === ev.week ? ' active' : '';
        const kindLabel = ev.kind === 'holiday' ? 'Holiday' : 'Event';
        return `<button type="button" class="through-line-event-chip${active}" data-week="${escapeHtml(ev.week)}" data-event-id="${escapeHtml(ev.eventId || '')}" style="--event-color:${color}" title="${escapeHtml(ev.note || ev.label)}">
          <span class="through-line-event-date">${escapeHtml(ev.date)}</span>
          <span class="through-line-event-name">${escapeHtml(ev.label)}</span>
          <span class="through-line-event-days">${days} sym-days</span>
          <span class="through-line-event-kind">${kindLabel}</span>
        </button>`;
      })
      .join('');
    root.querySelectorAll('.through-line-event-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const week = chip.dataset.week;
        if (!week) return;
        state.highlightWeek = state.highlightWeek === week ? null : week;
        if (state.highlightWeek && data?.throughLineHeatmap) {
          const bounds = parseIsoWeek(state.highlightWeek);
          const viewYear = resolveHeatmapViewYear(data.throughLineHeatmap);
          const window = heatmapViewWindow(data.throughLineHeatmap, viewYear);
          if (bounds.endStr < window.start || bounds.startStr > window.end) {
            state.heatmapViewYear = parseInt(bounds.startStr.slice(0, 4), 10);
          }
        }
        disposeThroughLineCharts();
        renderThroughLineHeatmap();
        renderSpeedChart();
      });
    });
  }

  function renderSpeedMeta(speed, weeks, viewWindow) {
    const el = $('#through-line-speed-meta');
    if (!el) return;
    const rangeLabel = viewWindow?.rangeLabel || speed.rangeLabel || formatHeatmapRangeLabel(data?.throughLineHeatmap?.range);
    const peakWeek = weeks.length
      ? weeks.reduce((best, w) => (w.velocity > best.velocity ? w : best), weeks[0])
      : null;
    const current = weeks[weeks.length - 1] || speed.currentWeek;
    const avg = weeks.length
      ? Math.round((weeks.reduce((sum, w) => sum + w.velocity, 0) / weeks.length) * 10) / 10
      : speed.avgVelocity;
    const parts = [];
    if (rangeLabel) parts.push(rangeLabel);
    if (peakWeek) parts.push(`Peak ${peakWeek.week} (${peakWeek.velocity})`);
    if (current) {
      parts.push(`Latest ${current.week} (${current.symbolDays} raw · ${current.velocity} rolling)`);
    }
    if (avg != null) parts.push(`Avg ${avg} rolling/wk`);
    el.textContent = parts.join(' · ');
  }

  function renderSpeedFooter(speed) {
    const el = $('#through-line-speed-footer');
    if (!el) return;
    const count = speed.symbolCount ?? data?.throughLineHeatmap?.symbolsWithData ?? '—';
    el.textContent = `${count} tradable symbols · symbol-day = 1 symbol with a daily bar that date`;
  }

  function renderSpeedChart() {
    const host = $('#through-line-speed');
    if (!host || !data?.throughLineSpeed || typeof echarts === 'undefined') return;
    disposeChartOnHost(host);
    const speed = data.throughLineSpeed;
    const hm = data?.throughLineHeatmap;
    const viewWindow = hm ? heatmapViewWindow(hm, resolveHeatmapViewYear(hm)) : null;
    const weeks = speedWeeksForView(speed, viewWindow);
    if (!weeks.length) {
      host.innerHTML = '<p class="muted">No velocity series in this year — try another year.</p>';
      renderSpeedMeta(speed, [], viewWindow);
      renderSpeedFooter(speed);
      renderSpeedEventsList(speed, [], viewWindow);
      return;
    }
    renderSpeedMeta(speed, weeks, viewWindow);
    renderSpeedFooter(speed);
    renderSpeedEventsList(speed, weeks, viewWindow);
    host.innerHTML = '';
    const theme = FWJColor.chartTheme();
    const accent = FWJColor.token('--fwj-accent', '#78a9ff');
    const gold = FWJColor.token('--fwj-gold', '#e6c068');
    const rollingWindow = speed.rollingWindow || 4;
    const calendarEvents = speed.events || [];
    const labels = weeks.map((w) => w.week);
    const chart = echarts.init(host, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: theme.background,
      legend: {
        data: ['Weekly symbol-days', `${rollingWindow}w rolling avg`],
        top: 0,
        right: 0,
        textStyle: { color: theme.textMuted, fontSize: 9 },
        itemWidth: 10,
        itemHeight: 8,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: theme.heatmapTrack,
        borderColor: theme.heatmapGrid,
        textStyle: { color: theme.text, fontSize: 11 },
        formatter: (params) => {
          const idx = params[0]?.dataIndex;
          if (idx == null) return '';
          const w = weeks[idx];
          const lines = [
            `<strong>${w.week}</strong>`,
            `${w.weekStart} → ${w.weekEnd}`,
            `Weekly: <strong>${w.symbolDays}</strong> symbol-days`,
            `${rollingWindow}w avg: <strong>${w.velocity}</strong>`,
            formatSpeedDelta(w.deltaSymbolDays, w.deltaPct),
          ];
          const weekEvents = calendarEvents.filter((ev) => ev.week === w.week);
          if (weekEvents.length) {
            lines.push(
              weekEvents.map((ev) => `<span style="opacity:.85">${ev.label}${ev.note ? ` · ${ev.note}` : ''}</span>`).join('<br/>')
            );
          } else {
            const ann = (speed.annotations || []).find((a) => a.week === w.week);
            if (ann?.note) lines.push(`<span style="opacity:.8">${ann.label}: ${ann.note}</span>`);
          }
          lines.push(
            state.highlightWeek === w.week
              ? '<span style="opacity:.75">Click bar to clear heatmap highlight</span>'
              : '<span style="opacity:.75">Click bar to highlight week on heatmap</span>'
          );
          return lines.join('<br/>');
        },
      },
      grid: { left: 42, right: 14, top: 28, bottom: 34 },
      dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          color: theme.textMuted,
          fontSize: 9,
          interval: 0,
          formatter: (value, index) => speedAxisLabel(value, index, weeks),
        },
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: 'symbol-days/wk',
        nameTextStyle: { color: theme.textMuted, fontSize: 9 },
        axisLabel: { color: theme.textMuted, fontSize: 9 },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      series: [
        {
          name: 'Weekly symbol-days',
          type: 'bar',
          data: weeks.map((w) => {
            const style = speedBarStyle(w, accent, calendarEvents);
            return {
              value: w.symbolDays,
              itemStyle: {
                color: style.color,
                opacity: style.opacity,
              },
            };
          }),
          barMaxWidth: 14,
        },
        {
          name: `${rollingWindow}w rolling avg`,
          type: 'line',
          data: weeks.map((w) => w.velocity),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: gold, width: 2 },
        },
      ],
    });
    chart.on('click', (params) => {
      if (params.componentType !== 'series' || params.seriesType !== 'bar') return;
      const week = weeks[params.dataIndex]?.week;
      if (!week) return;
      state.highlightWeek = state.highlightWeek === week ? null : week;
      if (state.highlightWeek && data?.throughLineHeatmap) {
        const bounds = parseIsoWeek(state.highlightWeek);
        const viewWindow = heatmapViewWindow(data.throughLineHeatmap, resolveHeatmapViewYear(data.throughLineHeatmap));
        if (bounds.endStr < viewWindow.start || bounds.startStr > viewWindow.end) {
          state.heatmapViewYear = parseInt(bounds.startStr.slice(0, 4), 10);
        }
      }
      disposeThroughLineCharts();
      renderThroughLineHeatmap();
      renderSpeedChart();
    });
    tlCharts.push(chart);
    requestAnimationFrame(() => chart.resize());
  }

  function bindHeatmapYearNav() {
    const prev = $('#through-line-heatmap-prev');
    const next = $('#through-line-heatmap-next');
    if (!prev || !next || prev.dataset.bound === '1') return;
    prev.dataset.bound = '1';
    next.dataset.bound = '1';
    prev.addEventListener('click', () => shiftHeatmapYear(-1));
    next.addEventListener('click', () => shiftHeatmapYear(1));
  }

  function bindThroughLineListYear() {
    const slider = $('#through-line-list-year');
    const output = $('#through-line-list-year-value');
    if (!slider || slider.dataset.bound === '1') return;
    slider.dataset.bound = '1';
    const { min, max } = listYearBounds();
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(activeListYear());
    if (output) output.textContent = slider.value;
    const forbesSlider = $('#forbes-list-year');
    if (forbesSlider?.value) {
      state.filterListYear = Number(forbesSlider.value);
      slider.value = forbesSlider.value;
      if (output) output.textContent = forbesSlider.value;
    }
    slider.addEventListener('input', () => {
      state.filterListYear = Number(slider.value);
      if (output) output.textContent = slider.value;
      renderContextRail('#through-line-context-rail');
      renderThroughLineForbesUsers();
      renderThroughLineUniverse();
      if (state.compressionViewMode === 'year') {
        renderCompressionMeta();
        renderCompressionYearNav();
        renderCompression();
      }
    });
    window.addEventListener('forbes:listYear', (e) => {
      const year = e.detail?.year;
      if (year == null) return;
      slider.value = String(year);
      state.filterListYear = year;
      if (output) output.textContent = String(year);
      renderContextRail('#through-line-context-rail');
      renderThroughLineForbesUsers();
      if (state.compressionViewMode === 'year') {
        renderCompressionMeta();
        renderCompressionYearNav();
        renderCompression();
      }
    });
  }

  function bindThroughLineFilter() {
    const input = $('#through-line-filter');
    if (!input) return;
    input.addEventListener('input', () => {
      state.throughLineQuery = input.value;
      renderThroughLineUniverse();
    });
  }

  function bindThroughLineSort() {
    const toolbar = $('#through-line-sort-toolbar');
    if (!toolbar || toolbar.dataset.bound === '1') return;
    toolbar.dataset.bound = '1';
    toolbar.querySelectorAll('.through-line-sort-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sort = btn.dataset.sort;
        if (!sort || state.throughLineSort === sort) return;
        state.throughLineSort = sort;
        toolbar.querySelectorAll('.through-line-sort-chip').forEach((chip) => {
          const active = chip.dataset.sort === sort;
          chip.classList.toggle('active', active);
          chip.setAttribute('aria-pressed', String(active));
        });
        renderThroughLineUniverse();
      });
    });
  }

  function compressionYearBounds() {
    const hm = data?.throughLineHeatmap;
    if (hm) {
      const { minYear, maxYear } = heatmapDataBounds(hm);
      return { min: minYear, max: maxYear };
    }
    const cov = historicalIndex?.dataCoverage || {};
    return {
      min: 2023,
      max: cov.sliderMaxYear || listYearBounds().max || 2026,
    };
  }

  function isCompressionAllTime() {
    return state.compressionViewMode === 'alltime';
  }

  function activeCompressionYear() {
    const { min, max } = compressionYearBounds();
    const year = activeListYear();
    return Math.max(min, Math.min(max, year));
  }

  function compressionYearLabel() {
    return isCompressionAllTime() ? 'All Time' : String(activeCompressionYear());
  }

  function syncCompressionYearExternal(year) {
    if (year == null) return;
    state.filterListYear = year;
    const forbesSlider = $('#forbes-list-year');
    if (forbesSlider) {
      const min = Number(forbesSlider.min) || year;
      const max = Number(forbesSlider.max) || year;
      if (year >= min && year <= max && Number(forbesSlider.value) !== year) {
        forbesSlider.value = String(year);
        const output = $('#forbes-list-year-value');
        if (output) output.textContent = String(year);
        forbesSlider.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        window.dispatchEvent(new CustomEvent('forbes:listYear', { detail: { year } }));
        if (window.FlipOverlayChart?.setListYearHighlight) {
          window.FlipOverlayChart.setListYearHighlight(year);
        }
      }
      return;
    }
    const tlSlider = $('#through-line-list-year');
    const tlOutput = $('#through-line-list-year-value');
    if (tlSlider) {
      const min = Number(tlSlider.min) || year;
      const max = Number(tlSlider.max) || year;
      if (year >= min && year <= max) {
        tlSlider.value = String(year);
        if (tlOutput) tlOutput.textContent = String(year);
      }
    }
    window.dispatchEvent(new CustomEvent('forbes:listYear', { detail: { year } }));
    if (window.FlipOverlayChart?.setListYearHighlight) {
      window.FlipOverlayChart.setListYearHighlight(year);
    }
  }

  function setCompressionViewMode(mode, { year } = {}) {
    const next = mode === 'alltime' ? 'alltime' : 'year';
    if (next === state.compressionViewMode && (year == null || activeCompressionYear() === year)) {
      renderCompressionYearNav();
      return;
    }
    state.compressionViewMode = next;
    if (next === 'year') {
      const target = year ?? activeCompressionYear();
      syncCompressionYearExternal(target);
    }
    renderCompressionMeta();
    renderCompressionYearNav();
    renderCompression();
  }

  function stepCompressionYear(delta) {
    if (!delta) return;
    const { min, max } = compressionYearBounds();
    if (isCompressionAllTime()) {
      if (delta < 0) setCompressionViewMode('year', { year: max });
      return;
    }
    const current = activeCompressionYear();
    const next = current + delta;
    if (next < min) {
      setCompressionViewMode('alltime');
      return;
    }
    if (next > max) return;
    state.compressionViewMode = 'year';
    syncCompressionYearExternal(next);
    renderCompressionMeta();
    renderCompressionYearNav();
    renderCompression();
  }

  /** Year view: only timeframes with a flip in the selected calendar year; recompute squeeze. */
  function filterCompressionForYear(comp, year) {
    if (!comp || year == null) return comp;
    const timeframes = comp.timeframes || {};
    const filteredTf = {};
    let insideCount = 0;
    const flipTypes = [];
    TF_ORDER.forEach((tf) => {
      const f = timeframes[tf];
      if (!f?.lastFlip?.date) return;
      if (!String(f.lastFlip.date).startsWith(String(year))) return;
      if (f.bbPosition === 'inside') insideCount += 1;
      const ft = f.lastFlip.type;
      if (ft) flipTypes.push(ft);
      filteredTf[tf] = f;
    });
    if (!Object.keys(filteredTf).length) return null;
    let squeeze = Math.min(
      100,
      insideCount * 18 + flipTypes.filter((t) => (t || '').includes('squeeze')).length * 12
    );
    if (insideCount >= 3) squeeze = Math.min(100, squeeze + 15);
    return {
      ...comp,
      squeezeScore: squeeze,
      insideCount,
      timeframes: filteredTf,
    };
  }

  function holdingHasActivityInYear(h, year) {
    if (year == null) return true;
    const dates = h.sparklineDates || [];
    if (dates.some((d) => d.startsWith(String(year)))) return true;
    const ipoPts = h.ipoChart?.points || [];
    if (ipoPts.some((p) => (p.date || '').startsWith(String(year)))) return true;
    if (!dates.length && !h.hasChart) return true;
    return false;
  }

  function sliceHoldingForCompressionYear(h, year) {
    if (isCompressionAllTime() || year == null) return h;
    const dates = h.sparklineDates || [];
    const vals = h.sparkline || [];
    if (!dates.length || !vals.length) return h;
    const indices = [];
    dates.forEach((d, i) => {
      if (d.startsWith(String(year))) indices.push(i);
    });
    if (indices.length < 2) {
      return {
        ...h,
        sparkline: [],
        sparklineDates: [],
        hasChart: false,
        tradingDaysRecent: 0,
      };
    }
    const start = indices[0];
    const end = indices[indices.length - 1];
    return {
      ...h,
      sparkline: vals.slice(start, end + 1),
      sparklineDates: dates.slice(start, end + 1),
      hasChart: true,
      tradingDaysRecent: indices.length,
      lastActiveDate: dates[end],
    };
  }

  function prepareHoldingForCompressionView(h, year) {
    if (isCompressionAllTime()) return h;
    if (!holdingHasActivityInYear(h, year)) return null;
    const sliced = sliceHoldingForCompressionYear(h, year);
    const comp = sliced.compression ? filterCompressionForYear(sliced.compression, year) : null;
    if (!comp && !sliced.hasChart && !(sliced.ipoChart || {}).hasChart) {
      return { ...sliced, compression: null };
    }
    return { ...sliced, compression: comp };
  }

  function preparePersonForCompressionView(person, year) {
    const holdings = (person.holdings || [])
      .map((h) => prepareHoldingForCompressionView(h, year))
      .filter(Boolean);
    if (!holdings.length && !isCompressionAllTime()) return null;
    const activeCount = holdings.filter((h) => h.lastActiveDate || h.tradingDaysRecent > 0).length;
    return {
      ...person,
      holdings,
      holdingCount: holdings.length,
      activeHoldingCount: activeCount,
      wealth: {
        ...(person.wealth || {}),
        value: netWorthAtYear(person.rank, year) ?? person.wealth?.value,
      },
    };
  }

  function compressionRowsForView() {
    let rows = filteredForbesRankings();
    if (isCompressionAllTime()) {
      return rows.map((person) => ({
        ...person,
        yearRank: person.rank,
      }));
    }
    const year = activeCompressionYear();
    const rankSnap = yearRankSnapshot(year);
    rows = rows
      .map((person) => preparePersonForCompressionView(person, year))
      .filter(Boolean);
    rows.sort((a, b) => {
      const ra = rankSnap.get(a.rank)?.yearRank ?? 9999;
      const rb = rankSnap.get(b.rank)?.yearRank ?? 9999;
      return ra - rb;
    });
    return rows.map((person) => {
      const snap = rankSnap.get(person.rank);
      return {
        ...person,
        yearRank: snap?.yearRank ?? null,
        wealth: {
          ...(person.wealth || {}),
          value: snap?.netWorthB ?? person.wealth?.value,
        },
      };
    });
  }

  function buildCompressionSummaryFiltered(rows) {
    const holdings = rows.flatMap((p) => p.holdings || []);
    const withSqueeze = holdings.filter((h) => h.compression?.squeezeScore != null);
    const activeDays = holdings.reduce((n, h) => n + (h.tradingDaysRecent || 0), 0);
    if (!withSqueeze.length) {
      return {
        winner: null,
        winnerEntity: null,
        winPct: 0,
        avgSqueezePct: 0,
        tiedAtTop: 0,
        totalTickers: withSqueeze.length,
        activeDays,
        holdings: holdings.length,
        people: rows.length,
      };
    }
    const scores = withSqueeze.map((h) => h.compression.squeezeScore || 0);
    const topScore = Math.max(...scores);
    const tied = withSqueeze.filter((h) => (h.compression.squeezeScore || 0) === topScore);
    tied.sort((a, b) => (a.compression.ticker || '').localeCompare(b.compression.ticker || ''));
    const leader = tied[0];
    return {
      winner: leader.compression.ticker,
      winnerEntity: leader.compression.entity || leader.entity,
      winPct: Math.round((topScore * 100) / 100),
      avgSqueezePct: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      tiedAtTop: tied.length,
      totalTickers: withSqueeze.length,
      activeDays,
      holdings: holdings.length,
      people: rows.length,
    };
  }

  function renderCompressionYearNav() {
    const root = $('#compression-year-nav');
    if (!root) return;
    const { min, max } = compressionYearBounds();
    const allTimeActive = isCompressionAllTime();
    const year = activeCompressionYear();
    const atMin = !allTimeActive && year <= min;
    const prevToAllTime = !allTimeActive && atMin;
    const prevDisabled = allTimeActive ? false : atMin;
    const nextDisabled = allTimeActive || year >= max;
    const chips = [];
    for (let y = min; y <= max; y++) {
      chips.push(
        `<button type="button" class="compression-year-chip${!allTimeActive && year === y ? ' active' : ''}" data-year="${y}" aria-pressed="${!allTimeActive && year === y}">${y}</button>`
      );
    }
    root.innerHTML = `
      <div class="compression-toolbar-group">
        <span class="compression-toolbar-label">Year</span>
        <div class="compression-year-chips">
          <button type="button" class="compression-year-chip compression-year-chip-alltime${allTimeActive ? ' active' : ''}" data-mode="alltime" aria-pressed="${allTimeActive}">All Time</button>
          ${chips.join('')}
        </div>
      </div>
      <span class="compression-year-nav-sep" aria-hidden="true"></span>
      <button type="button" class="compression-year-nav${prevToAllTime ? ' compression-year-nav-alltime' : ''}" id="compression-year-prev"${prevDisabled ? ' disabled' : ''} aria-label="${prevToAllTime ? 'All Time' : 'Previous year'}" title="${prevToAllTime ? 'All Time' : 'Previous year'}">‹</button>
      <span class="compression-year-nav-label" aria-live="polite">${compressionYearLabel()}</span>
      <button type="button" class="compression-year-nav" id="compression-year-next"${nextDisabled ? ' disabled' : ''} aria-label="Next year" title="Next year">›</button>`;
  }

  function bindCompressionListYearSync() {
    if (window.__fwjCompressionListYearSync) return;
    window.__fwjCompressionListYearSync = true;
    window.addEventListener('forbes:listYear', (e) => {
      const year = e.detail?.year;
      if (year == null) return;
      state.filterListYear = year;
      if (state.compressionViewMode !== 'year') return;
      renderCompressionMeta();
      renderCompressionYearNav();
      renderCompression();
    });
  }

  function bindCompressionYearNav() {
    const host = $('#compression-year-nav');
    if (!host || host.dataset.bound === '1') return;
    host.dataset.bound = '1';
    host.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.compression-year-chip');
      if (chip) {
        if (chip.dataset.mode === 'alltime') {
          setCompressionViewMode('alltime');
          return;
        }
        const year = Number(chip.dataset.year);
        if (!Number.isNaN(year)) setCompressionViewMode('year', { year });
        return;
      }
      if (ev.target.closest('#compression-year-prev')) stepCompressionYear(-1);
      else if (ev.target.closest('#compression-year-next')) stepCompressionYear(1);
    });
  }

  function renderCompressionMeta() {
    const el = $('#compression-meta');
    if (!el || !data) return;
    const parts = [];
    const rows = compressionRowsForView();
    const yearNote = isCompressionAllTime() ? '' : ` · ${activeCompressionYear()}`;
    if (!isCompressionAllTime()) {
      const filtered = buildCompressionSummaryFiltered(rows);
      parts.push(
        `${filtered.people} billionaires · ${filtered.holdings} holdings · ${filtered.activeDays} active days${yearNote}`
      );
      if (filtered.totalTickers) {
        const tie = filtered.tiedAtTop > 1 ? ` · ${filtered.tiedAtTop}-way tie` : '';
        const entity = filtered.winnerEntity ? ` · ${escapeHtml(filtered.winnerEntity)}` : '';
        parts.push(
          `<strong class="meta-winner">${escapeHtml(filtered.winner || '—')}</strong> squeeze${entity}${tie} · ${filtered.winPct}% · avg ${filtered.avgSqueezePct}% · ${filtered.totalTickers} squeeze`
        );
      } else {
        parts.push(`No squeeze signals in ${activeCompressionYear()}`);
      }
    } else {
      const frs = data.forbesRankingsSummary;
      if (frs?.people) {
        parts.push(
          `${frs.people} billionaires · ${frs.holdings ?? 0} holdings · ${frs.activeHoldings ?? 0} active · ${frs.withChart ?? 0} charts · ${frs.withIpoChart ?? 0} IPO · ${frs.withCompression ?? 0} squeeze`
        );
      }
      const s = data.compressionSummary;
      if (s?.totalTickers) {
        const tie = s.tiedAtTop > 1 ? ` · ${s.tiedAtTop}-way tie` : '';
        const entity = s.winnerEntity ? ` · ${escapeHtml(s.winnerEntity)}` : '';
        parts.push(
          `<strong class="meta-winner">${escapeHtml(s.winner)}</strong> squeeze${entity}${tie} · ${s.winPct}% · avg ${s.avgSqueezePct}%`
        );
      }
    }
    el.innerHTML = parts.length ? parts.join(' · ') : '';
  }

  const NARRATIVE_KIND_LABELS = {
    alignment: 'Align',
    flip_signal: 'Flip',
    theme: 'Theme',
  };

  function localIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function throughLineNarrativeSortKey(n) {
    if (n.flipDate) return n.flipDate;
    if (n.daysApart != null && data?.asOf) {
      const base = new Date(`${data.asOf}T12:00:00`);
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() - n.daysApart);
        return localIsoDate(base);
      }
    }
    return '';
  }

  function throughLineNarrativeDateLabel(n) {
    const key = throughLineNarrativeSortKey(n);
    if (!key) return '—';
    const d = new Date(`${key}T12:00:00`);
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function throughLineNarrativeAccent(n) {
    if (n.kind === 'flip_signal') return kindColor('flip');
    if (n.kind === 'theme') return kindColor('grok_branch');
    return kindColor('milestone');
  }

  /** Newest first — matches pre-sorted stream feed (`sortKey` descending). */
  function throughLineNarrativeSort(a, b) {
    const da = throughLineNarrativeSortKey(a);
    const db = throughLineNarrativeSortKey(b);
    if (da !== db) return db.localeCompare(da);
    const sa = a.alignmentScore ?? -1;
    const sb = b.alignmentScore ?? -1;
    if (sa !== sb) return sb - sa;
    const kindOrder = { alignment: 0, flip_signal: 1, theme: 2 };
    const ka = kindOrder[a.kind] ?? 9;
    const kb = kindOrder[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    return (a.ticker || '').localeCompare(b.ticker || '');
  }

  function throughLineRankLabel(n) {
    const ranks = n.forbesRanks?.length ? n.forbesRanks : n.forbesRank != null ? [n.forbesRank] : [];
    if (!ranks.length) return '';
    if (ranks.length === 1) return `#${ranks[0]}`;
    return `#${ranks[0]}–#${ranks[ranks.length - 1]}`;
  }

  function filteredThroughLineNarratives() {
    let items = [...(data?.narratives || [])];
    if (state.filterTicker) {
      items = items.filter((n) => n.ticker === state.filterTicker);
    }
    return items.sort(throughLineNarrativeSort);
  }

  function renderThroughLineNarrativesSummary(items) {
    const el = document.querySelector('.through-line-narratives-summary');
    if (!el) return;
    const tickers = new Set(items.filter((n) => n.ticker).map((n) => n.ticker));
    const suffix =
      tickers.size && items.length
        ? ` · ${tickers.size} ${tickers.size === 1 ? 'company' : 'companies'} · ${items.length} ${items.length === 1 ? 'card' : 'cards'}`
        : '';
    const filter = state.filterTicker ? ` · ${state.filterTicker}` : '';
    el.textContent = `Narrative hooks${suffix}${filter}`;
  }

  function renderThroughLine() {
    const root = $('#through-line-cards');
    if (!root || !data) return;
    const items = filteredThroughLineNarratives();
    renderThroughLineNarrativesSummary(items);
    if (!items.length) {
      root.innerHTML = state.filterTicker
        ? `<p class="muted">No narrative hooks for ${escapeHtml(state.filterTicker)}.</p>`
        : '<p class="muted">Rebuild with forbes_crossover.py for lifecycle↔flip alignments.</p>';
      return;
    }
    root.innerHTML = items
      .map(
        (n) => {
          const accent = throughLineNarrativeAccent(n);
          const dateLabel = throughLineNarrativeDateLabel(n);
          const kindLabel = NARRATIVE_KIND_LABELS[n.kind] || n.kind || '';
          return `
      <article class="through-card"${n.ticker ? ` data-ticker="${escapeHtml(n.ticker)}"` : ''}${n.branch ? ` data-branch="${escapeHtml(n.branch)}"` : ''}${n.kind ? ` data-kind="${escapeHtml(n.kind)}"` : ''} style="--through-accent:${accent}">
        <div class="through-rail" aria-hidden="true"><span class="through-rail-dot"></span></div>
        <div class="through-indicator">
          <time class="through-indicator-date" datetime="${escapeHtml(throughLineNarrativeSortKey(n))}">${escapeHtml(dateLabel)}</time>
          ${kindLabel ? `<span class="through-indicator-kind">${escapeHtml(kindLabel)}</span>` : ''}
        </div>
        <div class="through-card-body">
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.subtitle || '')}${n.daysApart != null ? ` · ${n.daysApart}d apart` : ''}</p>
          ${
            n.ticker
              ? `<ul class="through-refs"><li>${escapeHtml(n.ticker)}${n.entity ? ` · ${escapeHtml(n.entity)}` : ''}${throughLineRankLabel(n) ? ` · Forbes ${escapeHtml(throughLineRankLabel(n))}` : ''}${n.lifecycleType ? ` · ${escapeHtml(n.lifecycleType)}` : ''}${n.alignmentScore != null && n.kind !== 'theme' ? ` · score ${n.alignmentScore}` : ''}</li></ul>`
              : ''
          }
        </div>
      </article>`;
        }
      )
      .join('');
  }

  const TF_ORDER = ['quarter', 'month', 'week', 'day'];
  const TF_LABEL = { quarter: 'Q', month: 'M', week: 'W', day: 'D' };

  function renderCompressionFrames(c) {
    const tfs = (c?.timeframes) || {};
    return TF_ORDER.map((tf) => {
      const f = tfs[tf];
      if (!f) {
        return `<div class="frame-badge empty"><span class="frame-tf">${TF_LABEL[tf]}</span><span class="frame-flip">—</span></div>`;
      }
      const flip = f.lastFlip?.label || flipLabel(f.lastFlip?.type);
      return `
      <div class="frame-badge">
        <span class="frame-tf">${TF_LABEL[tf]}</span>
        <span class="frame-flip">${escapeHtml(flip)}</span>
        <span class="frame-pill" data-kind="${biasKind(f.macdBias)}">${escapeHtml(f.macdBias || '—')}</span>
      </div>`;
    }).join('');
  }

  function formatWealth(wealth) {
    if (!wealth?.value) return '';
    const unit = wealth.unit === 'B' ? 'B' : wealth.unit || '';
    return `$${wealth.value}${unit}`;
  }

  function drawHoldingSparklines(root) {
    root.querySelectorAll('.holding-spark, .holding-ipo-spark').forEach((canvas) => {
      const raw = canvas.dataset.spark;
      if (!raw) return;
      const vals = raw.split(',').map(Number).filter((n) => !Number.isNaN(n));
      if (vals.length < 2) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width;
      const h = rect.height;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const pad = 2;
      const last = vals[vals.length - 1];
      const first = vals[0];
      const isIpo = canvas.classList.contains('holding-ipo-spark');
      const stroke = isIpo
        ? FWJColor.token('--fwj-gold', '#e6c068')
        : last >= first
          ? FWJColor.token('--fwj-bull', '#42d392')
          : FWJColor.token('--fwj-bear', '#f07178');
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      vals.forEach((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
        const y = pad + ((max - v) / (max - min || 1)) * (h - pad * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  const CONNECTION_RELATION_ORDER = { merger: 0, acquisition: 1, ipo: 2, 'co-held': 3 };

  function relationLabel(relation) {
    const labels = {
      merger: 'merger',
      acquisition: 'acquired',
      ipo: 'IPO',
      'co-held': 'co-held',
    };
    return labels[relation] || relation || 'link';
  }

  function sortedConnections(conns) {
    return [...(conns || [])].sort((a, b) => {
      const ra = CONNECTION_RELATION_ORDER[a.relation] ?? 9;
      const rb = CONNECTION_RELATION_ORDER[b.relation] ?? 9;
      if (ra !== rb) return ra - rb;
      return (a.entity || '').localeCompare(b.entity || '');
    });
  }

  function connectionIsActive(c) {
    if (c.ticker && state.filterTicker === c.ticker) return true;
    if (c.entityId && state.filterEntityId === c.entityId) return true;
    return false;
  }

  function renderIpoChartBlock(h) {
    const chart = h.ipoChart;
    if (!chart) return '';
    const hasSpark = chart.sparkline?.length > 1;
    const events = (chart.points || []).slice(-4);
    const eventHtml = events.length
      ? `<ul class="holding-ipo-events">${events
          .map((ev) => {
            const val =
              ev.valueUsdB != null
                ? `$${ev.valueUsdB}B`
                : ev.metricUsdB != null
                  ? `$${ev.metricUsdB}B rev`
                  : ev.form || '';
            const date = ev.date ? ev.date.slice(0, 7) : '';
            return `<li><span class="ipo-ev-date">${escapeHtml(date)}</span> ${escapeHtml(ev.title || '')}${val ? ` · <span class="ipo-ev-val">${escapeHtml(val)}</span>` : ''}</li>`;
          })
          .join('')}</ul>`
      : '';
    const sparkHtml = hasSpark
      ? `<canvas class="holding-ipo-spark" data-spark="${chart.sparkline.join(',')}" width="160" height="36" aria-hidden="true"></canvas>`
      : '';
    return `
      <div class="holding-ipo-chart">
        <div class="holding-ipo-head">
          <span class="holding-ipo-label">IPO / valuation</span>
          ${chart.publicTicker ? `<span class="holding-ipo-ticker">${escapeHtml(chart.publicTicker)}</span>` : ''}
          ${chart.status ? `<span class="holding-ipo-status">${escapeHtml(chart.status.replace(/_/g, ' '))}</span>` : ''}
        </div>
        ${sparkHtml}
        ${eventHtml}
      </div>`;
  }

  function renderConnectionsBlock(h) {
    const conns = sortedConnections(h.connections);
    if (!conns.length) return '';
    return `
      <div class="holding-connections">
        <span class="holding-connections-label">Merging / connected</span>
        <div class="holding-connection-chips">
          ${conns
            .map(
              (c) => `
            <button type="button" class="holding-connection-chip${connectionIsActive(c) ? ' active' : ''}" data-relation="${escapeHtml(c.relation || '')}" data-ticker="${escapeHtml(c.ticker || '')}" data-entity-id="${escapeHtml(c.entityId || '')}" title="${escapeHtml(c.title || c.entity || '')}${c.date ? ` · ${c.date}` : ''}">
              <span class="conn-relation">${escapeHtml(relationLabel(c.relation))}</span>
              <span class="conn-entity">${escapeHtml(c.ticker || c.entity || '')}</span>
            </button>`
            )
            .join('')}
        </div>
      </div>`;
  }

  function renderHoldingRow(h, person) {
    const comp = h.compression;
    const active = holdingIsActive(h) ? ' active' : '';
    const recent = h.tradingDaysRecent > 0;
    const tickerLabel = h.ticker || h.dataTicker || h.ipoChart?.publicTicker || 'private';
    const priceSpark =
      h.sparkline?.length > 1
        ? `<canvas class="holding-spark" data-spark="${h.sparkline.join(',')}" width="120" height="32" aria-hidden="true"></canvas>`
        : '';
    const showIpoChart =
      h.ipoChart &&
      ((h.ipoChart.points || []).length > 0 || h.ipoChart.hasChart) &&
      ((h.type || '').toLowerCase() === 'private' || !priceSpark);
    const ipoBlock = showIpoChart ? renderIpoChartBlock(h) : '';
    const emptyChart =
      !priceSpark && !ipoBlock ? `<span class="holding-no-chart">no chart data</span>` : '';
    const squeezeBlock = comp
      ? `
        <div class="holding-squeeze">
          <div class="holding-squeeze-head">
            <span class="compression-score" data-level="${scoreLevel(comp.squeezeScore || 0)}">${comp.squeezeScore ?? 0}</span>
            <span class="compression-score-label">squeeze</span>
          </div>
          <div class="compression-frames">${renderCompressionFrames(comp)}</div>
        </div>`
      : '';
    const activeBadge = recent
      ? `<span class="holding-active-badge" title="Last trade ${escapeHtml(h.lastActiveDate || '')}">${h.tradingDaysRecent}d active</span>`
      : '';
    return `
    <div class="holding-row${active}${recent ? ' holding-recent' : ''}" data-ticker="${escapeHtml(h.dataTicker || h.ticker || '')}" data-entity-id="${escapeHtml(h.entityId || '')}" data-rank="${person.rank}">
      <div class="holding-meta">
        <div class="holding-meta-top">
          <span class="holding-ticker">${escapeHtml(tickerLabel)}</span>
          ${activeBadge}
        </div>
        <span class="holding-entity">${escapeHtml(h.entity || '')}</span>
        ${h.valueUsdB != null ? `<span class="holding-value">$${h.valueUsdB}B</span>` : ''}
      </div>
      <div class="holding-body">
        <div class="holding-chart">
          ${priceSpark}
          ${ipoBlock}
          ${emptyChart}
          ${squeezeBlock}
        </div>
        ${renderConnectionsBlock(h)}
      </div>
    </div>`;
  }

  function filteredForbesRankings() {
    const rows = (data.forbesRankings || []).filter((p) => (p.holdings || []).length);
    if (!state.filterTicker && !state.filterEntityId && state.filterRank == null) return rows;
    return rows.filter((p) => {
      if (state.filterRank != null && p.rank === state.filterRank) return true;
      if (state.filterTicker || state.filterEntityId) {
        return (p.holdings || []).some((h) => holdingMatchesFilter(h));
      }
      return false;
    });
  }

  let compressionRenderStats = { people: 0, holdings: 0 };

  function renderCompression() {
    const root = $('#compression-grid');
    if (!root || !data) return;
    renderCompressionYearNav();
    const rows = compressionRowsForView();
    compressionRenderStats = {
      people: rows.length,
      holdings: rows.reduce((n, p) => n + (p.holdings || []).length, 0),
    };
    if (!rows.length) {
      root.innerHTML = isCompressionAllTime()
        ? '<p class="muted">No Forbes holdings — rebuild with build_industry_stream.py</p>'
        : `<p class="muted">No tradable Forbes holdings in ${activeCompressionYear()} — try All Time or another year.</p>`;
      return;
    }
    root.innerHTML = rows
      .map((person) => {
        const active =
          state.filterRank === person.rank ||
          (person.holdings || []).some((h) => holdingIsActive(h))
            ? ' active'
            : '';
        const year = isCompressionAllTime() ? null : activeCompressionYear();
        const wealth = formatWealth(person.wealth);
        const rankTitle = year
          ? `Forbes #${person.yearRank ?? person.rank} in ${year}`
          : `Forbes #${person.rank} (latest)`;
        return `
        <article class="forbes-person compression-row${active}" data-rank="${person.rank}">
          <div class="forbes-person-left compression-row-left">
            <header class="compression-person-head forbes-person-head">
              <span class="compression-person-rank" title="${escapeHtml(rankTitle)}">${compressionRankLabel(person, year)}</span>
              <span class="compression-person-name">${escapeHtml(person.name)}</span>
              <span class="compression-person-sector">${escapeHtml(person.sector || '')}</span>
              ${wealth ? `<span class="forbes-person-wealth">${escapeHtml(wealth)}</span>` : ''}
            </header>
            <span class="forbes-person-count">${person.holdingCount ?? 0} holdings${person.activeHoldingCount ? ` · ${person.activeHoldingCount} active` : ''}</span>
          </div>
          <div class="forbes-person-holdings">
            ${(person.holdings || []).map((h) => renderHoldingRow(h, person)).join('')}
          </div>
        </article>`;
      })
      .join('');

    drawHoldingSparklines(root);

    root.querySelectorAll('.holding-row').forEach((row) => {
      const ticker = row.dataset.ticker;
      const entityId = row.dataset.entityId;
      if (!ticker && !entityId) return;
      const pick = (e) => {
        if (e?.target?.closest('.holding-connection-chip')) return;
        if (e) e.stopPropagation();
        applyHoldingFilter({
          ticker: entityId ? null : ticker || null,
          entityId: entityId || null,
          rank: Number(row.dataset.rank) || null,
        });
      };
      row.addEventListener('click', pick);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick(e);
        }
      });
      row.setAttribute('tabindex', '0');
    });

    root.querySelectorAll('.holding-connection-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticker = chip.dataset.ticker;
        const entityId = chip.dataset.entityId;
        const row = chip.closest('.holding-row');
        const rank = row ? Number(row.dataset.rank) || null : state.filterRank;
        applyHoldingFilter({
          ticker: ticker || null,
          entityId: ticker ? null : entityId || null,
          rank,
        });
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

  const sectorState = { slug: null, raw: null };

  function collectSectorSymbolCounts(sectorData) {
    const counts = new Map();
    for (const group of sectorData?.groups || []) {
      for (const branch of group.branches || []) {
        for (const ev of branch.events || []) {
          const sym = String(ev.symbol || '').toUpperCase();
          if (!sym) continue;
          counts.set(sym, (counts.get(sym) || 0) + 1);
        }
      }
    }
    return counts;
  }

  function filterSectorByTicker(sectorData, ticker) {
    if (!ticker || !sectorData) return sectorData;
    const t = ticker.toUpperCase();
    return {
      ...sectorData,
      groups: (sectorData.groups || []).map((group) => ({
        ...group,
        branches: (group.branches || []).map((branch) => ({
          ...branch,
          events: (branch.events || []).filter((ev) => String(ev.symbol || '').toUpperCase() === t),
        })),
      })),
    };
  }

  function sectorBundleSymbolContext(ticker) {
    const t = String(ticker || '').toUpperCase();
    if (!t) return null;
    const fromBundle = (sectorState.raw?.symbols || []).find(
      (s) => String(s.ticker || s.symbol || '').toUpperCase() === t,
    );
    if (!fromBundle) return null;
    return {
      ticker: t,
      name: fromBundle.entity || fromBundle.name || t,
      entity: fromBundle.entity || fromBundle.name,
      sector: fromBundle.sector || sectorState.raw?.sector,
      forbesRank: fromBundle.forbesRank ?? null,
      forbesName: fromBundle.forbesName ?? null,
    };
  }

  function companyContextForTicker(ticker) {
    const t = String(ticker || '').toUpperCase();
    if (!t) return { ticker: t, name: t };

    const fromBundle = sectorBundleSymbolContext(t);
    if (fromBundle) return fromBundle;

    const fromCompression = (data?.compression || []).find((c) => c.ticker === t);
    if (fromCompression) {
      return {
        ticker: t,
        name: fromCompression.entity || fromCompression.name || t,
        entity: fromCompression.entity,
        sector: fromCompression.sector,
        forbesRank: fromCompression.forbesRank,
        forbesName: fromCompression.forbesName,
      };
    }

    const fromUniverse = (data?.throughLineUniverse || []).find((c) => c.ticker === t);
    if (fromUniverse) {
      return {
        ticker: t,
        name: fromUniverse.name || t,
        entity: fromUniverse.name,
        sector: fromUniverse.sector || fromUniverse.type,
        forbesRank: null,
        forbesName: null,
      };
    }

    for (const person of data?.forbesRankings || []) {
      for (const h of person.holdings || []) {
        const ht = String(h.dataTicker || h.ticker || '').toUpperCase();
        if (ht === t) {
          return {
            ticker: t,
            name: h.entity || h.ticker || t,
            entity: h.entity,
            sector: person.sector,
            forbesRank: person.rank,
            forbesName: person.name,
          };
        }
      }
    }

    for (const row of data?.interlinks || []) {
      if (row.ticker === t) {
        return {
          ticker: t,
          name: row.entity || row.name || t,
          entity: row.entity,
          sector: row.sector,
          forbesRank: row.forbesRank,
          forbesName: row.forbesName,
        };
      }
    }

    return { ticker: t, name: t };
  }

  function buildSectorGroupContext(sectorData, filterTicker) {
    const symbolCounts = collectSectorSymbolCounts(sectorData);
    const t = filterTicker ? filterTicker.toUpperCase() : null;
    const symbols = [...symbolCounts.entries()]
      .filter(([sym]) => !t || sym === t)
      .sort((a, b) => b[1] - a[1])
      .map(([sym, count]) => ({ ...companyContextForTicker(sym), eventCount: count }));

    return {
      sector: sectorData?.sector || sectorData?.slug,
      symbols,
      filterTicker: t,
      totalSymbolCount: sectorData?.symbolCount ?? symbolCounts.size,
    };
  }

  function renderSectorBranches() {
    const root = $('#sector-branches');
    const meta = $('#sector-meta');
    if (!root || !sectorState.raw) return;

    const filtered = filterSectorByTicker(sectorState.raw, state.filterTicker);
    const eventTotal = (filtered.groups || []).reduce(
      (n, g) => n + (g.branches || []).reduce((m, b) => m + (b.events?.length || 0), 0),
      0,
    );

    if (meta) {
      const window = sectorState.raw.window;
      let metaText = `${sectorState.raw.eventCount ?? 0} flips · ${sectorState.raw.symbolCount ?? 0} symbols`;
      if (window?.start && window?.end) metaText += ` · ${window.start} → ${window.end}`;
      if (state.filterTicker) {
        metaText += ` · showing ${state.filterTicker} (${eventTotal} events)`;
      }
      meta.textContent = metaText;
    }

    if (!eventTotal && state.filterTicker) {
      root.innerHTML = `<p class="muted">No flips for ${escapeHtml(state.filterTicker)} in ${escapeHtml(sectorState.raw.sector || sectorState.slug || 'this sector')}.</p>`;
      return;
    }

    const groupContext = buildSectorGroupContext(sectorState.raw, state.filterTicker);
    if (window.TimelineCluster?.renderGroupsInto) {
      window.TimelineCluster.renderGroupsInto(filtered, root, { groupContext });
      bindSectorGroupContext(root);
    }
  }

  function bindSectorGroupContext(root) {
    if (!root) return;
    root.querySelectorAll('.tl-group-context-forbes[data-rank]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rank = Number(el.dataset.rank);
        if (!Number.isNaN(rank)) selectForbesPerson(rank, { scroll: false });
      });
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        const rank = Number(el.dataset.rank);
        if (!Number.isNaN(rank)) selectForbesPerson(rank, { scroll: false });
      });
    });
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

  async function showSector(slug) {
    const root = $('#sector-branches');
    sectorState.slug = slug;
    if (root) root.innerHTML = '<p class="muted">Loading sector flips…</p>';
    const sectorData = await loadSector(slug);
    if (!sectorData) {
      sectorState.raw = null;
      if (root) root.innerHTML = '<p class="muted">Sector bundle not embedded — Agentic list available locally.</p>';
      return;
    }
    sectorState.raw = sectorData;
    renderSectorBranches();
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
        state.filterEntityId = null;
        state.filterRank = null;
        state.filterBranch = null;
        updateFilterLabel();
        renderThroughLineForbesUsers();
        renderThroughLineUniverse();
        renderStreamFilters();
        renderCompression();
        renderStream();
        renderSectorBranches();
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

    document.querySelectorAll('a.stream-nav-link, a[href="#stream-drawer-panel"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setDrawerOpen(true);
        const drawer = $('#stream-drawer-panel');
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
    forbesPersonCompanies = null;
    forbesRankByCompanyKey = null;
    renderMeta();
    renderThroughLineSummary();
    renderContextRail('#through-line-context-rail');
    renderThroughLineForbesUsers();
    renderThroughLineUniverse();
    disposeThroughLineCharts();
    renderThroughLineHeatmap();
    renderSpeedChart();
    renderThroughLine();
    renderCompressionMeta();
    renderCompressionYearNav();
    renderCompression();
    renderStreamFilters();
    renderStream();
    updateFilterLabel();
    renderSectorBranches();
  }

  async function loadHistoricalData() {
    try {
      const [indexRes, histRes] = await Promise.all([
        fetch(`${HISTORICAL_INDEX_URL}?v=${DATA_CACHE_BUST}`),
        fetch(`data/historical-net-worth.json?v=${DATA_CACHE_BUST}`),
      ]);
      if (indexRes.ok) historicalIndex = await indexRes.json();
      if (histRes.ok) {
        historicalByRank = await histRes.json();
        yearRankCache = new Map();
      }
    } catch {
      historicalIndex = null;
      historicalByRank = {};
    }
  }

  function hasIndustryStreamShell() {
    return (
      $('#flip-overlay-chart') ||
      $('#compression-grid') ||
      $('#stream-feed') ||
      $('#through-line-cards')
    );
  }

  async function init() {
    if (!hasIndustryStreamShell()) return;
    const embedded = Boolean($('#industry-stream.industry-stream-section'));
    if (embedded) {
      document.body.classList.add('stream-embedded', 'stream-drawer-open');
    }
    try {
      await loadHistoricalData();
      const res = await fetch(`${DATA_URL}?v=${DATA_CACHE_BUST}`);
      if (!res.ok) throw new Error(`${res.status}`);
      data = await res.json();
      renderAll();
      bindToolbar();
      bindDrawer();
      bindThroughLineFilter();
      bindThroughLineSort();
      bindThroughLineListYear();
      bindHeatmapYearNav();
      bindCompressionYearNav();
      bindCompressionListYearSync();
      initSectorActivity();
      window.addEventListener('resize', () => {
        tlCharts.forEach((chart) => {
          try {
            chart.resize();
          } catch {
            /* ignore */
          }
        });
      });
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

  window.IndustryStream = {
    setListYear(year) {
      state.filterListYear = year;
      const slider = $('#through-line-list-year');
      const output = $('#through-line-list-year-value');
      if (slider) slider.value = String(year);
      if (output) output.textContent = String(year);
      renderContextRail('#through-line-context-rail');
      renderThroughLineForbesUsers();
      if (state.compressionViewMode === 'year') {
        renderCompressionMeta();
        renderCompressionYearNav();
        renderCompression();
      }
      if (window.FlipOverlayChart?.setListYearHighlight) {
        window.FlipOverlayChart.setListYearHighlight(year);
      }
    },
    setCompressionYear(year) {
      if (year == null) setCompressionViewMode('alltime');
      else setCompressionViewMode('year', { year });
    },
  };
})();
