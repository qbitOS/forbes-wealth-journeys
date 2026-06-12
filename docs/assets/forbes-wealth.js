/**
 * Forbes Wealth Journeys — billionaire list + portfolio detail (schema v2)
 * Data: data/forbes-billionaires.json
 */
(function () {
  'use strict';

  const DATA_URL = 'data/forbes-billionaires.json';
  let billionaires = [];
  let filtered = [];
  let selectedKey = '';
  let searchQuery = '';

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
      });
    });
  }

  function renderLinks(person) {
    const links = [
      ['Forbes', person.forbesProfile],
      ['Wikipedia', person.wikipediaLink],
      ['Grokipedia', person.grokipediaLink],
    ].filter(([, url]) => url);
    if (!links.length) return '';
    return `
      <nav class="forbes-links" aria-label="External profiles">
        ${links.map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`).join('')}
      </nav>`;
  }

  function renderWealthBreakdown(rows) {
    if (!rows || !rows.length) return '';
    return `
      <section class="forbes-panel">
        <h4 class="forbes-journey-heading">Wealth breakdown</h4>
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
        </table>
      </section>`;
  }

  function renderEntities(entities) {
    if (!entities || !entities.length) return '';
    return `
      <section class="forbes-panel">
        <h4 class="forbes-journey-heading">Entities</h4>
        <ul class="forbes-entities">
          ${entities.map((e) => `
            <li class="forbes-entity">
              <strong>${escapeHtml(e.name)}</strong>
              <span class="forbes-entity-meta">${escapeHtml(e.role || '')}${e.founded ? ` · ${e.founded}` : ''} · ${escapeHtml(e.status || '')}${e.ticker ? ` · ${escapeHtml(e.ticker)}` : ''}${e.valuationUsdB ? ` · ${formatUsdB(e.valuationUsdB)} val` : ''}</span>
            </li>`).join('')}
        </ul>
      </section>`;
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

  function renderDetail(container) {
    const person = findPerson(selectedKey);
    if (!person) {
      container.innerHTML = '<p class="forbes-empty">Select a person from the list.</p>';
      return;
    }

    const legacySource = person.sourceOfWealth
      ? `<div><dt>Source of wealth</dt><dd>${escapeHtml(person.sourceOfWealth)}</dd></div>`
      : '';
    const legacyDecade = person.firstFortuneDecade
      ? `<div><dt>First fortune</dt><dd>${escapeHtml(person.firstFortuneDecade)}</dd></div>`
      : '';

    container.innerHTML = `
      <header class="forbes-detail-header">
        <p class="forbes-detail-rank">Forbes rank #${person.rank}</p>
        <h3 class="forbes-detail-name">${escapeHtml(person.name)}</h3>
        <p class="forbes-detail-worth">${formatNetWorth(person.netWorth)}</p>
        <p class="forbes-detail-summary">${escapeHtml(person.summary || '')}</p>
        ${renderLinks(person)}
      </header>
      <dl class="forbes-facts">
        <div><dt>Age</dt><dd>${person.age ?? '—'}</dd></div>
        <div><dt>Country</dt><dd>${escapeHtml(person.country || '—')}</dd></div>
        <div><dt>Sector</dt><dd>${escapeHtml(person.sector || '—')}</dd></div>
        ${legacySource}
        ${legacyDecade}
      </dl>
      ${renderWealthBreakdown(person.wealthBreakdown)}
      ${renderEntities(person.entities)}
      <section class="forbes-panel">
        <h4 class="forbes-journey-heading">Wealth journey</h4>
        ${renderTimeline(person.timeline)}
      </section>
    `;
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
    countEl.textContent = `${billionaires.length} profiles · ${enriched} with stake-level breakdown · schema v2`;
  }

  async function initForbesWealth() {
    const root = $('#forbes-wealth');
    const listEl = $('#forbes-list');
    const detailEl = $('#forbes-detail');
    const countEl = $('#forbes-count');
    const searchEl = $('#forbes-search');
    if (!root || !listEl || !detailEl) return;

    try {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForbesWealth);
  } else {
    initForbesWealth();
  }
})();
