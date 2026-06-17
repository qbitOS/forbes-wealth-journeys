/**
 * Compliance trading paths — zero knowledge → compliant bot
 * Data: data/compliance-trading-paths.json + forbes-billionaires + 13f + market-crossover
 */
(function () {
  'use strict';

  const PATHS_URL = 'data/compliance-trading-paths.json';
  const BILLIONAIRES_URL = 'data/forbes-billionaires.json';
  const HOLDINGS_URL = 'data/13f-top20.json';
  const CROSSOVER_URL = 'data/market-crossover.json';

  let pathsData = null;
  let billionaires = [];
  let holdingsByRank = {};
  let crossoverByRank = {};
  let activePhase = 1;
  let checklistState = {};

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

  function edgarSearchUrl(ticker) {
    return `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(ticker)}&dateRange=5y&category=custom&forms=4,10-K,10-Q,8-K,13F-HR`;
  }

  function forbesProfileLink(rank, name) {
    return `#forbes?rank=${rank}&name=${encodeURIComponent(name)}`;
  }

  function publicTickersForProfile(profile) {
    const tickers = new Set();
    (profile.wealthBreakdown || []).forEach((row) => {
      if (row.ticker && row.type === 'public') tickers.add(row.ticker);
    });
    (profile.entities || []).forEach((ent) => {
      if (ent.ticker && ent.status === 'public') tickers.add(ent.ticker);
    });
    const h13 = holdingsByRank[String(profile.rank)];
    if (h13?.holdings) {
      h13.holdings.forEach((h) => {
        if (h.ticker) tickers.add(h.ticker);
      });
    }
    const cross = crossoverByRank[profile.rank];
    if (cross?.symbols) {
      cross.symbols.forEach((s) => {
        if (s.ticker && s.type === 'public') tickers.add(s.ticker);
      });
    }
    return [...tickers].sort();
  }

  function buildForbesCrosswalk() {
    return billionaires
      .map((p) => {
        const tickers = publicTickersForProfile(p);
        if (!tickers.length) return null;
        return {
          rank: p.rank,
          name: p.name,
          sector: p.sector,
          country: p.country,
          tickers,
          has13f: Boolean(holdingsByRank[String(p.rank)]),
          hasCrossover: Boolean(crossoverByRank[p.rank]?.symbols?.some((s) => s.market)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank);
  }

  function renderPhases() {
    if (!pathsData?.phases) return '';
    const tabs = pathsData.phases
      .map(
        (ph) =>
          `<button type="button" class="compliance-phase-tab${ph.step === activePhase ? ' active' : ''}" data-phase="${ph.step}" aria-selected="${ph.step === activePhase}">${ph.step}. ${escapeHtml(ph.title.split('—')[0].trim())}</button>`,
      )
      .join('');

    const active = pathsData.phases.find((p) => p.step === activePhase) || pathsData.phases[0];
    const topics = (active.topics || [])
      .map((t) => `<li>${escapeHtml(t)}</li>`)
      .join('');
    const resources = (active.resources || [])
      .map(
        (r) =>
          `<li><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a></li>`,
      )
      .join('');

    return `
      <nav class="compliance-phase-tabs" role="tablist" aria-label="Trading path phases">${tabs}</nav>
      <article class="compliance-phase-panel" role="tabpanel">
        <h3 class="compliance-phase-title">${escapeHtml(active.title)}</h3>
        <p class="compliance-phase-summary">${escapeHtml(active.summary)}</p>
        <ul class="compliance-topic-list">${topics}</ul>
        <h4 class="compliance-subheading">Primary resources</h4>
        <ul class="compliance-resource-list">${resources}</ul>
      </article>`;
  }

  function renderAgencies() {
    if (!pathsData?.agencyGroups) return '';
    return pathsData.agencyGroups
      .map((group) => {
        const cards = (group.agencies || [])
          .map(
            (a) => `
          <article class="compliance-agency-card">
            <h4 class="compliance-agency-name"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">${escapeHtml(a.name)}</a></h4>
            <p class="compliance-agency-role">${escapeHtml(a.role)}</p>
            <p class="compliance-agency-scope"><strong>Scope:</strong> ${escapeHtml(a.scope)}</p>
            <p class="compliance-agency-forbes"><strong>Forbes crosswalk:</strong> ${escapeHtml(a.forbesRelevance)}</p>
          </article>`,
          )
          .join('');
        return `
        <section class="compliance-agency-group">
          <h3 class="compliance-subheading">${escapeHtml(group.title)}</h3>
          <p class="compliance-group-desc">${escapeHtml(group.description)}</p>
          <div class="compliance-agency-grid">${cards}</div>
        </section>`;
      })
      .join('');
  }

  function renderCertifications() {
    if (!pathsData?.certifications) return '';
    const rows = pathsData.certifications
      .map(
        (c) => `
      <tr>
        <td><strong>${escapeHtml(c.exam)}</strong></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.requiredFor)}</td>
        <td><a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">FINRA / NASAA →</a></td>
      </tr>`,
      )
      .join('');
    return `
      <table class="compliance-cert-table">
        <thead><tr><th>Exam</th><th>Name</th><th>Required for</th><th>Link</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderForbesRules() {
    if (!pathsData?.forbesRules) return '';
    const rows = pathsData.forbesRules
      .map(
        (r) => `
      <tr>
        <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.title)}</a></td>
        <td>${escapeHtml(r.agency)}</td>
        <td>${escapeHtml(r.trigger)}</td>
        <td>${escapeHtml(r.botImpact)}</td>
      </tr>`,
      )
      .join('');
    return `
      <table class="compliance-rules-table">
        <thead><tr><th>Rule / filing</th><th>Agency</th><th>Trigger</th><th>Bot impact</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderChecklist() {
    if (!pathsData?.botChecklist) return '';
    const items = pathsData.botChecklist
      .map((item) => {
        const checked = checklistState[item.id] ? 'checked' : '';
        return `
        <label class="compliance-check-item" data-category="${escapeHtml(item.category)}">
          <input type="checkbox" data-check-id="${escapeHtml(item.id)}" ${checked} />
          <span>${escapeHtml(item.label)}</span>
          <span class="compliance-check-cat">${escapeHtml(item.category)}</span>
        </label>`;
      })
      .join('');
    const total = pathsData.botChecklist.length;
    const done = Object.values(checklistState).filter(Boolean).length;
    return `
      <p class="compliance-check-progress" aria-live="polite">${done} / ${total} complete</p>
      <div class="compliance-checklist">${items}</div>`;
  }

  function renderForbesCrosswalk() {
    const rows = buildForbesCrosswalk();
    if (!rows.length) {
      return '<p class="compliance-empty">No public tickers found in Forbes profiles.</p>';
    }
    const html = rows
      .map((r) => {
        const tickerLinks = r.tickers
          .map(
            (t) =>
              `<a href="${escapeHtml(edgarSearchUrl(t))}" target="_blank" rel="noopener" class="compliance-ticker">${escapeHtml(t)}</a>`,
          )
          .join(' ');
        const badges = [
          r.has13f ? '<span class="compliance-badge">13F data</span>' : '',
          r.hasCrossover ? '<span class="compliance-badge">crossover</span>' : '',
        ]
          .filter(Boolean)
          .join('');
        return `
        <tr>
          <td>${r.rank}</td>
          <td><a href="${forbesProfileLink(r.rank, r.name)}">${escapeHtml(r.name)}</a></td>
          <td>${escapeHtml(r.sector || '—')}</td>
          <td class="compliance-ticker-cell">${tickerLinks}</td>
          <td>${badges || '—'}</td>
          <td><a href="${escapeHtml(edgarSearchUrl(r.tickers[0]))}" target="_blank" rel="noopener">EDGAR →</a></td>
        </tr>`;
      })
      .join('');
    return `
      <p class="compliance-crosswalk-meta">${rows.length} Forbes profiles with public tickers · ${rows.reduce((n, r) => n + r.tickers.length, 0)} symbols</p>
      <table class="compliance-crosswalk-table">
        <thead><tr><th>Rank</th><th>Name</th><th>Sector</th><th>Public tickers</th><th>Data</th><th>Filings</th></tr></thead>
        <tbody>${html}</tbody>
      </table>`;
  }

  function renderAll() {
    const root = $('#compliance-trading-root');
    if (!root || !pathsData) return;

    root.innerHTML = `
      <p class="compliance-disclaimer">${escapeHtml(pathsData.disclaimer)}</p>

      <section class="compliance-block" aria-labelledby="compliance-paths-title">
        <h3 id="compliance-paths-title" class="compliance-block-title">Path: zero knowledge → compliant bot</h3>
        <p class="compliance-block-lead">Six phases — foundations, personal trading, public data, algo rules, licensing, and production checklist.</p>
        <div id="compliance-phases">${renderPhases()}</div>
      </section>

      <section class="compliance-block" aria-labelledby="compliance-agencies-title">
        <h3 id="compliance-agencies-title" class="compliance-block-title">Regulatory agencies & orgs</h3>
        <p class="compliance-block-lead">Federal regulators, SROs, investor advocates, and academic resources — mapped to Forbes-list trading context. See also <a href="https://libguides.law.uci.edu/securities/agencies" target="_blank" rel="noopener">UCI Law securities agencies guide</a>.</p>
        <div id="compliance-agencies">${renderAgencies()}</div>
      </section>

      <section class="compliance-block" aria-labelledby="compliance-certs-title">
        <h3 id="compliance-certs-title" class="compliance-block-title">Exams & registration</h3>
        <p class="compliance-block-lead">When your bot moves beyond personal capital — <a href="https://www.finra.org/registration-exams-ce" target="_blank" rel="noopener">FINRA registration & CE</a>.</p>
        <div id="compliance-certs">${renderCertifications()}</div>
      </section>

      <section class="compliance-block" aria-labelledby="compliance-rules-title">
        <h3 id="compliance-rules-title" class="compliance-block-title">Rules & filings for Forbes-list securities</h3>
        <p class="compliance-block-lead">Cross every T — insider filings, institutional 13F, supervision, and registration triggers.</p>
        <div id="compliance-rules">${renderForbesRules()}</div>
      </section>

      <section class="compliance-block" aria-labelledby="compliance-crosswalk-title">
        <h3 id="compliance-crosswalk-title" class="compliance-block-title">Forbes lister ticker crosswalk</h3>
        <p class="compliance-block-lead">Every ranked profile with public stakes — link to <a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noopener">SEC EDGAR</a> for Form 4, 8-K, 10-K, and 13F. Synced with <a href="#configurator">Market crossover</a> and 13F holdings in this repo.</p>
        <div id="compliance-crosswalk">${renderForbesCrosswalk()}</div>
      </section>

      <section class="compliance-block" aria-labelledby="compliance-checklist-title">
        <h3 id="compliance-checklist-title" class="compliance-block-title">Production bot checklist</h3>
        <p class="compliance-block-lead">Local checklist — persisted in your browser. Not a substitute for compliance review.</p>
        <div id="compliance-checklist">${renderChecklist()}</div>
      </section>`;

    bindEvents();
  }

  function bindEvents() {
    const root = $('#compliance-trading-root');
    if (!root) return;

    root.querySelectorAll('.compliance-phase-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        activePhase = Number(btn.dataset.phase) || 1;
        const panel = $('#compliance-phases');
        if (panel) panel.innerHTML = renderPhases();
        bindEvents();
      });
    });

    root.querySelectorAll('.compliance-check-item input').forEach((input) => {
      input.addEventListener('change', () => {
        checklistState[input.dataset.checkId] = input.checked;
        try {
          localStorage.setItem('fwj-compliance-checklist', JSON.stringify(checklistState));
        } catch (_) {
          /* ignore */
        }
        const prog = root.querySelector('.compliance-check-progress');
        if (prog && pathsData?.botChecklist) {
          const done = Object.values(checklistState).filter(Boolean).length;
          prog.textContent = `${done} / ${pathsData.botChecklist.length} complete`;
        }
      });
    });
  }

  function loadChecklistState() {
    try {
      const raw = localStorage.getItem('fwj-compliance-checklist');
      if (raw) checklistState = JSON.parse(raw) || {};
    } catch (_) {
      checklistState = {};
    }
  }

  async function init() {
    const root = $('#compliance-trading-root');
    if (!root) return;

    loadChecklistState();

    try {
      const [pathsResp, billResp, h13Resp, crossResp] = await Promise.all([
        fetch(PATHS_URL),
        fetch(BILLIONAIRES_URL),
        fetch(HOLDINGS_URL),
        fetch(CROSSOVER_URL),
      ]);

      pathsData = pathsResp.ok ? await pathsResp.json() : null;
      billionaires = billResp.ok ? await billResp.json() : [];

      if (h13Resp.ok) {
        const h13 = await h13Resp.json();
        (h13.ranks || []).forEach((r) => {
          holdingsByRank[String(r.rank)] = r;
        });
      }

      if (crossResp.ok) {
        const cross = await crossResp.json();
        (cross.ranks || []).forEach((r) => {
          crossoverByRank[r.rank] = r;
        });
      }

      renderAll();
    } catch (err) {
      root.innerHTML = `<p class="compliance-empty">Failed to load compliance data: ${escapeHtml(err.message)}</p>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
