/**
 * Forbes Wealth Journeys — billionaire list + per-person timeline
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNetWorth(raw) {
    const s = String(raw).replace(/^\$/, '').trim();
    return s.endsWith('B') || s.endsWith('M') ? `$${s}` : `$${s}B`;
  }

  function personHaystack(b) {
    return [
      b.name,
      b.country,
      b.sector,
      b.sourceOfWealth,
      ...(b.companies || []),
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
        <span class="forbes-worth">${escapeHtml(formatNetWorth(b.netWorth))}</span>
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

  function renderTimeline(events) {
    if (!events || !events.length) {
      return '<p class="forbes-empty">No timeline entries yet.</p>';
    }

    return `
      <ol class="forbes-journey">
        ${events
          .map(
            (ev) => `
          <li class="forbes-journey-item">
            <span class="forbes-journey-year">${escapeHtml(ev.year)}</span>
            <div class="forbes-journey-body">
              <strong class="forbes-journey-title">${escapeHtml(ev.title)}</strong>
              ${ev.description ? `<p class="forbes-journey-desc">${escapeHtml(ev.description)}</p>` : ''}
              ${ev.impact ? `<p class="forbes-journey-impact"><span>Impact</span> ${escapeHtml(ev.impact)}</p>` : ''}
            </div>
          </li>`,
          )
          .join('')}
      </ol>`;
  }

  function renderDetail(container) {
    const person = findPerson(selectedKey);
    if (!person) {
      container.innerHTML = '<p class="forbes-empty">Select a person from the list.</p>';
      return;
    }

    const companies = (person.companies || [])
      .map((c) => `<span class="forbes-tag">${escapeHtml(c)}</span>`)
      .join('');

    container.innerHTML = `
      <header class="forbes-detail-header">
        <p class="forbes-detail-rank">Forbes rank #${person.rank}</p>
        <h3 class="forbes-detail-name">${escapeHtml(person.name)}</h3>
        <p class="forbes-detail-worth">${escapeHtml(formatNetWorth(person.netWorth))}</p>
        <p class="forbes-detail-summary">${escapeHtml(person.summary || '')}</p>
      </header>
      <dl class="forbes-facts">
        <div><dt>Age</dt><dd>${person.age ?? '—'}</dd></div>
        <div><dt>Country</dt><dd>${escapeHtml(person.country || '—')}</dd></div>
        <div><dt>Sector</dt><dd>${escapeHtml(person.sector || '—')}</dd></div>
        <div><dt>Source of wealth</dt><dd>${escapeHtml(person.sourceOfWealth || '—')}</dd></div>
        <div><dt>First fortune</dt><dd>${escapeHtml(person.firstFortuneDecade || '—')}</dd></div>
      </dl>
      ${companies ? `<div class="forbes-tags" aria-label="Companies">${companies}</div>` : ''}
      <h4 class="forbes-journey-heading">Wealth journey</h4>
      ${renderTimeline(person.timeline)}
    `;
  }

  function syncUrl() {
    const person = findPerson(selectedKey);
    if (!person) return;
    const url = new URL(window.location.href);
    url.hash = `forbes?rank=${person.rank}&name=${encodeURIComponent(person.name)}`;
    history.replaceState(null, '', url);
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
    const tied = billionaires.length - new Set(billionaires.map((b) => b.rank)).size;
    const tiedNote = tied ? ` · ${tied} tied Forbes ranks` : '';
    countEl.textContent = `${billionaires.length} profiles from Grok · Forbes 500 Wealth Journeys${tiedNote}`;
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

    if (searchEl) {
      searchEl.addEventListener('input', () => {
        searchQuery = searchEl.value;
        applyFilter();
        renderMeta(countEl);
        renderList(listEl);
        renderDetail(detailEl);
      });
    }

    window.addEventListener('hashchange', () => {
      readSelectionFromUrl();
      renderList(listEl);
      renderDetail(detailEl);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForbesWealth);
  } else {
    initForbesWealth();
  }
})();
