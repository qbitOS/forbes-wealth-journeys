/**
 * Market crossover — Forbes rank holdings × robinhood-agentic flip-board signals
 * Data: data/market-crossover.json (scripts/build_market_crossover.py)
 */
(function () {
  'use strict';

  const DATA_URL = 'data/market-crossover.json';

  let marketData = null;
  let selectedRank = null;
  let selectedSymbolKey = null;
  let wizardStep = 1;

  const state = {
    rankMin: 1,
    rankMax: 100,
    crossoverOnly: false,
    publicOnly: false,
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $$(sel, root = document) {
    return [...root.querySelectorAll(sel)];
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

  function formatClose(val) {
    if (val == null || val === '') return '—';
    return `$${Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function formatPct(val) {
    if (val == null || val === '') return '—';
    const n = Number(val);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  }

  function filteredRanks() {
    if (!marketData?.ranks) return [];
    return marketData.ranks.filter((r) => {
      if (r.rank < state.rankMin || r.rank > state.rankMax) return false;
      if (selectedRank != null && r.rank !== selectedRank) return false;
      return true;
    });
  }

  function allSymbols() {
    const rows = [];
    filteredRanks().forEach((rank) => {
      (rank.symbols || []).forEach((sym) => {
        if (state.crossoverOnly && !sym.market) return;
        if (state.publicOnly && sym.type === 'private') return;
        rows.push({ rank, sym });
      });
    });
    return rows;
  }

  function symbolKey(rank, sym) {
    return `${rank.rank}::${sym.ticker || sym.entity}`;
  }

  function updateCount() {
    const el = $('#market-crossover-count');
    if (!el || !marketData) return;
    const ranks = filteredRanks();
    const syms = allSymbols();
    const withMkt = syms.filter(({ sym }) => sym.market).length;
    el.textContent = `${syms.length} holdings · ${withMkt} with crossover signals · ${ranks.length} ranks · as of ${marketData.asOf || '—'}`;
  }

  function updateProfileContext(profile) {
    const el = $('#market-profile-context');
    if (!el) return;
    if (!profile) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    const rankRow = marketData?.ranks?.find((r) => r.rank === profile.rank);
    const mkt = rankRow?.marketCount ?? 0;
    const total = rankRow?.symbolCount ?? 0;
    el.hidden = false;
    el.innerHTML = `Holdings for <strong>${escapeHtml(profile.name)}</strong> · rank #${profile.rank} · ${mkt}/${total} with crossover data`;
  }

  function renderRankStep() {
    const root = $('#market-step-ranks');
    if (!root) return;
    const ranks = filteredRanks();
    root.innerHTML = `
      <div class="market-rank-grid">
        ${ranks.map((r) => `
          <button type="button" class="market-rank-chip${selectedRank === r.rank ? ' active' : ''}" data-rank="${r.rank}">
            <span class="market-rank-chip-num">#${r.rank}</span>
            <span class="market-rank-chip-name">${escapeHtml(r.name)}</span>
            <span class="market-rank-chip-meta">${r.marketCount}/${r.symbolCount} signals</span>
          </button>`).join('')}
      </div>`;

    root.querySelectorAll('.market-rank-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rank = Number(btn.dataset.rank);
        selectedRank = selectedRank === rank ? null : rank;
        renderRankStep();
        renderCompaniesStep();
        updateCount();
      });
    });
  }

  function renderSymbolCard({ rank, sym }) {
    const m = sym.market;
    const key = symbolKey(rank, sym);
    const active = selectedSymbolKey === key;
    const pot = m?.potential;
    return `
      <button type="button" class="market-symbol-card${active ? ' active' : ''}${m ? ' has-market' : ''}" data-key="${escapeHtml(key)}">
        <header class="market-symbol-head">
          <span class="market-symbol-ticker">${escapeHtml(sym.ticker || '—')}</span>
          <span class="market-symbol-rank">#${rank.rank}</span>
        </header>
        <p class="market-symbol-entity">${escapeHtml(sym.entity || '—')}</p>
        ${m ? `
          <p class="market-symbol-close">${formatClose(m.close)}</p>
          <div class="market-symbol-pills">
            <span class="market-pill" data-kind="${biasKind(m.macdBias)}">${escapeHtml(m.macdBias || '—')}</span>
            <span class="market-pill muted">${escapeHtml(m.bbPosition || '—')}</span>
          </div>
          ${pot?.pct != null ? `<p class="market-symbol-pot ${pot.side || ''}">${formatPct(pot.pct)} pot</p>` : ''}
        ` : `<p class="market-symbol-empty">No crossover row · ${escapeHtml(sym.type || 'private')}</p>`}
        ${sym.stakePct != null ? `<p class="market-symbol-stake">${sym.stakePct}% · $${sym.valueUsdB}B</p>` : ''}
      </button>`;
  }

  function renderCompaniesStep() {
    const root = $('#market-step-companies');
    if (!root) return;
    const rows = allSymbols();
    if (!rows.length) {
      root.innerHTML = '<p class="member-empty">No holdings match filters. Widen rank range or disable crossover-only.</p>';
      return;
    }
    root.innerHTML = `<div class="market-symbol-grid">${rows.map(renderSymbolCard).join('')}</div>`;

    root.querySelectorAll('.market-symbol-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedSymbolKey = card.dataset.key;
        renderCompaniesStep();
        renderSignalStep();
        goStep(3);
      });
    });
  }

  function findSelectedSymbol() {
    if (!selectedSymbolKey) return null;
    for (const rank of filteredRanks()) {
      for (const sym of rank.symbols || []) {
        if (symbolKey(rank, sym) === selectedSymbolKey) return { rank, sym };
      }
    }
    return null;
  }

  function renderSignalStep() {
    const root = $('#market-step-signal');
    if (!root) return;
    const hit = findSelectedSymbol();
    if (!hit) {
      root.innerHTML = '<p class="member-empty">Select a company card to view crossover signal detail.</p>';
      return;
    }
    const { rank, sym } = hit;
    const m = sym.market;
    if (!m) {
      root.innerHTML = `<p class="member-empty">${escapeHtml(sym.entity)} (${escapeHtml(sym.ticker || 'private')}) — no flip-board row. Rebuild with <code>python3 scripts/build_market_crossover.py</code>.</p>`;
      return;
    }
    const pot = m.potential || {};
    const flip = m.lastFlip || {};
    root.innerHTML = `
      <article class="market-brief">
        <header class="market-brief-head">
          <div>
            <span class="market-brief-eyebrow">Crossover brief</span>
            <h3 class="market-brief-ticker">${escapeHtml(m.ticker)} · ${escapeHtml(sym.entity)}</h3>
            <p class="market-brief-owner">${escapeHtml(rank.name)} · Forbes #${rank.rank}</p>
          </div>
          <div class="market-brief-quote">
            <span class="market-brief-close">${formatClose(m.close)}</span>
            <span class="market-brief-asof muted">as of ${escapeHtml(m.asOf || '—')}</span>
          </div>
        </header>
        <div class="market-brief-grid">
          <section class="market-brief-block">
            <h4>Structure · TA</h4>
            <dl class="market-brief-dl">
              <div><dt>MACD</dt><dd><span class="market-pill" data-kind="${biasKind(m.macdBias)}">${escapeHtml(m.macdBias)}</span></dd></div>
              <div><dt>Histogram</dt><dd>${escapeHtml(m.histogramBias || '—')}</dd></div>
              <div><dt>BB position</dt><dd>${escapeHtml(m.bbPosition || '—')}</dd></div>
              <div><dt>Week MACD</dt><dd>${escapeHtml(m.weekMacdBias || '—')}</dd></div>
            </dl>
          </section>
          <section class="market-brief-block">
            <h4>Last flip</h4>
            <dl class="market-brief-dl">
              <div><dt>Date</dt><dd>${escapeHtml(flip.date || '—')}</dd></div>
              <div><dt>Type</dt><dd>${escapeHtml(flip.type || '—')}</dd></div>
              <div><dt>Days since</dt><dd>${m.daysSinceFlip ?? '—'}</dd></div>
            </dl>
          </section>
          <section class="market-brief-block">
            <h4>Day potential</h4>
            <dl class="market-brief-dl">
              <div><dt>Side</dt><dd>${escapeHtml(pot.side || '—')}</dd></div>
              <div><dt>Move</dt><dd>${formatPct(pot.pct)}</dd></div>
              <div><dt>EV</dt><dd>${formatPct(pot.evPct)}</dd></div>
              <div><dt>Win rate</dt><dd>${pot.winRate != null ? `${pot.winRate}%` : '—'}</dd></div>
              <div><dt>Floor / ceiling</dt><dd>${formatClose(pot.floor)} / ${formatClose(pot.ceiling)}</dd></div>
            </dl>
          </section>
          <section class="market-brief-block">
            <h4>Stake</h4>
            <dl class="market-brief-dl">
              <div><dt>Stake</dt><dd>${sym.stakePct != null ? `${sym.stakePct}%` : '—'}</dd></div>
              <div><dt>Value</dt><dd>${sym.valueUsdB != null ? `$${sym.valueUsdB}B` : '—'}</dd></div>
              <div><dt>Sector</dt><dd>${escapeHtml(m.sector || rank.sector || '—')}</dd></div>
            </dl>
          </section>
        </div>
      </article>`;
  }

  function buildExportJson() {
    const ranks = filteredRanks().map((r) => ({
      rank: r.rank,
      name: r.name,
      symbols: (r.symbols || []).filter((s) => !state.crossoverOnly || s.market),
    }));
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        asOf: marketData?.asOf,
        filters: { ...state, selectedRank },
        ranks,
      },
      null,
      2,
    );
  }

  function renderExportStep() {
    const pre = $('#market-export-json');
    if (pre) pre.textContent = buildExportJson();
  }

  function goStep(n) {
    wizardStep = n;
    $$('.market-wizard-step', $('#configurator')).forEach((el) => {
      const show = Number(el.dataset.step) === n;
      el.classList.toggle('active', show);
      el.hidden = !show;
    });
    $$('#configurator .step-indicator .step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    const prev = $('#market-btn-prev');
    const next = $('#market-btn-next');
    if (prev) prev.disabled = n === 1;
    if (next) next.textContent = n === 4 ? 'Done' : 'Next';
    if (n === 1) renderRankStep();
    if (n === 2) renderCompaniesStep();
    if (n === 3) renderSignalStep();
    if (n === 4) renderExportStep();
  }

  function bindFilters() {
    const rankMin = $('#market-rank-min');
    const rankMax = $('#market-rank-max');
    const crossoverOnly = $('#market-crossover-only');
    const publicOnly = $('#market-public-only');

    const refresh = () => {
      state.rankMin = Math.max(1, Number(rankMin?.value) || 1);
      state.rankMax = Math.min(100, Number(rankMax?.value) || 100);
      state.crossoverOnly = Boolean(crossoverOnly?.checked);
      state.publicOnly = Boolean(publicOnly?.checked);
      updateCount();
      renderRankStep();
      renderCompaniesStep();
      if (wizardStep === 3) renderSignalStep();
      if (wizardStep === 4) renderExportStep();
    };

    [rankMin, rankMax, crossoverOnly, publicOnly].forEach((el) => {
      el?.addEventListener('input', refresh);
      el?.addEventListener('change', refresh);
    });
  }

  function bindWizard() {
    $('#market-btn-prev')?.addEventListener('click', () => goStep(Math.max(1, wizardStep - 1)));
    $('#market-btn-next')?.addEventListener('click', () => {
      if (wizardStep < 4) goStep(wizardStep + 1);
      else goStep(4);
    });
    $('#market-copy-export')?.addEventListener('click', async () => {
      const btn = $('#market-copy-export');
      try {
        await navigator.clipboard.writeText(buildExportJson());
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        }
      } catch {
        if (btn) btn.textContent = 'Copy failed';
      }
    });
    $('#market-download-export')?.addEventListener('click', () => {
      const blob = new Blob([buildExportJson()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'forbes-market-crossover.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function syncFromProfile(profile) {
    updateProfileContext(profile);
    if (profile?.rank) {
      selectedRank = profile.rank;
      state.rankMin = Math.min(state.rankMin, profile.rank);
      state.rankMax = Math.max(state.rankMax, profile.rank);
      const rankMin = $('#market-rank-min');
      const rankMax = $('#market-rank-max');
      if (rankMin) rankMin.value = String(state.rankMin);
      if (rankMax) rankMax.value = String(state.rankMax);
      renderRankStep();
      renderCompaniesStep();
      updateCount();
    }
  }

  async function initMarketCrossover() {
    const root = $('#configurator');
    if (!root || root.dataset.mode !== 'market') return;

    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      marketData = await resp.json();
    } catch (err) {
      root.innerHTML = `<p class="member-empty">Could not load ${DATA_URL}: ${escapeHtml(err.message)}. Run <code>python3 scripts/build_market_crossover.py</code>.</p>`;
      return;
    }

    bindFilters();
    bindWizard();
    updateCount();
    goStep(1);

    window.addEventListener('forbes:select', (e) => {
      syncFromProfile(e.detail?.person || null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketCrossover);
  } else {
    initMarketCrossover();
  }

  window.MarketCrossover = { syncFromProfile: syncFromProfile };
})();
