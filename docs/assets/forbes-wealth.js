/**
 * Forbes Wealth Journeys — billionaire list + per-person timeline
 * Data: data/forbes-billionaires.json
 */
(function () {
  'use strict';

  const DATA_URL = 'data/forbes-billionaires.json';
  let billionaires = [];
  let selectedRank = 1;

  function $(sel, root = document) {
    return root.querySelector(sel);
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

  function renderList(container) {
    container.innerHTML = billionaires
      .map(
        (b) => `
      <button
        type="button"
        class="forbes-list-item${b.rank === selectedRank ? ' is-active' : ''}"
        data-rank="${b.rank}"
        aria-pressed="${b.rank === selectedRank}"
      >
        <span class="forbes-rank">#${b.rank}</span>
        <span class="forbes-list-body">
          <strong class="forbes-name">${escapeHtml(b.name)}</strong>
          <span class="forbes-meta">${escapeHtml(b.sector)} · ${escapeHtml(b.country)}</span>
        </span>
        <span class="forbes-worth">${escapeHtml(formatNetWorth(b.netWorth))}</span>
      </button>`,
      )
      .join('');

    container.querySelectorAll('.forbes-list-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRank = Number(btn.dataset.rank);
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
    const person = billionaires.find((b) => b.rank === selectedRank);
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
    const url = new URL(window.location.href);
    url.hash = `forbes?rank=${selectedRank}`;
    history.replaceState(null, '', url);
  }

  function readRankFromUrl() {
    const hash = window.location.hash;
    const match = hash.match(/rank=(\d+)/);
    if (match) {
      const rank = Number(match[1]);
      if (billionaires.some((b) => b.rank === rank)) selectedRank = rank;
    }
  }

  function renderMeta(countEl) {
    if (countEl) {
      countEl.textContent = `${billionaires.length} profile${billionaires.length === 1 ? '' : 's'} loaded — append to data/forbes-billionaires.json to expand toward Forbes 500.`;
    }
  }

  async function initForbesWealth() {
    const root = $('#forbes-wealth');
    const listEl = $('#forbes-list');
    const detailEl = $('#forbes-detail');
    const countEl = $('#forbes-count');
    if (!root || !listEl || !detailEl) return;

    try {
      const resp = await fetch(DATA_URL);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      billionaires = await resp.json();
      billionaires.sort((a, b) => a.rank - b.rank);
    } catch (err) {
      root.classList.add('forbes-error');
      root.innerHTML = `<p class="forbes-empty">Could not load ${DATA_URL}: ${escapeHtml(err.message)}</p>`;
      return;
    }

    readRankFromUrl();
    renderMeta(countEl);
    renderList(listEl);
    renderDetail(detailEl);

    window.addEventListener('hashchange', () => {
      readRankFromUrl();
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
