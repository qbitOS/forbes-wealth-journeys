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

  const QUICK_PATHS = [
    {
      id: 'browse',
      label: 'Browse profiles',
      blurb: 'Ranked list with wealth breakdown, entities, and journey timelines.',
      hash: '#forbes',
      cmd: null,
    },
    {
      id: 'ventures',
      label: 'Venture gitgraph',
      blurb: 'Elon portfolio + Colossus/Grok/IPO lanes with drill-down sources.',
      hash: '#timeline',
      cmd: null,
    },
    {
      id: 'top10',
      label: 'Top 10',
      blurb: 'Jump to Forbes ranks 1–10.',
      hash: '#forbes?rank=1&name=Elon%20Musk',
      cmd: null,
    },
    {
      id: 'enriched',
      label: 'Enriched stakes',
      blurb: 'Profiles with stake-level wealthBreakdown (Musk, Page, Brin, Bezos, Ellison, Zuckerberg).',
      hash: '#configurator',
      cmd: null,
      onSelect: () => {
        state.enrichedOnly = true;
        const cb = $('#filter-enriched');
        if (cb) cb.checked = true;
        refreshExportPanels();
      },
    },
    {
      id: 'local',
      label: 'Run locally',
      blurb: 'Static server — no build step.',
      hash: null,
      cmd: `git clone ${REPO_BASE}.git\ncd forbes-wealth-journeys\npython -m http.server 8080\n# open http://localhost:8080/#forbes`,
    },
    {
      id: 'dataset',
      label: 'Edit dataset',
      blurb: 'Append or import Grok JSON exports.',
      hash: null,
      cmd: `# import full Grok export\npython scripts/import_grok_forbes.py grok-export.json\n\n# migrate v1 → v2 schema\npython scripts/migrate_forbes_v2.py`,
    },
  ];

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
    return JSON.stringify(filterDataset().map(pickFields), null, 2);
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

  function initQuickStart() {
    const grid = $('#quick-templates');
    const output = $('#quick-cmd');
    const copyBtn = $('#copy-quick-cmd');
    if (!grid || !output) return;

    let active = QUICK_PATHS[0];

    function renderOutput() {
      if (active.cmd) {
        output.textContent = active.cmd;
      } else if (active.hash) {
        output.textContent = `${PAGES_URL}${active.hash}\n\n${active.blurb}`;
      } else {
        output.textContent = active.blurb;
      }
    }

    grid.innerHTML = QUICK_PATHS.map(
      (p) =>
        `<button type="button" class="quick-btn${p.id === active.id ? ' active' : ''}" data-id="${p.id}">${escapeHtml(p.label)}</button>`,
    ).join('');

    renderOutput();

    $$('.quick-btn', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        active = QUICK_PATHS.find((p) => p.id === btn.dataset.id) || active;
        $$('.quick-btn', grid).forEach((b) =>
          b.classList.toggle('active', b.dataset.id === active.id),
        );
        renderOutput();
        if (active.onSelect) active.onSelect();
        if (active.hash && !active.cmd) {
          window.location.hash = active.hash.replace(/^#/, '');
        }
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyText(output.textContent, copyBtn));
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
    initQuickStart();
    try {
      const resp = await fetch(DATA_URL);
      if (resp.ok) dataset = await resp.json();
    } catch {
      dataset = [];
    }
    initConfigurator();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWealthDataTools);
  } else {
    initWealthDataTools();
  }
})();
