/**
 * Forbes Wealth Journeys — Quick Start paths + data configurator / export
 */
(function () {
  'use strict';

  const DATA_URL = 'data/forbes-billionaires.json';
  const REPO = 'qbitOS/forbes-wealth-journeys';
  const REPO_BASE = `https://github.com/${REPO}`;
  const PAGES_URL = 'https://qbitos.github.io/forbes-wealth-journeys/';
  const GROK_SOURCE =
    'https://grok.com/share/bGVnYWN5LWNvcHk_90513d22-f9d1-4544-87f7-ca5db3b07748';

  const MEMBER_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'entities', label: 'Entities' },
    { id: 'export', label: 'Export JSON' },
    { id: 'links', label: 'Links' },
  ];

  const memberState = {
    profile: null,
    tab: 'overview',
  };

  const SECTORS = [
    'Technology',
    'Finance & Investments',
    'Fashion & Retail',
    'Healthcare',
    'Diversified',
    'Manufacturing',
  ];

  const EXPORT_FIELDS = [
    { id: 'profile', label: 'Profile', desc: 'rank, name, netWorth, country, sector, summary, links' },
    { id: 'wealthBreakdown', label: 'Wealth breakdown', desc: 'stakePct, valueUsdB, ticker, type' },
    { id: 'entities', label: 'Entities', desc: 'companies, roles, founded, status' },
    { id: 'timeline', label: 'Timeline', desc: 'typed events with sources and valuations' },
  ];

  let dataset = [];
  const state = {
    step: 1,
    sector: '',
    country: '',
    rankMin: 1,
    rankMax: 100,
    enrichedOnly: false,
    fields: new Set(['profile', 'wealthBreakdown', 'entities', 'timeline']),
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

  function isEnriched(entry) {
    return (entry.wealthBreakdown || []).some((w) => w.stakePct != null);
  }

  function netWorthValue(entry) {
    const nw = entry.netWorth;
    if (nw && typeof nw === 'object') return nw.value;
    const s = String(nw || '').replace(/[^\d.]/g, '');
    return parseFloat(s) || 0;
  }

  function filterDataset() {
    return dataset.filter((e) => {
      if (e.rank < state.rankMin || e.rank > state.rankMax) return false;
      if (state.sector && e.sector !== state.sector) return false;
      if (state.country && e.country !== state.country) return false;
      if (state.enrichedOnly && !isEnriched(e)) return false;
      return true;
    });
  }

  function pickFields(entry) {
    return {
      rank: entry.rank,
      name: entry.name,
      netWorth: entry.netWorth,
      age: entry.age,
      country: entry.country,
      sector: entry.sector,
      summary: entry.summary,
      grokipediaLink: entry.grokipediaLink,
      forbesProfile: entry.forbesProfile,
      wikipediaLink: entry.wikipediaLink,
      firstFortuneDecade: entry.firstFortuneDecade,
      wealthBreakdown: entry.wealthBreakdown || [],
      entities: entry.entities || [],
      timeline: entry.timeline || [],
    };
  }

  function pickFieldsFiltered(entry) {
    const out = { rank: entry.rank, name: entry.name };
    if (state.fields.has('profile')) {
      Object.assign(out, {
        netWorth: entry.netWorth,
        age: entry.age,
        country: entry.country,
        sector: entry.sector,
        summary: entry.summary,
        grokipediaLink: entry.grokipediaLink,
        forbesProfile: entry.forbesProfile,
        wikipediaLink: entry.wikipediaLink,
        firstFortuneDecade: entry.firstFortuneDecade,
      });
    }
    if (state.fields.has('wealthBreakdown')) out.wealthBreakdown = entry.wealthBreakdown || [];
    if (state.fields.has('entities')) out.entities = entry.entities || [];
    if (state.fields.has('timeline')) out.timeline = entry.timeline || [];
    return out;
  }

  function buildExportJson() {
    return JSON.stringify(filterDataset().map(pickFieldsFiltered), null, 2);
  }

  function buildExportCsv() {
    const rows = filterDataset();
    const header = [
      'rank',
      'name',
      'netWorthUsdB',
      'country',
      'sector',
      'entityCount',
      'timelineEvents',
      'enriched',
    ];
    const lines = [header.join(',')];
    rows.forEach((e) => {
      lines.push(
        [
          e.rank,
          `"${String(e.name).replace(/"/g, '""')}"`,
          netWorthValue(e),
          `"${e.country || ''}"`,
          `"${e.sector || ''}"`,
          (e.entities || []).length,
          (e.timeline || []).length,
          isEnriched(e) ? 'yes' : 'no',
        ].join(','),
      );
    });
    return lines.join('\n');
  }

  function buildManifestYaml() {
    const rows = filterDataset();
    const lines = [
      '# Forbes Wealth Journeys export manifest',
      `generated_from: ${PAGES_URL}`,
      `source_thread: ${GROK_SOURCE}`,
      `exported_at: ${new Date().toISOString().slice(0, 10)}`,
      'dataset:',
      `  count: ${rows.length}`,
      `  rank_range: [${state.rankMin}, ${state.rankMax}]`,
      `  sector_filter: ${state.sector || 'all'}`,
      `  country_filter: ${state.country || 'all'}`,
      `  enriched_only: ${state.enrichedOnly}`,
      `  fields: [${[...state.fields].join(', ')}]`,
      '  data_path: data/forbes-billionaires.json',
      '  scripts:',
      '    - scripts/import_grok_forbes.py',
      '    - scripts/migrate_forbes_v2.py',
    ];
    return lines.join('\n');
  }

  function buildLlmsTxt() {
    const rows = filterDataset().slice(0, 25);
    return `# Forbes Wealth Journeys — filtered export hints
# ${PAGES_URL}

> ${rows.length} of ${dataset.length} profiles match current filters.

## Data
- Full JSON: ${PAGES_URL}data/forbes-billionaires.json
- Grok source: ${GROK_SOURCE}
- Repo: ${REPO_BASE}

## Profiles (sample)
${rows.map((e) => `- [${e.rank}] ${e.name} — ${e.sector}, ${e.country}`).join('\n')}

## Agent tasks
- Enrich wealthBreakdown with stakePct for ranks lacking detail
- Cross-link timeline entityId to Ventures gitgraph lanes
- Add yearly netWorth series per profile
`;
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = orig;
        btn.classList.remove('copied');
      }, 1500);
    } catch {
      btn.textContent = 'Copy failed';
    }
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function formatNetWorth(profile) {
    const nw = profile?.netWorth;
    if (nw && typeof nw === 'object' && nw.value != null) {
      return `$${nw.value}${nw.unit || 'B'}`;
    }
    return '—';
  }

  function findProfileByRank(rank) {
    return dataset.find((p) => p.rank === rank);
  }

  function selectMemberProfile(profile, { syncForbes = true } = {}) {
    if (!profile) return;
    memberState.profile = profile;
    renderMemberHeader(profile);
    renderMemberPanel(profile, memberState.tab);
    updateMemberNavButtons(profile);

    if (syncForbes) {
      const hash = `#forbes?rank=${profile.rank}&name=${encodeURIComponent(profile.name)}`;
      if (window.location.hash !== hash) {
        history.replaceState(null, '', hash);
      }
      window.dispatchEvent(new CustomEvent('forbes:select', { detail: { person: profile } }));
    }
  }

  function renderMemberHeader(profile) {
    const nameEl = $('#member-details-name');
    const metaEl = $('#member-details-meta');
    if (!profile) {
      if (nameEl) nameEl.textContent = 'Select a profile';
      if (metaEl) metaEl.textContent = '';
      return;
    }
    if (nameEl) nameEl.textContent = profile.name;
    if (metaEl) {
      const milestones = (profile.timeline || []).length;
      const enriched = isEnriched(profile) ? ' · stake breakdown' : '';
      metaEl.textContent = `Forbes #${profile.rank} · ${formatNetWorth(profile)} · ${profile.sector || '—'} · ${profile.country || '—'} · ${milestones} milestones${enriched}`;
    }
  }

  function renderOverviewPanel(profile) {
    return `
      <dl class="member-facts">
        <div><dt>Rank</dt><dd>#${profile.rank}</dd></div>
        <div><dt>Net worth</dt><dd>${escapeHtml(formatNetWorth(profile))}</dd></div>
        <div><dt>Age</dt><dd>${escapeHtml(profile.age ?? '—')}</dd></div>
        <div><dt>Country</dt><dd>${escapeHtml(profile.country || '—')}</dd></div>
        <div><dt>Sector</dt><dd>${escapeHtml(profile.sector || '—')}</dd></div>
        <div><dt>First fortune</dt><dd>${escapeHtml(profile.firstFortuneDecade || '—')}</dd></div>
      </dl>
      <p class="member-summary">${escapeHtml(profile.summary || 'No summary yet.')}</p>`;
  }

  function renderTimelinePanel(profile) {
    const events = profile.timeline || [];
    if (!events.length) {
      return '<p class="member-empty">No timeline milestones in profile data.</p>';
    }
    return `
      <ol class="member-detail-list">
        ${events.map((ev) => `
          <li>
            <strong>${escapeHtml(ev.year)} · ${escapeHtml(ev.title)}</strong>
            ${ev.type ? `<span>${escapeHtml(ev.type)}</span>` : ''}
            ${ev.entityId ? ` · <code>${escapeHtml(ev.entityId)}</code>` : ''}
            ${ev.valuationUsdB != null ? ` · $${ev.valuationUsdB}B` : ''}
          </li>`).join('')}
      </ol>`;
  }

  function renderPortfolioPanel(profile) {
    const rows = profile.wealthBreakdown || [];
    if (!rows.length) {
      return '<p class="member-empty">No stake-level wealth breakdown yet.</p>';
    }
    return `
      <table class="member-detail-table">
        <thead><tr><th>Entity</th><th>Type</th><th>Stake</th><th>Value</th></tr></thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.entity)}${r.ticker ? ` (${escapeHtml(r.ticker)})` : ''}</td>
              <td>${escapeHtml(r.type || '—')}</td>
              <td>${r.stakePct != null ? `${r.stakePct}%` : '—'}</td>
              <td>${r.valueUsdB != null ? `$${r.valueUsdB}B` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderEntitiesPanel(profile) {
    const entities = profile.entities || [];
    if (!entities.length) {
      return '<p class="member-empty">No linked entities yet.</p>';
    }
    return `
      <ul class="member-detail-list">
        ${entities.map((e) => `
          <li>
            <strong>${escapeHtml(e.name || e.id)}</strong>
            ${escapeHtml(e.role || '—')}${e.founded ? ` · ${e.founded}` : ''} · ${escapeHtml(e.status || '—')}
            ${e.ticker ? ` · ${escapeHtml(e.ticker)}` : ''}
          </li>`).join('')}
      </ul>`;
  }

  function renderExportPanel(profile) {
    const payload = pickFields(profile);
    return `<pre class="code-block">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
  }

  function renderLinksPanel(profile) {
    const links = [
      ['Forbes profile', profile.forbesProfile],
      ['Wikipedia', profile.wikipediaLink],
      ['Grokipedia', profile.grokipediaLink],
      ['Open in Forbes list', `#forbes?rank=${profile.rank}&name=${encodeURIComponent(profile.name)}`],
      ['Venture timeline', '#timeline'],
      ['Activity view', '#activity'],
    ].filter(([, url]) => url);
    return `
      <ul class="member-link-list">
        ${links.map(([label, url]) => {
          const external = url.startsWith('http');
          return `<li><a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(label)}</a></li>`;
        }).join('')}
      </ul>`;
  }

  function memberPanelHtml(profile, tabId) {
    switch (tabId) {
      case 'overview': return renderOverviewPanel(profile);
      case 'timeline': return renderTimelinePanel(profile);
      case 'portfolio': return renderPortfolioPanel(profile);
      case 'entities': return renderEntitiesPanel(profile);
      case 'export': return renderExportPanel(profile);
      case 'links': return renderLinksPanel(profile);
      default: return '';
    }
  }

  function memberCopyText(profile, tabId) {
    if (!profile) return '';
    if (tabId === 'export') return JSON.stringify(pickFields(profile), null, 2);
    const panel = document.createElement('div');
    panel.innerHTML = memberPanelHtml(profile, tabId);
    return panel.textContent.trim();
  }

  function renderMemberPanel(profile, tabId) {
    const panel = $('#member-detail-panel');
    if (!panel) return;
    if (!profile) {
      panel.innerHTML = '<p class="member-empty">Pick a billionaire from the Forbes list or use Prev/Next to browse ranks.</p>';
      return;
    }
    panel.innerHTML = memberPanelHtml(profile, tabId);
  }

  function updateMemberNavButtons(profile) {
    const prevBtn = $('#member-rank-prev');
    const nextBtn = $('#member-rank-next');
    if (!profile || !dataset.length) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    if (prevBtn) prevBtn.disabled = profile.rank <= 1;
    if (nextBtn) {
      const maxRank = dataset.reduce((max, p) => Math.max(max, p.rank), 1);
      nextBtn.disabled = profile.rank >= maxRank;
    }
  }

  function initMemberDetails() {
    const grid = $('#quick-templates');
    const copyBtn = $('#copy-quick-cmd');
    if (!grid) return;

    grid.innerHTML = MEMBER_TABS.map(
      (tab) =>
        `<button type="button" role="tab" class="quick-btn${tab.id === memberState.tab ? ' active' : ''}" data-tab="${tab.id}" aria-selected="${tab.id === memberState.tab}">${escapeHtml(tab.label)}</button>`,
    ).join('');

    $$('.quick-btn', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        memberState.tab = btn.dataset.tab || 'overview';
        $$('.quick-btn', grid).forEach((b) => {
          const active = b.dataset.tab === memberState.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        renderMemberPanel(memberState.profile, memberState.tab);
      });
    });

    $('#member-rank-prev')?.addEventListener('click', () => {
      const profile = memberState.profile;
      if (!profile || profile.rank <= 1) return;
      const prev = findProfileByRank(profile.rank - 1);
      if (prev) selectMemberProfile(prev);
    });

    $('#member-rank-next')?.addEventListener('click', () => {
      const profile = memberState.profile;
      if (!profile) return;
      const next = findProfileByRank(profile.rank + 1);
      if (next) selectMemberProfile(next);
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const text = memberCopyText(memberState.profile, memberState.tab);
        if (text) copyText(text, copyBtn);
      });
    }

    window.addEventListener('forbes:select', (e) => {
      const person = e.detail?.person;
      if (!person || person.rank === memberState.profile?.rank) return;
      memberState.profile = person;
      renderMemberHeader(person);
      renderMemberPanel(person, memberState.tab);
      updateMemberNavButtons(person);
    });

    if (dataset.length) {
      selectMemberProfile(dataset[0], { syncForbes: false });
    } else {
      renderMemberHeader(null);
      renderMemberPanel(null, memberState.tab);
      updateMemberNavButtons(null);
    }
  }

  function refreshExportPanels() {
    const filtered = filterDataset();
    $('#export-count').textContent = `${filtered.length} of ${dataset.length} profiles match filters`;

    $('#out-json').textContent = buildExportJson();
    $('#out-yaml').textContent = buildManifestYaml();
    $('#out-llms').textContent = buildLlmsTxt();
    $('#out-csv').textContent = buildExportCsv();

    const preview = $('#filter-preview');
    if (preview) {
      preview.innerHTML = filtered
        .slice(0, 12)
        .map(
          (e) =>
            `<a href="#forbes?rank=${e.rank}&name=${encodeURIComponent(e.name)}">#${e.rank} ${escapeHtml(e.name)}</a>`,
        )
        .join('');
      if (filtered.length > 12) {
        preview.innerHTML += `<span class="more-paths">+${filtered.length - 12} more</span>`;
      }
    }
  }

  function goStep(n) {
    state.step = n;
    $$('.wizard-step', $('#configurator')).forEach((el) =>
      el.classList.toggle('active', Number(el.dataset.step) === n),
    );
    $$('.step-indicator .step', $('#configurator')).forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    const prev = $('#btn-prev');
    const next = $('#btn-next');
    if (prev) prev.disabled = n === 1;
    if (next) next.textContent = n === 4 ? 'Done' : 'Next';
    if (n === 3 || n === 4) refreshExportPanels();
    const cfg = $('#configurator');
    if (cfg) window.scrollTo({ top: cfg.offsetTop - 80, behavior: 'smooth' });
  }

  function initConfigurator() {
    const root = $('#configurator');
    if (!root) return;

    const countries = [...new Set(dataset.map((e) => e.country).filter(Boolean))].sort();

    const sectorSel = $('#filter-sector');
    if (sectorSel) {
      sectorSel.innerHTML =
        '<option value="">All sectors</option>' +
        SECTORS.filter((s) => dataset.some((e) => e.sector === s))
          .concat([...new Set(dataset.map((e) => e.sector))].filter((s) => !SECTORS.includes(s)))
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
          .join('');
      sectorSel.addEventListener('change', () => {
        state.sector = sectorSel.value;
        if (state.step >= 3) refreshExportPanels();
      });
    }

    const countrySel = $('#filter-country');
    if (countrySel) {
      countrySel.innerHTML =
        '<option value="">All countries</option>' +
        countries.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      countrySel.addEventListener('change', () => {
        state.country = countrySel.value;
        if (state.step >= 3) refreshExportPanels();
      });
    }

    const rankMin = $('#filter-rank-min');
    const rankMax = $('#filter-rank-max');
    [rankMin, rankMax].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => {
        state.rankMin = Math.max(1, Number(rankMin.value) || 1);
        state.rankMax = Math.min(100, Number(rankMax.value) || 100);
        if (state.step >= 3) refreshExportPanels();
      });
    });

    const enrichedCb = $('#filter-enriched');
    if (enrichedCb) {
      enrichedCb.addEventListener('change', () => {
        state.enrichedOnly = enrichedCb.checked;
        if (state.step >= 3) refreshExportPanels();
      });
    }

    const fieldsGrid = $('#export-fields');
    if (fieldsGrid) {
      fieldsGrid.innerHTML = EXPORT_FIELDS.map((f) => {
        const checked = state.fields.has(f.id) ? 'checked' : '';
        return `
        <label class="option-card" data-id="${f.id}">
          <input type="checkbox" name="field-${f.id}" ${checked} />
          <span class="option-body">
            <strong>${escapeHtml(f.label)}</strong>
            <span class="option-desc">${escapeHtml(f.desc)}</span>
          </span>
        </label>`;
      }).join('');

      $$('input[type=checkbox]', fieldsGrid).forEach((input) => {
        input.addEventListener('change', (e) => {
          const id = e.target.closest('.option-card').dataset.id;
          if (e.target.checked) state.fields.add(id);
          else if (state.fields.size > 1) state.fields.delete(id);
          else e.target.checked = true;
          if (state.step >= 3) refreshExportPanels();
        });
      });
    }

    $('#btn-prev')?.addEventListener('click', () => goStep(Math.max(1, state.step - 1)));
    $('#btn-next')?.addEventListener('click', () => {
      if (state.step < 4) goStep(state.step + 1);
      else goStep(4);
    });

    $$('.tab-btn', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn', root).forEach((b) => b.classList.remove('active'));
        $$('.tab-panel', root).forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $(`#panel-${btn.dataset.tab}`, root)?.classList.add('active');
      });
    });

    $$('[data-copy]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = $(`#out-${btn.dataset.copy}`, root);
        if (el) copyText(el.textContent, btn);
      });
    });

    $('#btn-download-json')?.addEventListener('click', () =>
      downloadFile(buildExportJson(), 'forbes-wealth-export.json', 'application/json'),
    );
    $('#btn-download-yaml')?.addEventListener('click', () =>
      downloadFile(buildManifestYaml(), 'forbes-wealth-manifest.yaml', 'text/yaml'),
    );
    $('#btn-download-csv')?.addEventListener('click', () =>
      downloadFile(buildExportCsv(), 'forbes-wealth-summary.csv', 'text/csv'),
    );

    goStep(1);
    refreshExportPanels();
  }

  async function initWealthDataTools() {
    try {
      const resp = await fetch(DATA_URL);
      if (resp.ok) {
        dataset = await resp.json();
        dataset.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      }
    } catch {
      dataset = [];
    }
    initMemberDetails();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWealthDataTools);
  } else {
    initWealthDataTools();
  }
})();
