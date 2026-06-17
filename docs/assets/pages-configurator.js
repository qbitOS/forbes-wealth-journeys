/**
 * Grok Assembly Line — Option 2 Configurator
 * Static client-side wizard → one-click commands + manifest exports
 */
(function () {
  'use strict';

  const REPO = 'fornevercollective/grok-repo-template';
  const REPO_BASE = `https://github.com/${REPO}`;
  const PAGES_URL = 'https://fornevercollective.github.io/grok-repo-template/';

  const QUICK_TEMPLATES = [
    { id: 'full', label: 'Full template', path: '', prompt: 'Use grok-repo-template (fornevercollective/grok-repo-template). Clone, read AGENTS.md + LLMS.md, run grok inspect. Scaffold Colossus/DVC baseline.' },
    { id: 'vision', label: 'Vision', path: 'examples/vision/', prompt: 'Use grok-repo-template — scaffold from examples/vision/ with configs/colossus.yaml and DVC pipeline.' },
    { id: 'agents', label: 'Agents', path: 'examples/agents/', prompt: 'Use grok-repo-template — scaffold from examples/agents/ with Grok prompts and connector skills.' },
    { id: 'fine-tuning', label: 'Fine-tuning', path: 'examples/fine-tuning/', prompt: 'Use grok-repo-template — scaffold PEFT/LoRA from examples/fine-tuning/ with DVC train stage.' },
    { id: 'jax-colossus', label: 'JAX Colossus', path: 'examples/jax-colossus/', prompt: 'Use grok-repo-template — wire JAX MoE from examples/jax-colossus/ with scripts/colossus-launch.sh.' },
    { id: 'capsule-ui', label: 'Capsule UI', path: 'examples/spacex-capsule-ui/', prompt: 'Use grok-repo-template — extend examples/spacex-capsule-ui/ (capsule_ui.js). Mission-critical dark cockpit UI.' },
    { id: 'rust-dojo', label: 'Rust Dojo', path: 'examples/rust-dojo/', prompt: 'Use grok-repo-template — scaffold from examples/rust-dojo/ for Dojo performance patterns.' },
  ];

  const DOMAINS = [
    { id: 'spacex-capsule-ui', label: 'Capsule UI', desc: 'Mission-critical cockpit touch-screen', path: 'examples/spacex-capsule-ui/', search: 'spacex capsule ui cockpit touchscreen' },
    { id: 'vision', label: 'Vision', desc: 'Classification, detection pipelines', path: 'examples/vision/', search: 'vision pipeline model detection colossus' },
    { id: 'agents', label: 'Agents', desc: 'Tool-use loops + Grok prompts', path: 'examples/agents/', search: 'agent loop grok prompts tool-use' },
    { id: 'fine-tuning', label: 'Fine-tuning', desc: 'PEFT / LoRA training', path: 'examples/fine-tuning/', search: 'peft lora fine-tuning grok' },
    { id: 'jax-colossus', label: 'JAX Colossus', desc: 'MoE distributed training', path: 'examples/jax-colossus/', search: 'jax moe colossus multi-host' },
    { id: 'rust-dojo', label: 'Rust Dojo', desc: 'Low-latency performance patterns', path: 'examples/rust-dojo/', search: 'rust dojo performance grok' },
    { id: 'python-grok', label: 'Python Grok', desc: 'Type-hinted Grok-friendly patterns', path: 'examples/python-grok/', search: 'python grok patterns type hints' },
    { id: 'cuda-kernels', label: 'CUDA Kernels', desc: 'Attention & low-level GPU kernels', path: 'src/kernels/', search: 'cuda kernel attention sm_80 colossus' },
    { id: 'dvc-pipelines', label: 'DVC Pipelines', desc: 'Reproducible data + train stages', path: 'dvc.yaml', search: 'dvc pipeline repro grok-repo-template' },
    { id: 'colossus-cluster', label: 'Colossus Cluster', desc: 'Multi-node SLURM / JAX scaling', path: 'configs/colossus.yaml', search: 'colossus cluster sbatch jax multi-node' },
    { id: 'grok-connectors', label: 'Grok Connectors', desc: 'GitHub, web, code, X pipelines', path: 'scripts/connectors/', search: 'grok connector pipeline github x-tools' },
    { id: 'standards-compliance', label: 'Standards Compliance', desc: 'SpaceX/Terrafab/x.ai/Grokipedia', path: 'standards/xai-spacex-terrafab-grokipedia.md', search: 'spacex terrafab grokipedia xai standards' },
  ];

  const INFRA = [
    { id: 'colossus', label: 'Colossus', desc: 'Multi-node GPU cluster launch', paths: ['configs/colossus.yaml', 'scripts/colossus-launch.sh', 'scripts/colossus/colossus-job.sh', 'docs/colossus-cluster-setup.md'] },
    { id: 'dvc', label: 'DVC', desc: 'Data versioning + pipeline repro', paths: ['dvc.yaml', 'scripts/explore_dvc.py', 'docs/dvc-pipelines.md'] },
    { id: 'docker', label: 'Docker', desc: 'Local + Colossus CUDA images', paths: ['Dockerfiles/Dockerfile', 'Dockerfiles/Dockerfile.colossus'] },
    { id: 'ci-cd', label: 'CI/CD', desc: 'GitHub Actions workflows', paths: ['.github/workflows/ci-cd.yml', '.github/workflows/grok-connectors-pipelines.yml'] },
  ];

  const CONNECTORS = [
    { id: 'github', label: 'GitHub', skill: 'github-connector', path: 'scripts/connectors/github_pipeline.py', search: 'github connector grok skill' },
    { id: 'web_search', label: 'Web Search', skill: 'web-search', path: 'scripts/connectors/web_pipeline.py', search: 'web search connector grok' },
    { id: 'browse_page', label: 'Browse Page', skill: 'browse-page', path: 'scripts/connectors/web_pipeline.py', search: 'browse page connector grok' },
    { id: 'code_execution', label: 'Code Execution', skill: 'code-execution', path: 'scripts/connectors/code_execution_pipeline.py', search: 'code execution connector grok' },
    { id: 'x_tools', label: 'X-tools (X.com)', skill: 'x-tools', path: 'scripts/connectors/x_tools_pipeline.py', search: 'x-tools x.com connector grok' },
  ];

  const ECOSYSTEM = [
    { id: 'grokipedia', label: 'Grokipedia', desc: 'Knowledge-base submission pipeline', paths: ['.github/workflows/grokipedia-submission.yml', 'standards/xai-spacex-terrafab-grokipedia.md', 'prompts/'], search: 'grokipedia submission pipeline grok' },
    { id: 'x_com', label: 'X.com / X-tools', desc: 'Social search + thread ingestion', paths: ['scripts/connectors/x_tools_pipeline.py', '.grok/skills/x-tools/SKILL.md'], search: 'x.com x-tools connector grok social' },
    { id: 'xai', label: 'X.ai Routing', desc: 'JAX/MoE + truth-seeking standards', paths: ['standards/xai-spacex-terrafab-grokipedia.md', 'configs/colossus.yaml', 'LLMS.md'], search: 'x.ai grok colossus jax routing' },
    { id: 'imagine', label: 'Imagine', desc: 'Media generation hooks (standards placeholder)', paths: ['standards/xai-spacex-terrafab-grokipedia.md', 'pipelines/'], search: 'imagine x.ai media generation grok', optional: true },
    { id: 'spacex_terrafab', label: 'SpaceX / Terrafab', desc: 'Aerospace-grade reliability + fab workflows', paths: ['standards/xai-spacex-terrafab-grokipedia.md', '.github/workflows/standards-compliance.yml', 'pipelines/'], search: 'spacex terrafab manufacturing grok standards' },
    { id: 'superheavy_colossus', label: 'SuperHeavyGrok / Colossus', desc: 'Fastest pipe to cluster server paths', paths: ['scripts/colossus-launch.sh', 'configs/colossus.yaml', 'docs/colossus-cluster-setup.md', 'metadata.yaml'], search: 'superheavygrok colossus server path grok' },
  ];

  const AGENT_HOOKS = {
    grok_github: { id: 'grok-github-connector', status: 'active', inject: 'first_prompt' },
    cursor_agent: { id: 'cursor-agent-placeholder', status: 'coming_soon', inject: 'AGENTS.md + .cursor/rules/' },
    terminal_agent: { id: 'terminal-agent-placeholder', status: 'coming_soon', inject: 'shell env + grok inspect' },
  };

  const state = {
    step: 1,
    projectName: 'my-grok-project',
    domains: new Set(['vision', 'agents']),
    infra: new Set(['colossus', 'dvc']),
    connectors: new Set(['github', 'web_search']),
    ecosystem: new Set(['xai', 'superheavy_colossus']),
  };

  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

  function renderCheckboxGroup(container, items, setKey, prefix) {
    container.innerHTML = items.map((item) => {
      const checked = state[setKey].has(item.id) ? 'checked' : '';
      const optional = item.optional ? ' <span class="tag tag-optional">optional</span>' : '';
      const pathHint = item.path || (item.paths && item.paths[0]) || '';
      return `
        <label class="option-card" data-id="${item.id}">
          <input type="checkbox" name="${prefix}-${item.id}" ${checked} />
          <span class="option-body">
            <strong>${item.label}${optional}</strong>
            <span class="option-desc">${item.desc || ''}</span>
            ${pathHint ? `<code class="option-path">${pathHint}</code>` : ''}
          </span>
        </label>`;
    }).join('');

    $$('input[type=checkbox]', container).forEach((input) => {
      input.addEventListener('change', (e) => {
        const id = e.target.closest('.option-card').dataset.id;
        if (e.target.checked) state[setKey].add(id);
        else state[setKey].delete(id);
        if (state.step === 4) refreshOutputs();
      });
    });
  }

  function collectPaths() {
    const paths = new Set(['AGENTS.md', 'LLMS.md', 'metadata.yaml', 'llms.txt']);
    DOMAINS.filter((d) => state.domains.has(d.id)).forEach((d) => paths.add(d.path));
    INFRA.filter((i) => state.infra.has(i.id)).forEach((i) => i.paths.forEach((p) => paths.add(p)));
    CONNECTORS.filter((c) => state.connectors.has(c.id)).forEach((c) => {
      paths.add(c.path);
      paths.add(`.grok/skills/${c.skill}/SKILL.md`);
    });
    ECOSYSTEM.filter((e) => state.ecosystem.has(e.id)).forEach((e) => e.paths.forEach((p) => paths.add(p)));
    return [...paths].sort();
  }

  function collectSkills() {
    return CONNECTORS.filter((c) => state.connectors.has(c.id)).map((c) => c.skill);
  }

  function collectSearchKeywords() {
    const kw = new Set([REPO, 'grok-repo-template', 'colossus', 'grok', 'superheavygrok']);
    DOMAINS.filter((d) => state.domains.has(d.id)).forEach((d) => d.search.split(' ').forEach((w) => kw.add(w)));
    CONNECTORS.filter((c) => state.connectors.has(c.id)).forEach((c) => c.search.split(' ').forEach((w) => kw.add(w)));
    ECOSYSTEM.filter((e) => state.ecosystem.has(e.id)).forEach((e) => e.search.split(' ').forEach((w) => kw.add(w)));
    return [...kw].filter(Boolean);
  }

  function githubSearchQuery() {
    const terms = collectSearchKeywords().slice(0, 8).join(' ');
    return `repo:${REPO} ${terms}`;
  }

  function generatePrompt() {
    const domains = DOMAINS.filter((d) => state.domains.has(d.id)).map((d) => d.label).join(', ') || 'general';
    const skills = collectSkills();
    const paths = collectPaths();
    const eco = ECOSYSTEM.filter((e) => state.ecosystem.has(e.id)).map((e) => e.label).join(', ');

    return `# Auto-config first prompt — ${state.projectName}
# Generated from ${PAGES_URL}
# Copy into Grok GitHub connector, Cursor agent, or terminal agent bootstrap.

Use the **grok-repo-template** (${REPO_BASE}) as the scaffold for **${state.projectName}**.

## Project focus
- Domains: ${domains}
- Infrastructure: ${[...state.infra].join(', ') || 'default'}
- Grok connectors: ${[...state.connectors].join(', ') || 'none selected'}
- Ecosystem routing: ${eco || 'x.ai baseline'}

## Required reading (fastest GitHub search pipe)
1. Clone or template from \`${REPO_BASE}\`
2. Read \`AGENTS.md\` and \`LLMS.md\` for routing variants
3. Apply \`metadata.yaml\` manifest below (or attached JSON)
4. Enable skills: ${skills.map((s) => `\`.grok/skills/${s}/\``).join(', ') || 'none'}

## Priority paths
${paths.map((p) => `- \`${p}\` → ${REPO_BASE}/tree/main/${p}`).join('\n')}

## GitHub code search (optimized)
\`\`\`
${githubSearchQuery()}
\`\`\`

## Setup commands
\`\`\`bash
git clone ${REPO_BASE}.git ${state.projectName}
cd ${state.projectName}
cp .env.example .env
uv sync   # or: pip install -e ".[dev]"
grok inspect
\`\`\`

## Connector hooks
- Grok GitHub: ${AGENT_HOOKS.grok_github.id} (${AGENT_HOOKS.grok_github.status})
- Cursor agent: ${AGENT_HOOKS.cursor_agent.id} (${AGENT_HOOKS.cursor_agent.status})
- Terminal agent: ${AGENT_HOOKS.terminal_agent.id} (${AGENT_HOOKS.terminal_agent.status})

Scaffold only what I selected. Match existing conventions in the template. Use DVC for data, Colossus configs for scale, and standards in \`standards/xai-spacex-terrafab-grokipedia.md\` where applicable.`;
  }

  function generateJson() {
    const domainIds = [...state.domains];
    const manifest = {
      generated_from: PAGES_URL,
      project: {
        name: state.projectName,
        template: REPO,
        grok_optimized: true,
        colossus_compatible: state.infra.has('colossus') || state.domains.has('colossus-cluster'),
        dvc_enabled: state.infra.has('dvc') || state.domains.has('dvc-pipelines'),
        domain_examples: domainIds.filter((id) => DOMAINS.some((d) => d.id === id && !['dvc-pipelines', 'colossus-cluster', 'grok-connectors', 'standards-compliance', 'cuda-kernels'].includes(id))),
        entrypoints: {
          train: 'scripts/train.py',
          infer: 'scripts/infer.py',
          colossus_launch: state.infra.has('colossus') ? 'scripts/colossus-launch.sh' : null,
          explore: state.infra.has('dvc') ? 'scripts/explore_dvc.py' : null,
        },
        grok_connectors: [...state.connectors],
        grok_skills: collectSkills().map((s) => `.grok/skills/${s}/SKILL.md`),
        standards: [...state.ecosystem].filter((id) => ['grokipedia', 'xai', 'spacex_terrafab', 'imagine'].includes(id)).map((id) => id.replace('_', '-')),
        ecosystem_paths: ECOSYSTEM.filter((e) => state.ecosystem.has(e.id)).reduce((acc, e) => { acc[e.id] = e.paths; return acc; }, {}),
        priority_paths: collectPaths(),
        github_search: githubSearchQuery(),
        agent_hooks: AGENT_HOOKS,
      },
    };
    return JSON.stringify(manifest, null, 2);
  }

  function generateYaml() {
    const domainList = [...state.domains].filter((id) => DOMAINS.some((d) => d.id === id && !['dvc-pipelines', 'colossus-cluster', 'grok-connectors', 'standards-compliance', 'cuda-kernels'].includes(id)));
    const standards = [...state.ecosystem].filter((id) => ['grokipedia', 'xai', 'spacex_terrafab', 'imagine'].includes(id)).map((id) => id.replace('_terrafab', '').replace('_', '-'));
    const skills = collectSkills();

    return `# metadata.yaml snippet — ${state.projectName}
# Paste into project root; merge with grok-repo-template defaults
project:
  name: ${state.projectName}
  grok_optimized: true
  colossus_compatible: ${state.infra.has('colossus') || state.domains.has('colossus-cluster')}
  dojo_pipeline: ${state.domains.has('rust-dojo')}
  license: Apache-2.0
  dvc_enabled: ${state.infra.has('dvc') || state.domains.has('dvc-pipelines')}
  domain_examples: [${domainList.join(', ')}]
  entrypoints:
    train: scripts/train.py
    infer: scripts/infer.py${state.infra.has('colossus') ? '\n    colossus_launch: scripts/colossus-launch.sh' : ''}${state.infra.has('dvc') ? '\n    explore: scripts/explore_dvc.py' : ''}
  grok_connectors:
${[...state.connectors].map((c) => `    - ${c}`).join('\n') || '    - github'}
  grok_skills:
${skills.map((s) => `    - .grok/skills/${s}/SKILL.md`).join('\n') || '    - .grok/skills/github-connector/SKILL.md'}
  standards:
${standards.map((s) => `    - ${s}`).join('\n') || '    - xai'}
  pages_configurator: ${PAGES_URL}
  github_search: "${githubSearchQuery()}"
`;
  }

  function generateLlmsTxt() {
    const paths = collectPaths();
    return `# llms.txt route hints — ${state.projectName}
# https://llmstxt.org/ — append or merge with template llms.txt

> ${state.projectName} (from grok-repo-template)

## Primary Instructions
- LLMS.md
- AGENTS.md

## Selected Entry Points
${paths.filter((p) => p.startsWith('scripts/') || p.startsWith('configs/')).map((p) => `- ${p}`).join('\n')}

## Domain Examples
${DOMAINS.filter((d) => state.domains.has(d.id) && d.path.startsWith('examples/')).map((d) => `- ${d.path}`).join('\n') || '- examples/python-grok/'}

## Connectors
${CONNECTORS.filter((c) => state.connectors.has(c.id)).map((c) => `- ${c.path} (${c.skill})`).join('\n')}

## Standards & Ecosystem
${ECOSYSTEM.filter((e) => state.ecosystem.has(e.id)).map((e) => `- ${e.label}: ${e.paths[0]}`).join('\n')}

## GitHub Search
- ${githubSearchQuery()}
`;
  }

  function refreshOutputs() {
    const prompt = generatePrompt();
    const json = generateJson();
    const yaml = generateYaml();
    const llms = generateLlmsTxt();

    $('#out-prompt').textContent = prompt;
    $('#out-json').textContent = json;
    $('#out-yaml').textContent = yaml;
    $('#out-llms').textContent = llms;

    const pathList = $('#path-links');
    pathList.innerHTML = collectPaths().slice(0, 12).map((p) =>
      `<a href="${REPO_BASE}/tree/main/${p}" target="_blank" rel="noopener">${p}</a>`
    ).join('');
    if (collectPaths().length > 12) {
      pathList.innerHTML += `<span class="more-paths">+${collectPaths().length - 12} more in export</span>`;
    }

    $('#search-preview').textContent = githubSearchQuery();
  }

  function quickCommand(template) {
    const folder = template.path ? ` Focus on \`${template.path}\`.` : '';
    return `${template.prompt}${folder}

\`\`\`bash
git clone ${REPO_BASE}.git my-grok-project && cd my-grok-project && cp .env.example .env && uv sync && grok inspect
\`\`\``;
  }

  function initQuickTemplates() {
    const grid = $('#quick-templates');
    const output = $('#quick-cmd');
    const copyBtn = $('#copy-quick-cmd');
    if (!grid || !output) return;

    let active = QUICK_TEMPLATES[0];
    output.textContent = quickCommand(active);

    grid.innerHTML = QUICK_TEMPLATES.map((t) =>
      `<button type="button" class="quick-btn${t.id === active.id ? ' active' : ''}" data-id="${t.id}">${t.label}</button>`
    ).join('');

    $$('.quick-btn', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        active = QUICK_TEMPLATES.find((t) => t.id === btn.dataset.id) || active;
        $$('.quick-btn', grid).forEach((b) => b.classList.toggle('active', b.dataset.id === active.id));
        output.textContent = quickCommand(active);
      });
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyText(output.textContent, copyBtn));
    }
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
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

  function goStep(n) {
    state.step = n;
    $$('.wizard-step').forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === n));
    $$('.step-indicator .step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === n);
      el.classList.toggle('done', s < n);
    });
    $('#btn-prev').disabled = n === 1;
    $('#btn-next').textContent = n === 4 ? 'Finish' : 'Next';
    if (n === 4) refreshOutputs();
    const panel = document.getElementById('configurator');
    if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function init() {
    const cfg = $('#configurator');
    if (cfg?.dataset.mode === 'wealth' || cfg?.dataset.mode === 'market') return;
    initQuickTemplates();

    const root = $('#configurator');
    if (!root) return;

    renderCheckboxGroup($('#step1-options'), DOMAINS, 'domains', 'domain');
    renderCheckboxGroup($('#step2-options'), INFRA, 'infra', 'infra');
    renderCheckboxGroup($('#step3-connectors'), CONNECTORS, 'connectors', 'conn');
    renderCheckboxGroup($('#step3-ecosystem'), ECOSYSTEM, 'ecosystem', 'eco');

    $('#project-name').addEventListener('input', (e) => {
      state.projectName = e.target.value.trim() || 'my-grok-project';
      if (state.step === 4) refreshOutputs();
    });

    $('#btn-prev').addEventListener('click', () => goStep(Math.max(1, state.step - 1)));
    $('#btn-next').addEventListener('click', () => {
      if (state.step < 4) goStep(state.step + 1);
      else goStep(4);
    });

    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach((b) => b.classList.remove('active'));
        $$('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $(`#panel-${btn.dataset.tab}`).classList.add('active');
      });
    });

    $$('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.copy;
        const el = $(`#out-${target}`);
        if (el) copyText(el.textContent, btn);
      });
    });

    $('#btn-download-json').addEventListener('click', () =>
      downloadFile(generateJson(), `${state.projectName}-manifest.json`, 'application/json'));
    $('#btn-download-yaml').addEventListener('click', () =>
      downloadFile(generateYaml(), `${state.projectName}-metadata.yaml`, 'text/yaml'));

    goStep(1);
  }

  /** xAI · Colossus · Terafab · IPO cluster — fixed 4-lane layout. */
  const TIMELINE_CLUSTER_BRANCHES = [
    { id: 'grok', label: 'grok', color: '#2563eb' },
    { id: 'colossus', label: 'colossus', color: '#16a34a' },
    { id: 'terrafab', label: 'terrafab', color: '#d97706' },
    { id: 'spacex', label: 'spacex-ipo', color: '#7c3aed' },
  ];

  /** Elon portfolio ventures — 6-lane secondary section. */
  const TIMELINE_PORTFOLIO_BRANCHES = [
    { id: 'tesla', label: 'tsla', color: '#dc2626' },
    { id: 'spacex-ops', label: 'spacex-ops', color: '#6366f1' },
    { id: 'x-corp', label: 'x-corp', color: '#171717' },
    { id: 'neuralink', label: 'neuralink', color: '#0891b2' },
    { id: 'boring', label: 'boring-co', color: '#78716c' },
    { id: 'openai', label: 'openai', color: '#059669' },
  ];

  /** Public timeline — approximate dates (~) where sources differ. Stock snapshots are informational only. */
  const TIMELINE_CLUSTER_EVENTS = [
    { sort: '2023-07', date: 'Jul 2023', branch: 'grok', id: 'xai-founded', title: 'xAI announced', approx: false },
    { sort: '2023-11', date: 'Nov 2023', branch: 'grok', id: 'grok-preview', title: 'Grok preview on X Premium+', approx: false },
    { sort: '2023-11', date: 'Nov 2023', branch: 'grok', id: 'grok-1', title: 'Grok-1 · 314B MoE', approx: false },
    { sort: '2024-03', date: 'Mar 2024', branch: 'grok', id: 'grok-1-oss', title: 'Grok-1 open source (Apache)', approx: false },
    { sort: '2024-03', date: 'Mar 2024', branch: 'colossus', id: 'memphis-start', title: 'Colossus build starts · Memphis', approx: true },
    { sort: '2024-05', date: 'May 2024', branch: 'grok', id: 'series-b', title: '$6B Series B', approx: false },
    { sort: '2024-06', date: 'Jun 5 2024', branch: 'colossus', id: 'colossus-announce', title: 'Colossus announced · 100K H100 target', approx: false },
    { sort: '2024-08', date: 'Aug 2024', branch: 'colossus', id: 'colossus-live', title: 'Colossus live · 122-day build', approx: false },
    { sort: '2024-08', date: 'Aug 2024', branch: 'grok', id: 'grok-2', title: 'Grok-2 released', approx: false },
    { sort: '2024-12', date: 'Dec 2024', branch: 'grok', id: 'aurora', title: 'Aurora image model', approx: false },
    { sort: '2024-12', date: 'Dec 2024', branch: 'colossus', id: '100k-gpus', title: '100K GPUs operational', approx: true },
    { sort: '2025-02', date: 'Feb 2025', branch: 'grok', id: 'grok-3', title: 'Grok 3 launched', approx: false },
    { sort: '2025-02', date: 'Feb 2025', branch: 'colossus', id: 'scale-200k', title: 'Scaled to 200K GPUs · 92 days', approx: false },
    { sort: '2025-03', date: 'Mar 2025', branch: 'colossus', id: 'colossus-2', title: 'Colossus 2 site · 1M sq ft', approx: false },
    { sort: '2025-07', date: 'Jul 2025', branch: 'grok', id: 'grok-4', title: 'Grok 4 · multi-agent', approx: false },
    { sort: '2025-08', date: 'Aug 2025', branch: 'grok', id: 'grok-imagine', title: 'Grok Imagine video · 480p', approx: false },
    { sort: '2025-10', date: 'Oct 18 2025', branch: 'grok', id: 'alpha-arena-s1', title: 'Alpha Arena S1 · live crypto', approx: false },
    { sort: '2025-11', date: 'Nov 2025', branch: 'grok', id: 'grok-4-1', title: 'Grok 4.1 · EQ-Bench lead', approx: false },
    { sort: '2025-11', date: 'Nov 3 2025', branch: 'grok', id: 'alpha-arena-s1-end', title: 'Alpha Arena S1 · Grok 4 −45%', approx: true },
    { sort: '2025-11', date: 'Nov 19 2025', branch: 'grok', id: 'alpha-arena-s15', title: 'Alpha Arena S1.5 · US equities', approx: false },
    { sort: '2025-11', date: '~Nov 27 2025', branch: 'grok', id: 'rallies-arena-start', title: 'Rallies AI Arena · $100K/model', approx: true },
    { sort: '2025-12', date: 'Dec 3 2025', branch: 'grok', id: 'alpha-arena-s15-win', title: 'Grok 4.20 wins S1.5 · +12.11%', approx: false },
    { sort: '2026-01', date: 'Jan 2026', branch: 'colossus', id: 'colossus-2-gw', title: 'Colossus 2 · ~1 GW online', approx: true },
    { sort: '2026-01', date: 'Jan 2026', branch: 'grok', id: 'rallies-arena-lead', title: 'Rallies Arena · Grok ~+8% lead', approx: true },
    { sort: '2026-02', date: 'Feb 17 2026', branch: 'grok', id: 'grok-4-20', title: 'Grok 4.20 · 4-agent beta', approx: false },
    { sort: '2026-02', date: 'Feb 2026', branch: 'spacex', id: 'xai-merge', title: 'SpaceX acquires xAI · ~$1.25T', approx: true, merge: true },
    { sort: '2026-03', date: 'Mar 21 2026', branch: 'terrafab', id: 'terrafab-launch', title: 'Terafab announced · Austin proto', approx: false },
    { sort: '2026-03', date: 'Mar 2026', branch: 'colossus', id: '555k-target', title: '555K GPU target · $659M permit', approx: true },
    { sort: '2026-04', date: 'Apr 1 2026', branch: 'spacex', id: 'sec-confidential', title: 'Confidential SEC filing', approx: false },
    { sort: '2026-04', date: 'Apr 7 2026', branch: 'terrafab', id: 'intel-joins', title: 'Intel joins · 18A foundry', approx: false },
    { sort: '2026-04', date: 'Apr 2026', branch: 'terrafab', id: 'supermicro', title: 'Supermicro infra partner', approx: false },
    { sort: '2026-04', date: 'Apr 17 2026', branch: 'grok', id: 'grok-4-3', title: 'Grok 4.3 beta · 2M context', approx: false },
    { sort: '2026-05', date: 'May 14 2026', branch: 'grok', id: 'grok-build', title: 'Grok Build CLI shipped', approx: false },
    { sort: '2026-05', date: 'May 20 2026', branch: 'spacex', id: 's-1-public', title: 'Public S-1 filed', approx: false },
    { sort: '2026-05', date: 'May 2026', branch: 'terrafab', id: '55b-filing', title: '$55B phase · up to $119B', approx: true },
    { sort: '2026-05', date: 'May 2026', branch: 'colossus', id: 'anthropic-lease', title: 'Anthropic leases Colossus 1', approx: true },
    { sort: '2026-06', date: 'Jun 3 2026', branch: 'spacex', id: 'ipo-price', title: '$135 · $1.77T · $75B raise', approx: false },
    { sort: '2026-06', date: 'Jun 3 2026', branch: 'terrafab', id: 'tax-abate', title: 'Grimes County tax abatement', approx: false },
    { sort: '2026-06', date: 'Jun 4 2026', branch: 'spacex', id: 'roadshow', title: 'IPO roadshow · oversubscribed', approx: false },
    { sort: '2026-06', date: 'Jun 11 2026', branch: 'spacex', id: 'ipo-priced', title: 'IPO priced · 555.6M shares', approx: false },
    { sort: '2026-06', date: 'Jun 12 2026', branch: 'spacex', id: 'spcx-trade', title: 'SPCX lists · Nasdaq + Texas', approx: false },
    { sort: '2026-06', date: 'Jun 13 2026', branch: 'spacex', id: 'msci-inclusion', title: 'MSCI World inclusion T+1', approx: false },
  ];

  const TIMELINE_PORTFOLIO_EVENTS = [
    { sort: '2010-06', date: 'Jun 2010', branch: 'tesla', id: 'tsla-ipo', title: 'Tesla IPO · $17/share', approx: false },
    { sort: '2015-12', date: 'Dec 2015', branch: 'openai', id: 'openai-founded', title: 'OpenAI co-founded', approx: false },
    { sort: '2016-07', date: 'Jul 2016', branch: 'neuralink', id: 'neuralink-founded', title: 'Neuralink founded', approx: true },
    { sort: '2017-01', date: 'Jan 2017', branch: 'boring', id: 'boring-founded', title: 'Boring Company founded', approx: false },
    { sort: '2018-02', date: 'Feb 2018', branch: 'openai', id: 'openai-exit', title: 'Leaves OpenAI board', approx: false },
    { sort: '2018-12', date: 'Dec 2018', branch: 'boring', id: 'hawthorne-tunnel', title: 'Hawthorne test tunnel opens', approx: false },
    { sort: '2019-05', date: 'May 2019', branch: 'boring', id: 'vegas-loop', title: 'Vegas Loop · $48.7M contract', approx: false },
    { sort: '2022-04', date: 'Apr 2022', branch: 'x-corp', id: 'twitter-bid', title: '$44B Twitter bid', approx: false },
    { sort: '2022-10', date: 'Oct 2022', branch: 'x-corp', id: 'twitter-close', title: 'Twitter acquisition closes', approx: false },
    { sort: '2023-04', date: 'Apr 2023', branch: 'spacex-ops', id: 'starship-ift1', title: 'Starship IFT-1 first test', approx: false },
    { sort: '2023-07', date: 'Jul 2023', branch: 'x-corp', id: 'rebrand-x', title: 'Rebranded to X', approx: false },
    { sort: '2023-05', date: 'May 2023', branch: 'neuralink', id: 'fda-prime', title: 'FDA PRIME trial approved', approx: false },
    { sort: '2024-01', date: 'Jan 2024', branch: 'neuralink', id: 'first-implant', title: 'First human implant · Noland', approx: false },
    { sort: '2024-06', date: 'Jun 2024', branch: 'spacex-ops', id: 'ift4-reentry', title: 'IFT-4 · controlled reentry', approx: false },
    { sort: '2024-10', date: 'Oct 2024', branch: 'spacex-ops', id: 'mechazilla', title: 'Mechazilla booster catch · IFT-5', approx: false },
    { sort: '2024-12', date: 'Dec 2024', branch: 'tesla', id: 'tsla-ath-480', title: 'TSLA ~$480 · post-election', approx: true },
    { sort: '2024-12', date: 'Dec 2024', branch: 'spacex-ops', id: 'falcon-134', title: '134 Falcon launches in 2024', approx: false },
    { sort: '2025-03', date: 'Mar 28 2025', branch: 'x-corp', id: 'xai-acquires-x', title: 'xAI acquires X · $80B val', approx: false, merge: true },
    { sort: '2025-06', date: 'Jun 2025', branch: 'neuralink', id: 'series-e', title: '$650M Series E · ~$9B val', approx: true },
    { sort: '2025-07', date: 'Jul 2025', branch: 'neuralink', id: 'dual-implant', title: 'Two implants in one day', approx: false },
    { sort: '2025-10', date: 'Oct 2025', branch: 'spacex-ops', id: 'ift11-block2', title: 'IFT-11 · final Block 2 flight', approx: false },
    { sort: '2025-12', date: 'Dec 22 2025', branch: 'tesla', id: 'tsla-ath-498', title: 'TSLA ATH $498.83', approx: false },
    { sort: '2025-12', date: 'Dec 2025', branch: 'neuralink', id: 'high-volume', title: 'High-volume production · 2026', approx: false },
    { sort: '2025-12', date: 'Dec 2025', branch: 'spacex-ops', id: 'starlink-11b', title: 'Starlink ~$11.4B revenue', approx: true },
    { sort: '2026-01', date: 'Jan 2026', branch: 'tesla', id: 'robotaxi-austin', title: 'Unsupervised robotaxi · Austin', approx: false },
    { sort: '2026-01', date: 'Jan 2026', branch: 'neuralink', id: '21-patients', title: '21 patients globally', approx: true },
    { sort: '2026-01', date: 'Jan 2026', branch: 'x-corp', id: 'cashtags-preview', title: 'Cashtags unveiled · live charts', approx: false },
    { sort: '2026-02', date: 'Feb 2026', branch: 'tesla', id: 'cybercab-line', title: 'First Cybercab · Giga Texas', approx: false },
    { sort: '2026-02', date: 'Feb 2026', branch: 'spacex-ops', id: 'starlink-10m', title: '10M+ Starlink subscribers', approx: true },
    { sort: '2026-03', date: 'Mar 2026', branch: 'x-corp', id: 'imagine-paywall', title: 'Imagine → SuperGrok paywall', approx: false },
    { sort: '2026-04', date: 'Apr 14 2026', branch: 'x-corp', id: 'cashtags-launch', title: 'Cashtags live · US/Canada iOS', approx: false },
    { sort: '2026-04', date: 'Apr 30 2026', branch: 'x-corp', id: 'cashtags-web', title: 'Cashtags web · trading terminal', approx: false },
    { sort: '2026-05', date: 'May 22 2026', branch: 'spacex-ops', id: 'starship-v3', title: 'Starship V3 · Flight 12 · Pad 2', approx: false },
    { sort: '2026-06', date: 'Jun 11 2026', branch: 'tesla', id: 'tsla-snapshot', title: 'TSLA ~$394 · SpaceX rotation', approx: true },
  ];

  /** Extra drill-down milestones per branch (merged with base events in single-company view). */
  const TIMELINE_DRILLDOWN_EVENTS = {
    grok: [
      { sort: '2023-07', date: 'Jul 2023', branch: 'grok', id: 'team-assembled', title: 'Core team from DeepMind · OpenAI · Tesla', approx: true, drilldown: true },
      { sort: '2024-01', date: 'Jan 2024', branch: 'grok', id: 'grok-api', title: 'Grok API beta for developers', approx: true, drilldown: true },
      { sort: '2024-10', date: 'Oct 2024', branch: 'grok', id: 'grok-vision', title: 'Grok vision · image understanding', approx: false, drilldown: true },
      { sort: '2025-01', date: 'Jan 2025', branch: 'grok', id: 'grok-studio', title: 'Grok Studio workspace preview', approx: true, drilldown: true },
      { sort: '2025-05', date: 'May 2025', branch: 'grok', id: 'grok-voice', title: 'Grok Voice mode on iOS/Android', approx: false, drilldown: true },
      { sort: '2025-09', date: 'Sep 2025', branch: 'grok', id: 'grok-code', title: 'Grok Code · IDE integration beta', approx: false, drilldown: true },
      { sort: '2026-03', date: 'Mar 2026', branch: 'grok', id: 'supergrok-tier', title: 'SuperGrok subscription tier · Imagine bundle', approx: false, drilldown: true },
      { sort: '2025-10', date: 'Oct 2025', branch: 'grok', id: 'alpha-arena-s1-board', title: 'Alpha Arena S1 field · 6 models × $10K crypto', approx: false, drilldown: true },
      { sort: '2025-11', date: 'Nov 2025', branch: 'grok', id: 'alpha-arena-s15-modes', title: 'S1.5 four modes · Baseline / Monk / SA / Max Lev', approx: false, drilldown: true },
      { sort: '2025-12', date: 'Dec 2025', branch: 'grok', id: 'alpha-arena-s15-board', title: 'S1.5 final board · Grok 4.20 all 4 modes green', approx: false, drilldown: true },
      { sort: '2026-01', date: 'Jan 2026', branch: 'grok', id: 'rallies-arena-board', title: 'Rallies leaderboard · Grok vs GPT-5 / Qwen', approx: true, drilldown: true },
    ],
    colossus: [
      { sort: '2024-04', date: 'Apr 2024', branch: 'colossus', id: 'memphis-permit', title: 'Memphis site permits filed', approx: true, drilldown: true },
      { sort: '2024-07', date: 'Jul 2024', branch: 'colossus', id: 'h100-rack', title: 'First H100 racks energized', approx: true, drilldown: true },
      { sort: '2024-10', date: 'Oct 2024', branch: 'colossus', id: 'liquid-cooling', title: 'Liquid cooling loop at scale', approx: true, drilldown: true },
      { sort: '2025-01', date: 'Jan 2025', branch: 'colossus', id: '50k-gpus', title: '50K GPU milestone', approx: true, drilldown: true },
      { sort: '2025-06', date: 'Jun 2025', branch: 'colossus', id: 'b200-order', title: 'B200 / GB200 expansion orders', approx: true, drilldown: true },
      { sort: '2025-09', date: 'Sep 2025', branch: 'colossus', id: 'grid-interconnect', title: '1 GW grid interconnect approved', approx: true, drilldown: true },
      { sort: '2026-04', date: 'Apr 2026', branch: 'colossus', id: 'colossus-2-pour', title: 'Colossus 2 concrete pour · Grimes County', approx: true, drilldown: true },
    ],
    terrafab: [
      { sort: '2026-03', date: 'Mar 2026', branch: 'terrafab', id: 'austin-proto', title: 'Austin prototype line announced', approx: false, drilldown: true },
      { sort: '2026-04', date: 'Apr 2026', branch: 'terrafab', id: '18a-pilot', title: 'Intel 18A pilot wafers scheduled', approx: true, drilldown: true },
      { sort: '2026-05', date: 'May 2026', branch: 'terrafab', id: 'grimes-site', title: 'Grimes County fab site selection', approx: true, drilldown: true },
      { sort: '2026-06', date: 'Jun 2026', branch: 'terrafab', id: 'phase-1-cap', title: 'Phase 1 · 20K wafer/mo target', approx: true, drilldown: true },
    ],
    spacex: [
      { sort: '2026-02', date: 'Feb 2026', branch: 'spacex', id: 'xai-board', title: 'xAI board seats restructured post-merge', approx: true, drilldown: true },
      { sort: '2026-04', date: 'Apr 2026', branch: 'spacex', id: 'bank-syndicate', title: 'IPO bank syndicate formed', approx: true, drilldown: true },
      { sort: '2026-05', date: 'May 2026', branch: 'spacex', id: 's-1-amend', title: 'S-1/A amendment · revenue breakout', approx: false, drilldown: true },
      { sort: '2026-06', date: 'Jun 2026', branch: 'spacex', id: 'retail-allocation', title: 'Retail allocation · direct listing hybrid', approx: true, drilldown: true },
      { sort: '2026-06', date: 'Jun 2026', branch: 'spacex', id: 'lockup-terms', title: '180-day insider lockup disclosed', approx: false, drilldown: true },
    ],
    tesla: [
      { sort: '2012-06', date: 'Jun 2012', branch: 'tesla', id: 'model-s-deliver', title: 'Model S deliveries begin', approx: false, drilldown: true },
      { sort: '2017-07', date: 'Jul 2017', branch: 'tesla', id: 'model-3-ramp', title: 'Model 3 production ramp', approx: false, drilldown: true },
      { sort: '2020-12', date: 'Dec 2020', branch: 'tesla', id: 'sp500-inclusion', title: 'S&P 500 inclusion', approx: false, drilldown: true },
      { sort: '2023-03', date: 'Mar 2023', branch: 'tesla', id: 'master-plan-3', title: 'Master Plan Part 3 published', approx: false, drilldown: true },
      { sort: '2024-10', date: 'Oct 2024', branch: 'tesla', id: 'cybercab-reveal', title: 'Cybercab · Robovan reveal', approx: false, drilldown: true },
      { sort: '2025-06', date: 'Jun 2025', branch: 'tesla', id: 'optimus-gen2', title: 'Optimus Gen 2 factory trials', approx: true, drilldown: true },
    ],
    'spacex-ops': [
      { sort: '2020-05', date: 'May 2020', branch: 'spacex-ops', id: 'crew-demo', title: 'Crew Dragon Demo-2 · NASA', approx: false, drilldown: true },
      { sort: '2021-09', date: 'Sep 2021', branch: 'spacex-ops', id: 'inspiration4', title: 'Inspiration4 all-civilian orbit', approx: false, drilldown: true },
      { sort: '2023-04', date: 'Apr 2023', branch: 'spacex-ops', id: 'starship-ift1-boom', title: 'IFT-1 · rapid unplanned disassembly', approx: false, drilldown: true },
      { sort: '2024-03', date: 'Mar 2024', branch: 'spacex-ops', id: 'ift3-success', title: 'IFT-3 · full ascent profile', approx: false, drilldown: true },
      { sort: '2025-03', date: 'Mar 2025', branch: 'spacex-ops', id: 'ift10-catch', title: 'IFT-10 · booster catch attempt', approx: false, drilldown: true },
      { sort: '2026-01', date: 'Jan 2026', branch: 'spacex-ops', id: 'starlink-v3', title: 'Starlink V3 satellites deployed', approx: true, drilldown: true },
    ],
    'x-corp': [
      { sort: '2022-04', date: 'Apr 2022', branch: 'x-corp', id: 'poison-pill', title: 'Twitter poison pill adopted', approx: false, drilldown: true },
      { sort: '2022-07', date: 'Jul 2022', branch: 'x-corp', id: 'terminate-suit', title: 'Termination suit · Delaware Chancery', approx: false, drilldown: true },
      { sort: '2023-07', date: 'Jul 2023', branch: 'x-corp', id: 'x-payments', title: 'X Payments LLC incorporated', approx: true, drilldown: true },
      { sort: '2024-08', date: 'Aug 2024', branch: 'x-corp', id: 'grok-on-x', title: 'Grok embedded in X app globally', approx: false, drilldown: true },
      { sort: '2025-01', date: 'Jan 2025', branch: 'x-corp', id: 'x-tv', title: 'X TV streaming beta', approx: true, drilldown: true },
      { sort: '2026-04', date: 'Apr 2026', branch: 'x-corp', id: 'wealthsimple-pilot', title: 'Wealthsimple one-tap trade · Canada pilot', approx: false, drilldown: true },
      { sort: '2026-04', date: 'Apr 2026', branch: 'x-corp', id: 'cashtags-onchain', title: 'Cashtags · Solana / Base contract lookup', approx: false, drilldown: true },
    ],
    neuralink: [
      { sort: '2019-07', date: 'Jul 2019', branch: 'neuralink', id: 'n1-chip', title: 'N1 chip unveiled · pig demo', approx: false, drilldown: true },
      { sort: '2021-04', date: 'Apr 2021', branch: 'neuralink', id: 'monkey-pong', title: 'Pager monkey plays Pong', approx: false, drilldown: true },
      { sort: '2023-05', date: 'May 2023', branch: 'neuralink', id: 'fda-ide', title: 'FDA IDE for PRIME study', approx: false, drilldown: true },
      { sort: '2024-05', date: 'May 2024', branch: 'neuralink', id: 'second-patient', title: 'Second PRIME participant implanted', approx: false, drilldown: true },
      { sort: '2025-11', date: 'Nov 2025', branch: 'neuralink', id: 'telepathy-trial', title: 'Telepathy trial · 10-site expansion', approx: true, drilldown: true },
    ],
    boring: [
      { sort: '2018-05', date: 'May 2018', branch: 'boring', id: 'la-demo', title: 'LA demo tunnel concept', approx: false, drilldown: true },
      { sort: '2020-05', date: 'May 2020', branch: 'boring', id: 'lvcc-phase1', title: 'LVCC Loop Phase 1 opens', approx: false, drilldown: true },
      { sort: '2023-11', date: 'Nov 2023', branch: 'boring', id: 'vegas-expansion', title: 'Vegas Loop expansion approved', approx: false, drilldown: true },
      { sort: '2025-08', date: 'Aug 2025', branch: 'boring', id: 'prufrock-v4', title: 'Prufrock V4 TBM deployed', approx: true, drilldown: true },
    ],
    openai: [
      { sort: '2015-12', date: 'Dec 2015', branch: 'openai', id: 'nonprofit-launch', title: 'OpenAI nonprofit launched', approx: false, drilldown: true },
      { sort: '2018-06', date: 'Jun 2018', branch: 'openai', id: 'dota-5v5', title: 'OpenAI Five beats pro Dota team', approx: false, drilldown: true },
      { sort: '2019-02', date: 'Feb 2019', branch: 'openai', id: 'gpt-2-cautious', title: 'GPT-2 staged release', approx: false, drilldown: true },
      { sort: '2020-06', date: 'Jun 2020', branch: 'openai', id: 'gpt-3-api', title: 'GPT-3 API private beta', approx: false, drilldown: true },
    ],
  };

  /** Rich hover / tap detail copy keyed by event id — public facts only. */
  const TIMELINE_EVENT_DETAILS = {
    /* —— grok drill-down —— */
    'team-assembled': {
      detail: 'xAI incorporated July 2023 in Nevada. Founding team drew from DeepMind, OpenAI, Google Research, Tesla Autopilot, and Microsoft — positioned as a “maximum truth-seeking” counterweight to closed labs.',
      source: 'https://x.ai/about',
    },
    'grok-api': {
      detail: 'Developer API beta opened for programmatic Grok access — chat completions, tool routing, and early function-calling hooks for X embeds and third-party apps.',
      source: 'https://docs.x.ai',
    },
    'grok-vision': {
      detail: 'Multimodal vision shipped in Grok chat: image upload, chart/diagram QA, and screenshot reasoning alongside text — first broad consumer vision tier on X.',
    },
    'grok-studio': {
      detail: 'Grok Studio workspace preview: shared prompt libraries, eval sets, and run history for teams ahead of SuperGrok / enterprise tiers.',
    },
    'grok-voice': {
      detail: 'Grok Voice on iOS and Android — continuous speech input, spoken replies, and hands-free mode integrated into the X app Grok tab.',
    },
    'grok-code': {
      detail: 'Grok Code IDE beta: repo-aware edits, inline diff preview, and shell command suggestions — precursor to Grok Build CLI (May 2026).',
    },
    'supergrok-tier': {
      detail: 'SuperGrok subscription bundles Imagine video generation, higher rate limits, and priority Grok 4.x access on X — paywall for Imagine rolled Mar 2026.',
    },
    'alpha-arena-s1-board': {
      detail: 'Nof1 Alpha Arena Season 1 (Oct 18 – Nov 3 2025): six frontier LLMs each traded $10,000 in crypto perpetuals on Hyperliquid with zero human intervention. Field: Grok 4, Qwen 3 Max, DeepSeek V3.1, GPT-5, Gemini 2.5 Pro, Claude Sonnet 4.5. Winner Qwen +22.3% ($12,232); DeepSeek +4.9%. Grok 4 finished fifth at roughly −45% ($5,470 final equity per public leaderboard).',
      source: 'https://nof1.ai/',
    },
    'alpha-arena-s15-modes': {
      detail: 'Season 1.5 (from Nov 19 2025) moved to US equities — TSLA, NVDA, MSFT, AMZN, NDX — with eight models and four parallel modes: New Baseline (news + market data), Monk Mode (capital preservation), Situational Awareness (tracks peer rankings), Max Leverage (mandatory high leverage). Each model received $10,000 per mode ($320,000 total capital).',
      source: 'https://nof1.ai/',
    },
    'alpha-arena-s15-board': {
      detail: 'Season 1.5 ended Dec 3 2025 5pm EST. Mystery Model (Grok 4.20) won with +12.11% aggregate return (~$4,844 profit) — profitable in all four modes. GPT-5.1 second, Gemini 3 third. Crypto-season winner Qwen 3 Max struggled on US equities. Elon Musk and Nof1 confirmed Grok 4.20 as Mystery Model.',
      source: 'https://nof1.ai/',
    },
    'rallies-arena-board': {
      detail: 'Rallies.ai AI Arena (~Nov 27 2025 onward): eight models each manage $100,000 in US equities with public trade logs. Mid-Jan 2026 snapshot: Grok 4 ~+8.2% ($108,891), DeepSeek V3 ~+5.8%, GPT-5.1 ~+3.9%, Claude Sonnet 4.5 ~+1.7%, Gemini 2.5 Pro ~+0.7%, Qwen 3 ~−21.3%. Grok cited concentrated CRM/MU positions vs diversified peers; S&P 500 ~+3% same window.',
      source: 'https://rallies.ai/arena',
    },
    /* —— colossus drill-down —— */
    'memphis-permit': {
      detail: 'Shelby County industrial permits filed for xAI’s South Memphis campus (former Electrolux footprint). Early site work preceded the Jun 2024 public Colossus announcement.',
    },
    'h100-rack': {
      detail: 'First NVIDIA H100 racks energized at Colossus Memphis — NVLink clusters, early direct-to-chip cooling trials before the 122-day full build sprint.',
    },
    'liquid-cooling': {
      detail: 'Facility-wide liquid cooling loop commissioned to sustain >700 W/GPU thermal density — prerequisite for 100K+ H100 scale in a single building.',
    },
    '50k-gpus': {
      detail: 'Roughly 50,000 GPUs operational — midpoint between Aug 2024 go-live and the Feb 2025 200K expansion announced alongside Grok 3.',
    },
    'b200-order': {
      detail: 'Expansion POs for NVIDIA B200 / GB200 NVL racks to extend Colossus beyond Hopper — mixed-precision training for Grok 4.x and Imagine workloads.',
    },
    'grid-interconnect': {
      detail: '≈1 GW utility interconnect approved with Memphis-area providers — power envelope cited for Colossus 2 and downstream Terafab load.',
    },
    'colossus-2-pour': {
      detail: 'Foundation pour at Colossus 2 Grimes County TX site — ~1M sq ft shell adjacent to Terafab corridor; permit filings referenced $659M phase scope.',
    },
    /* —— terrafab drill-down —— */
    'austin-proto': {
      detail: 'Austin prototype packaging line announced Mar 21 2026 — Terafab’s first visible fab-adjacent module before Grimes County mega-site selection.',
    },
    '18a-pilot': {
      detail: 'Intel 18A foundry pilot wafers scheduled for Terafab Austin proto — advanced node packaging co-developed with Intel Foundry Services.',
      source: 'https://www.intel.com/content/www/us/en/foundry/overview.html',
    },
    'grimes-site': {
      detail: 'Grimes County TX selected for primary Terafab campus — co-located with Colossus 2 power corridor; tax abatement hearings followed Jun 2026.',
    },
    'phase-1-cap': {
      detail: 'Phase 1 target: ~20K wafers/month advanced packaging — S-1 and local filings bracketed $55B–$119B multi-phase fab investment.',
    },
    /* —— spacex IPO drill-down —— */
    'xai-board': {
      detail: 'Post-merge board restructure: xAI leadership retained product autonomy while SpaceX consolidated AI capex, Colossus leases, and Grok distribution under one cap table.',
    },
    'bank-syndicate': {
      detail: 'IPO bank syndicate formed (Goldman, Morgan Stanley, BofA cited in roadshow materials) — dual-track confidential filing Apr 2026 ahead of public S-1.',
      source: 'https://www.sec.gov/cgi-bin/browse-edgar?company=SpaceX&CIK=&type=S-1',
    },
    's-1-amend': {
      detail: 'S-1/A amendment filed May 2026 with revenue breakout: launch services, Starlink, and xAI/Colossus AI infrastructure as separate segments.',
      source: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=S-1',
    },
    'retail-allocation': {
      detail: 'Retail allocation in hybrid direct-listing structure — Robinhood and other brokers offered primary shares at $135 alongside institutional book.',
    },
    'lockup-terms': {
      detail: '180-day insider lockup disclosed for executives and early investors; Elon Musk subject to extended holding requirements per S-1 risk factors.',
    },
    /* —— tesla drill-down —— */
    'model-s-deliver': {
      detail: 'Model S customer deliveries began Jun 2012 — first mass-market EV from Tesla after Roadster, validating Fremont production lines.',
      source: 'https://ir.tesla.com',
    },
    'model-3-ramp': {
      detail: 'Model 3 production ramp Jul 2017 — “production hell” quarter; run-rate later exceeded 5K/week, driving TSLA toward sustained profitability.',
    },
    'sp500-inclusion': {
      detail: 'Tesla added to S&P 500 Dec 2020 — largest index addition by market cap at the time; passive fund flows amplified the 2020–21 TSLA rally.',
    },
    'master-plan-3': {
      detail: 'Master Plan Part 3 published Mar 2023 — explicit path to 240 TWh storage, 30 TW renewable, and electrified transport + heat.',
    },
    'cybercab-reveal': {
      detail: 'Cybercab and Robovan revealed Oct 2024 We, Robot event — no steering wheel, inductive charging, target <$30K consumer autonomy platform.',
    },
    'optimus-gen2': {
      detail: 'Optimus Gen 2 factory trials Jun 2025 — 22-DoF hands, tether-free walking on Giga Texas lines; precursor to Cybercab unmanned production.',
    },
    /* —— spacex-ops drill-down —— */
    'crew-demo': {
      detail: 'Crew Dragon Demo-2 (May 2020) — first NASA astronauts launched from US soil since Shuttle; Bob Behnken and Doug Hurley to ISS.',
      source: 'https://www.spacex.com/launches',
    },
    'inspiration4': {
      detail: 'Inspiration4 (Sep 2021) — first all-civilian orbital mission, 3-day Crew Dragon flight funded by Jared Isaacman; raised $240M for St. Jude.',
    },
    'starship-ift1-boom': {
      detail: 'Starship IFT-1 (Apr 2023) — cleared pad but lost vehicle during ascent; max-Q structural failure led to rapid unplanned disassembly over Gulf.',
    },
    'ift3-success': {
      detail: 'IFT-3 (Mar 2024) — full ascent profile, payload door demo, and controlled reentry over Indian Ocean; major step toward ship catch.',
    },
    'ift10-catch': {
      detail: 'IFT-10 (Mar 2025) — Mechazilla booster catch attempt; chopstick arms closed on Super Heavy but release timing still being tuned.',
    },
    'starlink-v3': {
      detail: 'Starlink V3 sats deployed Jan 2026 — larger aperture, direct-to-cell payload, supporting >10M subscribers cited Feb 2026.',
    },
    /* —— x-corp drill-down —— */
    'poison-pill': {
      detail: 'Twitter board adopted poison pill Apr 2022 after Musk’s $54.20/share bid — limited hostile accumulation above 15% without board approval.',
    },
    'terminate-suit': {
      detail: 'Delaware Chancery termination suit Jul 2022 — Musk sought to exit $44B deal citing bot counts; settled with completion Oct 2022.',
    },
    'x-payments': {
      detail: 'X Payments LLC incorporated Jul 2023 — money-transmitter licenses pursued in multiple US states for creator payouts and P2P.',
    },
    'grok-on-x': {
      detail: 'Grok embedded globally in X app Aug 2024 — sidebar chat, post compose assist, and Premium+ default model routing.',
    },
    'x-tv': {
      detail: 'X TV streaming beta Jan 2025 — long-form video hub competing with YouTube/TikTok; Grok summaries on trending clips.',
    },
    'wealthsimple-pilot': {
      detail: 'Wealthsimple brokerage pilot Apr 2026 — Canadian users tap a Cashtag to open a pre-filled order on Wealthsimple (one-tap from timeline conversation to trade entry). X is not a broker; routes to partner execution.',
      source: 'https://thedefiant.io/news/tradfi-and-fintech/x-rolls-out-cashtags-with-price-charts-pilots-in-app-trading-via-wealthsimple',
    },
    'cashtags-onchain': {
      detail: 'Cashtags support major equities, crypto tickers, and on-chain tokens via contract addresses on Solana and Base — extending prior TradingView (2022) and eToro (2023) cashtag integrations with live in-app charts.',
      source: 'https://thedefiant.io/news/tradfi-and-fintech/x-rolls-out-cashtags-with-price-charts-pilots-in-app-trading-via-wealthsimple',
    },
    /* —— neuralink drill-down —— */
    'n1-chip': {
      detail: 'N1 implant unveiled Jul 2019 — 1,024 electrodes, pig demo on stage; coin-sized skull-mounted processor with wireless telemetry.',
      source: 'https://neuralink.com',
    },
    'monkey-pong': {
      detail: 'Pager monkey played Pong Apr 2021 — decoded motor cortex signals via N1 Link; demonstrated closed-loop BCI gaming without physical controller.',
    },
    'fda-ide': {
      detail: 'FDA IDE approved for PRIME study May 2023 — investigational device exemption for fully implantable BCI in quadriplegia patients.',
      source: 'https://www.fda.gov',
    },
    'second-patient': {
      detail: 'Second PRIME participant implanted May 2024 — Alex, ALS patient; cursor control and speech-decoding trials expanded beyond first patient Noland.',
    },
    'telepathy-trial': {
      detail: 'Telepathy trial expanded to 10 clinical sites Nov 2025 — targets thought-to-text at >20 WPM; high-volume production flagged for 2026.',
    },
    /* —— boring drill-down —— */
    'la-demo': {
      detail: 'LA demo tunnel concept May 2018 — 1.14-mile Hawthorne test track, top speed 127 mph in Tesla transport sled trials.',
    },
    'lvcc-phase1': {
      detail: 'LVCC Loop Phase 1 opened May 2020 — 0.8-mile Convention Center loop, Tesla shuttles at ~35 mph for CES crowds.',
    },
    'vegas-expansion': {
      detail: 'Vegas Loop expansion approved Nov 2023 — tunnels toward Encore, Westgate, and future airport connector; 68-mile master plan.',
    },
    'prufrock-v4': {
      detail: 'Prufrock V4 TBM deployed Aug 2025 — all-electric boring machine, ~1 mile/week target, reduced surface disruption vs traditional TBMs.',
    },
    /* —— openai drill-down —— */
    'nonprofit-launch': {
      detail: 'OpenAI nonprofit launched Dec 2015 — $1B pledge from Musk, Altman, Brockman; mission stated as safe AGI for humanity.',
      source: 'https://openai.com/about',
    },
    'dota-5v5': {
      detail: 'OpenAI Five defeated OG pro Dota 2 team Jun 2018 — 5v5 with 20K training years; showcased large-scale RL on GPUs.',
    },
    'gpt-2-cautious': {
      detail: 'GPT-2 staged release Feb 2019 — 1.5B params withheld initially over misuse concerns; sparked industry debate on responsible disclosure.',
    },
    'gpt-3-api': {
      detail: 'GPT-3 API private beta Jun 2020 — 175B-parameter davinci model; first commercial LLM API at scale before ChatGPT.',
    },
    /* —— cluster base milestones —— */
    'xai-founded': {
      detail: 'xAI Corp announced Jul 12 2023 — Elon Musk, independent of X Corp initially; mission statement emphasized understanding the universe.',
      source: 'https://x.ai',
    },
    'grok-1': {
      detail: 'Grok-1 MoE: 314B total params, 86B active per token — trained on Colossus predecessor cluster; humor-oriented system prompt on X.',
      source: 'https://github.com/xai-org/grok-1',
    },
    'series-b': {
      detail: '$6B Series B May 2024 — Valor, a16z, Sequoia, Fidelity among investors; proceeds earmarked for Colossus GPU build-out.',
    },
    'colossus-announce': {
      detail: 'Colossus announced Jun 5 2024 — public 100K H100 target, Memphis TN site; described as world’s largest AI training cluster at announcement.',
    },
    'colossus-live': {
      detail: 'Colossus went live Aug 2024 — 122 days from bare slab to training Grok-2; xAI cited fastest supercomputer stand-up in industry.',
    },
    '100k-gpus': {
      detail: '≈100,000 GPUs operational Dec 2024 — NVIDIA H100 fleet; power draw estimated in hundreds of MW at full utilization.',
    },
    'scale-200k': {
      detail: 'Scaled to 200K GPUs in 92 days (Feb 2025) — announced alongside Grok 3; mixed H100/B200 generations in same fabric.',
    },
    'colossus-2': {
      detail: 'Colossus 2 site Mar 2025 — ~1M sq ft Grimes County TX; paired with Terafab for chip packaging and on-site power.',
    },
    'colossus-2-gw': {
      detail: 'Colossus 2 ~1 GW online Jan 2026 — utility-scale power envelope; supports 555K GPU roadmap cited in permit filings.',
    },
    '555k-target': {
      detail: '555K GPU target Mar 2026 — Shelby/Grimes permit bundle referenced $659M infrastructure phase; largest disclosed AI cluster roadmap.',
    },
    'grok-4': {
      detail: 'Grok 4 Jul 2025 — multi-agent orchestration, improved math/code benchmarks; trained on expanded Colossus 200K fleet.',
    },
    'alpha-arena-s1': {
      detail: 'Nof1 Alpha Arena Season 1 launched Oct 18 2025 — first live benchmark where frontier LLMs trade real capital on Hyperliquid crypto perpetuals ($10K each, identical prompts, public reasoning traces). Goal: measure autonomous alpha generation vs static evals.',
      source: 'https://nof1.ai/blog/TechPost1',
    },
    'alpha-arena-s1-end': {
      detail: 'Season 1 concluded Nov 3 2025. Qwen 3 Max +22.3%, DeepSeek +4.9%; four US models lost money. Grok 4 ~−45% (high leverage, long holds) — fifth of six. Highlighted gap between crypto volatility skills (China models) and US frontier LLMs in adversarial markets.',
      source: 'https://www.gncrypto.news/news/qwen-wins-alpha-arena-season-1-with-22-percent-returns/',
    },
    'alpha-arena-s15': {
      detail: 'Alpha Arena Season 1.5 opened Nov 19 2025 on US stocks — sequel after crypto season. Eight models (added Kimi K2, Grok 4.20) trade TSLA, NVDA, MSFT, AMZN, NDX with four parallel competition modes and $10K capital per mode.',
      source: 'https://www.weex.com/news/detail/ai-crypto-trading-competition-sequel-strikes-back-switching-to-the-us-stock-market-arena-can-the-american-model-turn-the-tide-234409',
    },
    'alpha-arena-s15-win': {
      detail: 'Grok 4.20 (Mystery Model) won Season 1.5 with +12.11% aggregate over two weeks (~$4,844 profit) — only entrant profitable across all four modes. Beat GPT-5.1 and Gemini 3; Qwen (crypto winner) fell to sixth. Competition ended Dec 3 2025.',
      source: 'https://www.gncrypto.news/news/mystery-model-alpha-arena-season-1-5-winner/',
    },
    'rallies-arena-start': {
      detail: 'Rallies.ai AI Arena opened ~Nov 27 2025 — open financial benchmark where eight LLMs (Grok 4, GPT-5.x, Claude, Gemini, DeepSeek, Qwen, etc.) each received $100,000 to trade US equities autonomously with published trade logic.',
      source: 'https://rallies.ai/arena',
    },
    'rallies-arena-lead': {
      detail: 'Jan 2026 Rallies leaderboard: Grok 4 leading ~+8.2% (~$8,891 profit on $100K) vs S&P 500 ~+3% same period. DeepSeek ~+5.8%, GPT-5.1 ~+3.9%; Qwen 3 down ~−21%. Grok used concentrated CRM/MU/QCOM themes around AI infrastructure momentum.',
      source: 'https://paretoinvestor.substack.com/p/grok-is-crushing-the-s-and-p-500',
    },
    'cashtags-preview': {
      detail: 'Nikita Bier unveiled Cashtags Jan 2026 — dollar-sign tickers and contract addresses surface live price charts plus asset-specific posts inside X, positioning the timeline as a real-time financial data layer.',
      source: 'https://finance.yahoo.com/markets/stocks/articles/elon-musks-x-launches-cashtags-150207451.html',
    },
    'cashtags-launch': {
      detail: 'Cashtags shipped Apr 14 2026 on iPhone for US and Canada — tap $TSLA, $BTC, or paste a token contract to open charts and related posts without leaving X. Wealthsimple trading button pilot for Canadian users.',
      source: 'https://thedefiant.io/news/tradfi-and-fintech/x-rolls-out-cashtags-with-price-charts-pilots-in-app-trading-via-wealthsimple',
    },
    'cashtags-web': {
      detail: 'Cashtags expanded to web Apr 30 2026 — desktop traders get the same real-time chart + sentiment view previously mobile-only. Reports cited ~$1B trading volume in first two days of iPhone launch week.',
      source: 'https://startupfortune.com/x-just-brought-the-trading-terminal-into-your-social-feed/',
    },
    'xai-merge': {
      detail: 'SpaceX acquires xAI Feb 2026 — reported ~$1.25T combined valuation pre-IPO; merges Grok, Colossus, and launch ops under SPCX.',
    },
    'terrafab-launch': {
      detail: 'Terafab announced Mar 21 2026 Austin proto — advanced packaging fab aligned with SpaceX/xAI vertical integration post-merger.',
    },
    'intel-joins': {
      detail: 'Intel joins Terafab Apr 7 2026 — 18A foundry node for pilot wafers; Supermicro named for rack/liquid-cooling infra Apr 2026.',
      source: 'https://www.intel.com/content/www/us/en/foundry/overview.html',
    },
    '55b-filing': {
      detail: '$55B Terafab phase disclosed May 2026 SEC filings — upper bound $119B multi-decade; Grimes County abatement tied to job targets.',
    },
    's-1-public': {
      detail: 'Public S-1 filed May 20 2026 — first detailed Starlink revenue, Starship capex, and xAI/Colossus segment breakdown.',
      source: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=S-1',
    },
    'ipo-price': {
      detail: '$135 offer price · $1.77T market cap · ~$75B primary raise — largest US IPO by proceeds; SPCX ticker reserved on Nasdaq + Texas exchange.',
    },
    'ipo-priced': {
      detail: 'IPO priced Jun 11 2026 — 555.6M shares at $135; greenshoe option ~83M shares; institutional book >10× covered per roadshow leaks.',
    },
    'spcx-trade': {
      detail: 'SPCX lists Jun 12 2026 — dual listing Nasdaq + Texas; day-one volume exceeded $12B; MSCI World inclusion effective T+1 Jun 13.',
    },
    'anthropic-lease': {
      detail: 'Anthropic leases Colossus 1 capacity May 2026 — third-party training hours on xAI Memphis cluster post-IPO capital raise.',
    },
    /* —— portfolio base milestones —— */
    'first-implant': {
      detail: 'First human N1 implant Jan 2024 — Noland Arbaugh, quadriplegic; cursor control on laptop within weeks; PRIME study participant #1.',
      source: 'https://neuralink.com/blog',
    },
    '21-patients': {
      detail: '21 PRIME / Telepathy patients globally Jan 2026 — US, Canada, UK sites; speech-decoding trials exceed 15 WPM in subset of cohort.',
    },
    'series-e': {
      detail: '$650M Series E Jun 2025 — ~$9B valuation; Founders Fund, Sequoia; funds high-volume N1 production line for 2026.',
    },
    'tsla-ath-498': {
      detail: 'TSLA all-time high $498.83 Dec 22 2025 — post-election autonomy premium; market cap briefly exceeded $1.5T intraday.',
      source: 'https://ir.tesla.com',
    },
    'tsla-snapshot': {
      detail: 'TSLA ~$394 Jun 11 2026 — rotation into SPCX IPO week; investors rebalanced Mag7 exposure ahead of $75B SpaceX raise.',
    },
    'xai-acquires-x': {
      detail: 'xAI acquires X Corp Mar 28 2025 — all-stock deal valuing X at ~$80B; Grok becomes default social graph for training data.',
    },
    'starship-v3': {
      detail: 'Starship V3 Flight 12 May 22 2026 — first Pad 2 launch Boca Chica; ship catch attempted; payload capacity target 100+ tons LEO.',
    },
  };

  const TIMELINE_SECTIONS = [
    {
      id: 'cluster',
      label: 'Colossus · Terrafab · Grok · IPO',
      shortLabel: 'IPO cluster',
      heading: 'Colossus · Terrafab · Grok · SpaceX IPO',
      lead: 'xAI cluster and IPO roadshow — four-lane gitgraph. Select a company pill to expand vertical drill-down milestones.',
      branches: TIMELINE_CLUSTER_BRANCHES,
      events: TIMELINE_CLUSTER_EVENTS,
      gitgraphId: 'gitgraph-cluster',
      legendId: 'timeline-legend',
      drilldownId: 'timeline-drilldown-cluster',
      activityGroupId: 'cluster',
    },
    {
      id: 'portfolio',
      label: 'Elon portfolio · ventures',
      shortLabel: 'Portfolio',
      heading: 'Elon portfolio · ventures',
      lead: 'Tesla, SpaceX operations, X Corp, Neuralink, Boring Company, and OpenAI — six lanes through June 2026. Drill into one company for full vertical history.',
      branches: TIMELINE_PORTFOLIO_BRANCHES,
      events: TIMELINE_PORTFOLIO_EVENTS,
      gitgraphId: 'gitgraph-portfolio',
      legendId: 'timeline-legend-portfolio',
      drilldownId: 'timeline-drilldown-portfolio',
      activityGroupId: 'portfolio',
    },
  ];

  const timelineState = {
    tabIndex: 0,
    branchFocus: { cluster: 'all', portfolio: 'all' },
  };

  /** Prevents activity ↔ timeline sync feedback during timeline-driven updates. */
  let timelineSyncLock = false;
  /** Activity panels only drive timeline after boot completes. */
  let activitySyncEnabled = false;

  function mergeBranchEvents(baseEvents, branchId) {
    const drill = TIMELINE_DRILLDOWN_EVENTS[branchId] || [];
    const merged = [...baseEvents.filter((e) => e.branch === branchId), ...drill];
    return merged.map(enrichEventWithDetail).sort((a, b) => a.sort.localeCompare(b.sort) || a.id.localeCompare(b.id));
  }

  function enrichEventWithDetail(ev) {
    const extra = TIMELINE_EVENT_DETAILS[ev.id];
    if (!extra) return ev;
    return {
      ...ev,
      detail: ev.detail || extra.detail,
      source: ev.source || extra.source,
    };
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDetailTrigger(ev, accentColor, variant) {
    const tooltipId = `detail-${ev.id}`;
    const label = variant === 'info' ? 'info' : 'detail';
    const triggerCls = variant === 'info'
      ? 'detail-tooltip-trigger is-info'
      : 'detail-tooltip-trigger';
    const sourceLink = ev.source
      ? `<a class="detail-tooltip-source" href="${escapeHtml(ev.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`
      : '';
    const approxSuffix = ev.approx ? ' ~' : '';

    return `<span class="detail-tooltip-wrap" style="--detail-accent:${accentColor}">
      <button type="button" class="${triggerCls}" aria-expanded="false" aria-controls="${tooltipId}-inline">${label}</button>
      <span class="detail-tooltip" id="${tooltipId}" role="tooltip">
        <span class="detail-tooltip-accent" aria-hidden="true"></span>
        <strong class="detail-tooltip-title">${escapeHtml(ev.title)}</strong>
        <time class="detail-tooltip-date">${escapeHtml(ev.date)}${approxSuffix}</time>
        <p class="detail-tooltip-body">${escapeHtml(ev.detail)}</p>
        ${sourceLink}
      </span>
    </span>`;
  }

  function renderDetailInlinePanel(ev, accentColor) {
    const panelId = `detail-${ev.id}-inline`;
    const sourceLink = ev.source
      ? `<a class="detail-tooltip-source" href="${escapeHtml(ev.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`
      : '';
    return `<div class="detail-inline-panel" id="${panelId}" style="--detail-accent:${accentColor}" hidden>
      <p class="detail-inline-body">${escapeHtml(ev.detail)}</p>
      ${sourceLink}
    </div>`;
  }

  function initDrilldownDetailInteractions(container) {
    if (!container) return;
    container.querySelectorAll('.detail-tooltip-trigger').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = btn.closest('.timeline-drilldown-item');
        if (!item) return;
        const willExpand = !item.classList.contains('is-detail-expanded');
        container.querySelectorAll('.timeline-drilldown-item.is-detail-expanded').forEach((openItem) => {
          openItem.classList.remove('is-detail-expanded');
          openItem.querySelector('.detail-tooltip-trigger')?.setAttribute('aria-expanded', 'false');
          openItem.querySelector('.detail-inline-panel')?.setAttribute('hidden', '');
        });
        if (willExpand) {
          item.classList.add('is-detail-expanded');
          btn.setAttribute('aria-expanded', 'true');
          item.querySelector('.detail-inline-panel')?.removeAttribute('hidden');
        }
      });
    });
  }

  function renderDrilldownList(events, branchId, container, accentColor) {
    if (!container) return;
    const color = accentColor || getBranchCssColor(branchId);
    container.hidden = false;
    container.innerHTML = `
      <header class="timeline-drilldown-header">
        <span class="timeline-drilldown-swatch" style="background:${color}"></span>
        <h3 class="timeline-drilldown-title">${branchId} · expanded timeline</h3>
        <span class="timeline-drilldown-count">${events.length} milestones</span>
      </header>
      <ol class="timeline-drilldown-list">
        ${events.map((ev) => {
          const approx = ev.approx ? ' <span class="activity-event-approx">~</span>' : '';
          const hasDetail = Boolean(ev.detail);
          let tag = '';
          if (ev.drilldown) {
            tag = hasDetail
              ? renderDetailTrigger(ev, color, 'tag')
              : ' <span class="timeline-drilldown-tag">detail</span>';
          } else if (hasDetail) {
            tag = renderDetailTrigger(ev, color, 'info');
          }
          const mergeCls = ev.merge ? ' is-merge' : '';
          const detailCls = hasDetail ? ' has-detail' : '';
          const inlinePanel = hasDetail ? renderDetailInlinePanel(ev, color) : '';
          return `<li class="timeline-drilldown-item${mergeCls}${detailCls}">
            <span class="timeline-drilldown-dot branch-${ev.branch}"></span>
            <div class="timeline-drilldown-body">
              <time class="timeline-drilldown-date">${ev.date}</time>
              <span class="timeline-drilldown-id">${ev.id}</span>${approx}${tag}
              <p class="timeline-drilldown-desc">${ev.title}</p>
              ${inlinePanel}
            </div>
          </li>`;
        }).join('')}
      </ol>`;
    initDrilldownDetailInteractions(container);
  }

  function renderTimelineGitgraph({ branches, events, containerId, legendId, singleBranch, branchColorMap = {} }) {
    const container = document.getElementById(containerId);
    const legendEl = legendId ? document.getElementById(legendId) : null;
    if (!container) return;

    const colorFor = (branchId) => branchColorMap[branchId] || getBranchCssColor(branchId);

    const activeBranches = singleBranch
      ? branches.filter((b) => b.id === singleBranch)
      : branches;
    const branchCol = Object.fromEntries(activeBranches.map((b, i) => [b.id, i]));
    const laneCount = activeBranches.length;

    container.dataset.lanes = String(laneCount);
    container.classList.toggle('gitgraph-single', laneCount === 1);

    if (legendEl) {
      legendEl.hidden = laneCount === 1;
      legendEl.innerHTML = activeBranches.map((b) =>
        `<span class="legend-item"><span class="legend-swatch" style="background:${colorFor(b.id)}"></span>${b.label}</span>`
      ).join('');
    }

    const visibleEvents = events.filter((ev) => branchCol[ev.branch] !== undefined);

    const rows = new Map();
    visibleEvents.forEach((ev) => {
      if (!rows.has(ev.sort)) rows.set(ev.sort, { sort: ev.sort, date: ev.date, events: [] });
      rows.get(ev.sort).events.push(ev);
    });

    const sortedRows = [...rows.values()].sort((a, b) => a.sort.localeCompare(b.sort));

    const inner = document.createElement('div');
    inner.className = 'gitgraph-inner';

    if (!sortedRows.length) {
      container.innerHTML = '<p class="forbes-empty">No milestones yet for this profile.</p>';
      return;
    }

    sortedRows.forEach((row, rowIdx) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'gitgraph-row';
      rowEl.dataset.row = String(rowIdx);

      const dateEl = document.createElement('div');
      dateEl.className = 'gitgraph-date';
      dateEl.textContent = row.date;

      const track = document.createElement('div');
      track.className = 'gitgraph-track';
      track.style.setProperty('--timeline-lanes', String(laneCount));

      const lanes = activeBranches.map((branch) => {
        const lane = document.createElement('div');
        lane.className = 'gitgraph-lane';
        lane.dataset.branch = branch.id;
        return lane;
      });

      row.events.forEach((ev) => {
        const col = branchCol[ev.branch] ?? 0;
        const lane = lanes[col];
        if (!lane) return;

        const node = document.createElement('div');
        node.className = 'gitgraph-node';
        node.dataset.branch = ev.branch;

        const dot = document.createElement('div');
        dot.className = `gitgraph-dot branch-${ev.branch}${ev.merge ? ' is-merge' : ''}`;
        const laneColor = colorFor(ev.branch);
        if (laneColor) dot.style.background = laneColor;
        if (ev.merge) dot.style.color = laneColor || activeBranches.find((b) => b.id === ev.branch)?.color || '#525252';

        const label = document.createElement('div');
        label.className = 'gitgraph-label';
        const approxTag = ev.approx ? ' <span style="color:var(--text-muted)">~</span>' : '';
        label.innerHTML = `<strong>${ev.id}</strong>${approxTag} ${ev.title}`;

        node.appendChild(dot);
        node.appendChild(label);
        lane.appendChild(node);
      });

      lanes.forEach((lane) => track.appendChild(lane));
      rowEl.appendChild(dateEl);
      rowEl.appendChild(track);
      inner.appendChild(rowEl);
    });

    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'gitgraph-connectors gitgraph-connectors-overlay');

    container.innerHTML = '';
    container.appendChild(inner);
    container.appendChild(overlay);

    requestAnimationFrame(() => {
      const branchPrev = {};
      const containerRect = container.getBoundingClientRect();
      overlay.setAttribute('width', String(container.clientWidth));
      overlay.setAttribute('height', String(container.clientHeight));
      overlay.style.width = `${container.clientWidth}px`;
      overlay.style.height = `${container.clientHeight}px`;

      inner.querySelectorAll('.gitgraph-node').forEach((nodeEl) => {
        const branch = nodeEl.dataset.branch;
        const dot = nodeEl.querySelector('.gitgraph-dot');
        const dotRect = dot.getBoundingClientRect();
        const x = dotRect.left - containerRect.left + dotRect.width / 2;
        const y = dotRect.top - containerRect.top + dotRect.height / 2;

        if (branch && branchPrev[branch]) {
          const prev = branchPrev[branch];
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', `branch-${branch}`);
          const midY = (prev.y + y) / 2;
          path.setAttribute('d', `M ${prev.x} ${prev.y} C ${prev.x} ${midY}, ${x} ${midY}, ${x} ${y}`);
          overlay.appendChild(path);
        }

        if (branch) branchPrev[branch] = { x, y };
      });
    });
  }

  function renderTimelineSection(section) {
    const branchFocus = timelineState.branchFocus[section.id];
    const drilldownEl = document.getElementById(section.drilldownId);
    const gitgraphEl = document.getElementById(section.gitgraphId);

    if (branchFocus === 'all') {
      if (drilldownEl) {
        drilldownEl.hidden = true;
        drilldownEl.innerHTML = '';
      }
      renderTimelineGitgraph({
        branches: section.branches,
        events: section.events,
        containerId: section.gitgraphId,
        legendId: section.legendId,
        singleBranch: null,
      });
      if (gitgraphEl) gitgraphEl.hidden = false;
    } else {
      const merged = mergeBranchEvents(section.events, branchFocus);
      renderTimelineGitgraph({
        branches: section.branches,
        events: merged,
        containerId: section.gitgraphId,
        legendId: section.legendId,
        singleBranch: branchFocus,
      });
      if (gitgraphEl) gitgraphEl.hidden = false;
      renderDrilldownList(merged, branchFocus, drilldownEl);
    }
  }

  function syncActivityGroupHighlight(sectionId) {
    document.querySelectorAll('.activity-group').forEach((groupEl) => {
      const isSynced = groupEl.dataset.group === sectionId;
      groupEl.classList.toggle('is-synced', isSynced);
    });
  }

  function syncActivityFromTimeline(sectionId, branchId) {
    const section = TIMELINE_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

    const groupEl = document.querySelector(`.activity-group[data-group="${section.activityGroupId}"]`);
    if (groupEl && !groupEl.open) groupEl.open = true;

    if (branchId && branchId !== 'all') {
      const branchEl = document.querySelector(`.activity-branch[data-branch="${branchId}"]`);
      if (branchEl && !branchEl.open) {
        branchEl.open = true;
        const chartEl = branchEl.querySelector('.activity-branch-chart');
        initBranchActivityChart(branchId, branchEventsFor(section.events, branchId), chartEl);
      }
    }
  }

  function updateHashWithoutScroll(hash) {
    if (typeof window.fwjUpdateHashWithoutScroll === 'function') {
      window.fwjUpdateHashWithoutScroll(hash);
      return;
    }
    const y = window.scrollY;
    const url = hash ? `${window.location.pathname}${window.location.search}${hash}` : `${window.location.pathname}${window.location.search}`;
    history.replaceState(null, '', url);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  function scrollToSectionElement(el, { behavior = 'smooth' } = {}) {
    if (!el) return;
    if (typeof window.fwjScrollToSection === 'function' && el.classList.contains('site-panel')) {
      window.fwjScrollToSection(el.id, { behavior });
      return;
    }
    const panelId = typeof window.fwjResolvePanelId === 'function' ? window.fwjResolvePanelId(el.id) : null;
    if (panelId && typeof window.fwjScrollToSection === 'function') {
      window.fwjScrollToSection(panelId, { behavior });
      if (el.id !== panelId) {
        requestAnimationFrame(() => el.scrollIntoView({ behavior, block: 'start' }));
      }
      return;
    }
    el.scrollIntoView({ behavior, block: 'start' });
  }

  function setTimelineTab(index, { syncActivity = true } = {}) {
    timelineSyncLock = true;
    const tabs = TIMELINE_SECTIONS;
    const clamped = Math.max(0, Math.min(tabs.length - 1, index));
    timelineState.tabIndex = clamped;
    const section = tabs[clamped];

    const heading = document.getElementById('timeline-heading');
    const lead = document.getElementById('timeline-lead');
    if (heading) heading.textContent = 'Milestones · portfolio · wealth';
    if (lead) {
      lead.textContent = 'IPO cluster and venture gitgraphs stacked with net-worth history — orange pins mark milestone years that overlap wealth moves.';
    }

    syncActivityGroupHighlight(section.activityGroupId);
    renderUnifiedVentureView(timelineProfileState || forbesProfiles.find((p) => p.rank === 1));
    document.getElementById(`timeline-block-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (syncActivity) {
      syncActivityFromTimeline(section.id, timelineState.branchFocus[section.id]);
    }

    const branch = timelineState.branchFocus[section.id];
    const hash = branch === 'all' ? `#timeline-${section.id}` : `#timeline-${section.id}-${branch}`;
    updateHashWithoutScroll(hash);
    timelineSyncLock = false;
  }

  function setTimelineBranch(sectionId, branchId, { syncActivity = true } = {}) {
    timelineSyncLock = true;
    timelineState.branchFocus[sectionId] = branchId;
    const section = TIMELINE_SECTIONS.find((s) => s.id === sectionId);
    if (!section) {
      timelineSyncLock = false;
      return;
    }

    const pillsRoot = document.querySelector(`.timeline-company-pills[data-group="${sectionId}"]`);
    if (pillsRoot) {
      pillsRoot.querySelectorAll('.timeline-company-pill').forEach((pill) => {
        const active = pill.dataset.branch === branchId;
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-selected', active ? 'true' : 'false');
        pill.tabIndex = active ? 0 : -1;
      });
    }

    renderTimelineSection(section);
    if (sectionId === 'cluster' || sectionId === 'portfolio') {
      const profile = timelineProfileState || forbesProfiles.find((p) => p.rank === 1);
      renderTimelineWealthChart('timeline-unified-wealth', profile, { includeVentureEvents: true });
    }
    if (syncActivity) {
      syncActivityFromTimeline(sectionId, branchId);
    }

    const hash = branchId === 'all' ? `#timeline-${sectionId}` : `#timeline-${sectionId}-${branchId}`;
    updateHashWithoutScroll(hash);
    timelineSyncLock = false;
  }

  function renderTimelineCompanyPills(section) {
    const root = document.querySelector(`.timeline-company-pills[data-group="${section.id}"]`);
    if (!root) return;

    const focus = timelineState.branchFocus[section.id];
    const allActive = focus === 'all';

    const pills = [
      `<button type="button" role="tab" class="timeline-company-pill${allActive ? ' active' : ''}" data-branch="all" aria-selected="${allActive}" tabindex="${allActive ? 0 : -1}">All lanes</button>`,
      ...section.branches.map((b) => {
        const active = focus === b.id;
        const color = getBranchCssColor(b.id);
        return `<button type="button" role="tab" class="timeline-company-pill${active ? ' active' : ''}" data-branch="${b.id}" aria-selected="${active}" tabindex="${active ? 0 : -1}" style="--pill-color:${color}">${b.label}</button>`;
      }),
    ].join('');

    root.innerHTML = pills;

    root.querySelectorAll('.timeline-company-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        setTimelineBranch(section.id, pill.dataset.branch);
      });
    });
  }

  function applyTimelineDeepLink(hashInput) {
    const hash = (hashInput || window.location.hash || '').slice(1);
    if (!hash.startsWith('timeline-')) return false;

    const rest = hash.slice('timeline-'.length);
    let sectionId = 'cluster';
    let branchId = 'all';

    if (rest.startsWith('portfolio')) {
      sectionId = 'portfolio';
      const suffix = rest.slice('portfolio'.length);
      branchId = suffix.startsWith('-') ? suffix.slice(1) : 'all';
    } else if (rest.startsWith('cluster')) {
      sectionId = 'cluster';
      const suffix = rest.slice('cluster'.length);
      branchId = suffix.startsWith('-') ? suffix.slice(1) : 'all';
    }

    const section = TIMELINE_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return false;

    const valid = branchId === 'all' || section.branches.some((b) => b.id === branchId);
    if (!valid) branchId = 'all';

    timelineState.branchFocus[sectionId] = branchId;
    TIMELINE_SECTIONS.forEach((s) => renderTimelineCompanyPills(s));
    setTimelineBranch(sectionId, branchId, { syncActivity: false });
    return true;
  }

  function initUnifiedTimeline() {
    TIMELINE_SECTIONS.forEach((section) => renderTimelineCompanyPills(section));

    if (applyTimelineDeepLink()) return;

    renderUnifiedVentureView(forbesProfiles.find((p) => p.rank === 1));
  }

  function initTimelineGitgraph() {
    initUnifiedTimeline();
  }

  const PROFILE_LANE_COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#78716c', '#b45309',
  ];

  let timelineProfileState = null;
  let timelineProfileBranchFocus = 'all';
  let timelineProfileModel = null;

  function profileUsesVentureTimeline(profile) {
    return profile?.rank === 1;
  }

  function buildProfileTimelineModel(profile) {
    const timeline = profile?.timeline || [];
    const entities = profile?.entities || [];
    const entityMap = Object.fromEntries(entities.map((e) => [e.id, e.name]));
    const branches = [];
    const branchSeen = new Set();

    const addBranch = (id, label) => {
      if (branchSeen.has(id)) return;
      branchSeen.add(id);
      branches.push({
        id,
        label: label || id,
        color: PROFILE_LANE_COLORS[branches.length % PROFILE_LANE_COLORS.length],
      });
    };

    timeline.forEach((ev) => {
      if (ev.entityId) addBranch(ev.entityId, entityMap[ev.entityId] || ev.entityId);
    });
    if (!branches.length) addBranch('journey', profile.sector || 'Wealth journey');

    const events = timeline.map((ev, i) => {
      const yearMatch = String(ev.year || '').match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : '0000';
      const month = String((i % 12) + 1).padStart(2, '0');
      const branch = ev.entityId || branches[0].id;
      const detailParts = [];
      if (ev.type) detailParts.push(ev.type);
      if (ev.valuationUsdB != null) detailParts.push(`Valuation $${ev.valuationUsdB}B`);
      if (ev.description) detailParts.push(ev.description);
      return {
        id: `${branch}-${i}`,
        branch,
        sort: `${year}-${month}`,
        date: String(ev.year),
        title: ev.title,
        approx: String(ev.year).includes('s'),
        detail: detailParts.join(' · ') || undefined,
      };
    }).sort((a, b) => a.sort.localeCompare(b.sort) || a.id.localeCompare(b.id));

    return {
      heading: `${profile.name} · wealth journey`,
      lead: `${timeline.length} milestone${timeline.length === 1 ? '' : 's'} from profile data — ${profile.sector || 'sector'} · ${profile.country || 'global'}. Select a lane pill to drill down.`,
      branches,
      events,
    };
  }

  function profileBranchColorMap(model) {
    return Object.fromEntries((model?.branches || []).map((b) => [b.id, b.color]));
  }

  function updateTimelineProfileContext(profile) {
    const el = document.getElementById('timeline-profile-context');
    if (!el) return;
    if (!profile) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    const mode = profileUsesVentureTimeline(profile)
      ? 'Unified venture + portfolio lanes with wealth overlay'
      : `${(profile.timeline || []).length} profile milestones · wealth cross-reference`;
    el.hidden = false;
    el.innerHTML = `Timeline for <strong>${escapeHtml(profile.name)}</strong> · rank #${profile.rank} · ${escapeHtml(mode)}`;
  }

  function renderProfileTimelinePills(model) {
    const root = document.getElementById('timeline-profile-pills');
    if (!root || !model) return;

    const focus = timelineProfileBranchFocus;
    const allActive = focus === 'all';
    const colorMap = profileBranchColorMap(model);

    root.innerHTML = [
      `<button type="button" role="tab" class="timeline-company-pill${allActive ? ' active' : ''}" data-branch="all" aria-selected="${allActive}" tabindex="${allActive ? 0 : -1}">All lanes</button>`,
      ...model.branches.map((b) => {
        const active = focus === b.id;
        return `<button type="button" role="tab" class="timeline-company-pill${active ? ' active' : ''}" data-branch="${b.id}" aria-selected="${active}" tabindex="${active ? 0 : -1}" style="--pill-color:${colorMap[b.id]}">${escapeHtml(b.label)}</button>`;
      }),
    ].join('');

    root.querySelectorAll('.timeline-company-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        timelineProfileBranchFocus = pill.dataset.branch;
        renderProfileTimelineView(timelineProfileState, timelineProfileModel);
      });
    });
  }

  function renderProfileTimelineView(profile, model) {
    if (!profile || !model) return;
    timelineProfileModel = model;
    renderProfileTimelinePills(model);
    renderTimelineWealthChart('timeline-profile-wealth', profile);

    const branchColorMap = profileBranchColorMap(model);
    const focus = timelineProfileBranchFocus;
    const drilldownEl = document.getElementById('timeline-drilldown-profile');
    const gitgraphEl = document.getElementById('gitgraph-profile');

    if (focus === 'all') {
      if (drilldownEl) {
        drilldownEl.hidden = true;
        drilldownEl.innerHTML = '';
      }
      renderTimelineGitgraph({
        branches: model.branches,
        events: model.events,
        containerId: 'gitgraph-profile',
        legendId: 'timeline-profile-legend',
        singleBranch: null,
        branchColorMap,
      });
      if (gitgraphEl) gitgraphEl.hidden = false;
      return;
    }

    const branchEvents = model.events.filter((ev) => ev.branch === focus);
    renderTimelineGitgraph({
      branches: model.branches,
      events: branchEvents,
      containerId: 'gitgraph-profile',
      legendId: 'timeline-profile-legend',
      singleBranch: focus,
      branchColorMap,
    });
    if (gitgraphEl) gitgraphEl.hidden = false;
    renderDrilldownList(branchEvents, focus, drilldownEl, branchColorMap[focus]);
  }

  function syncTimelineFromProfile(profile) {
    timelineProfileState = profile || null;
    highlightWealthRankCards(profile);
    updateTimelineProfileContext(profile);

    const ventureShell = document.getElementById('timeline-venture-shell');
    const profileShell = document.getElementById('timeline-profile-shell');
    const heading = document.getElementById('timeline-heading');
    const lead = document.getElementById('timeline-lead');

    if (!profile) {
      if (ventureShell) ventureShell.hidden = false;
      if (profileShell) profileShell.hidden = true;
      if (heading) heading.textContent = 'Milestones · portfolio · wealth';
      if (lead) {
        lead.textContent = 'IPO cluster and venture gitgraphs stacked with net-worth history — orange pins mark milestone years that overlap wealth moves.';
      }
      renderUnifiedVentureView(forbesProfiles.find((p) => p.rank === 1));
      return;
    }

    const showVenture = profileUsesVentureTimeline(profile);
    if (ventureShell) ventureShell.hidden = !showVenture;
    if (profileShell) profileShell.hidden = showVenture;

    if (showVenture) {
      if (heading) heading.textContent = 'Milestones · portfolio · wealth';
      if (lead) {
        lead.textContent = 'IPO cluster and venture gitgraphs stacked with net-worth history — orange pins mark milestone years that overlap wealth moves.';
      }
      renderUnifiedVentureView(profile);
      return;
    }

    timelineProfileBranchFocus = 'all';
    const model = buildProfileTimelineModel(profile);
    if (heading) heading.textContent = model.heading;
    if (lead) lead.textContent = model.lead;
    renderProfileTimelineView(profile, model);
  }

  const CHART = {
    bg: 'transparent',
    text: '#737373',
    textLight: '#525252',
    grid: '#f1f3f5',
    border: 'rgba(0,0,0,0.08)',
    scale: ['#f1f3f5', '#dcfce7', '#86efac', '#16a34a'],
  };

  const activityCharts = [];

  /** Read gitgraph branch color from CSS custom properties. */
  function getBranchCssColor(branchId) {
    const varName = `--branch-${branchId}`;
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || '#525252';
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    if (Number.isNaN(n)) return [82, 82, 82];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function branchHeatmapScale(hex) {
    const [r, g, b] = hexToRgb(hex);
    return [
      '#f8f9fa',
      `rgba(${r}, ${g}, ${b}, 0.22)`,
      `rgba(${r}, ${g}, ${b}, 0.52)`,
      hex,
    ];
  }

  function branchEventsFor(events, branchId) {
    return events
      .filter((ev) => ev.branch === branchId)
      .sort((a, b) => a.sort.localeCompare(b.sort) || a.id.localeCompare(b.id));
  }

  function expandEventsToCalendarData(branchEvents) {
    const byMonth = {};
    branchEvents.forEach((ev) => {
      if (!byMonth[ev.sort]) byMonth[ev.sort] = [];
      byMonth[ev.sort].push(ev);
    });

    const data = [];
    Object.entries(byMonth).forEach(([sort, evs]) => {
      const [y, m] = sort.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      evs.forEach((ev, i) => {
        const day = Math.min(
          daysInMonth,
          Math.max(1, Math.round(((i + 1) * daysInMonth) / (evs.length + 1))),
        );
        const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        data.push([date, ev.merge ? 2 : 1]);
      });
    });
    return data;
  }

  function calendarRangeFromEvents(branchEvents) {
    if (!branchEvents.length) {
      const y = new Date().getFullYear();
      return [String(y), String(y)];
    }
    const sorts = branchEvents.map((ev) => ev.sort);
    const min = sorts.reduce((a, b) => (a < b ? a : b));
    const max = sorts.reduce((a, b) => (a > b ? a : b));
    return [min.slice(0, 4), max.slice(0, 4)];
  }

  function formatSortSpan(events) {
    if (!events.length) return '—';
    return `${events[0].date} – ${events[events.length - 1].date}`;
  }

  function renderBranchEventList(events) {
    return events.map((ev) => {
      const approx = ev.approx ? ' <span class="activity-event-approx">~</span>' : '';
      return `<li class="activity-event-item">
        <span class="activity-event-date">${ev.date}</span>
        <span class="activity-event-id">${ev.id}</span>${approx}
        <span>${ev.title}</span>
      </li>`;
    }).join('');
  }

  function initBranchActivityChart(branchId, branchEvents, container) {
    if (!container || typeof echarts === 'undefined' || container.dataset.chartReady === '1') return;

    const color = getBranchCssColor(branchId);
    const calendarData = expandEventsToCalendarData(branchEvents);
    const [rangeStart, rangeEnd] = calendarRangeFromEvents(branchEvents);
    const range = rangeStart === rangeEnd ? rangeStart : [rangeStart, rangeEnd];

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: CHART.bg,
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: CHART.border,
        textStyle: { color: '#1a1a1a', fontSize: 11 },
        formatter: (p) => `${p.data[0]}<br/>${p.data[1]} milestone${p.data[1] === 1 ? '' : 's'}`,
      },
      visualMap: {
        min: 0,
        max: 2,
        show: false,
        inRange: { color: branchHeatmapScale(color) },
      },
      calendar: {
        range,
        cellSize: ['auto', 10],
        top: 4,
        left: 12,
        right: 8,
        bottom: 4,
        itemStyle: {
          borderWidth: 2,
          borderColor: '#ffffff',
          color: CHART.grid,
        },
        yearLabel: { show: false },
        monthLabel: {
          color: CHART.text,
          fontSize: 9,
          nameMap: 'en',
          margin: 6,
        },
        dayLabel: {
          firstDay: 0,
          color: CHART.text,
          fontSize: 8,
          nameMap: ['', 'M', '', 'W', '', 'F', ''],
        },
        splitLine: { show: false },
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: calendarData,
      }],
    });

    container.dataset.chartReady = '1';
    activityCharts.push(chart);
  }

  function renderActivityGroupSwatches(branches) {
    return branches.map((b) =>
      `<span class="activity-group-swatch branch-${b.id}" aria-hidden="true"></span>`
    ).join('');
  }

  function renderActivityBranches() {
    const root = document.getElementById('activity-branches');
    if (!root) return;

    const groups = TIMELINE_SECTIONS.map((section, index) => ({
      id: section.activityGroupId,
      title: section.label,
      meta: `${section.events.length} events · ${section.branches.length} branches`,
      open: index === 0,
      branches: section.branches,
      events: section.events,
    }));

    root.innerHTML = groups.map((group) => {
      const branchPanels = group.branches.map((branch) => {
        const branchEvents = branchEventsFor(group.events, branch.id);
        const span = formatSortSpan(branchEvents);

        return `
          <details class="activity-branch" data-branch="${branch.id}">
            <summary>
              <span class="activity-branch-swatch" aria-hidden="true"></span>
              <span class="activity-branch-name">${branch.label}</span>
              <span class="activity-branch-meta">${branchEvents.length} events · ${span}</span>
            </summary>
            <div class="activity-branch-body">
              <div class="activity-branch-chart" id="activity-chart-${branch.id}" role="img" aria-label="${branch.label} milestone activity heatmap"></div>
              <ol class="activity-event-list">${renderBranchEventList(branchEvents)}</ol>
            </div>
          </details>`;
      }).join('');

      const openAttr = group.open ? ' open' : '';
      const syncedCls = group.id === TIMELINE_SECTIONS[timelineState.tabIndex].activityGroupId ? ' is-synced' : '';
      return `
        <details class="activity-group${syncedCls}" data-group="${group.id}"${openAttr}>
          <summary>
            <span class="activity-group-title-wrap">
              <span class="activity-group-swatches">${renderActivityGroupSwatches(group.branches)}</span>
              <span>${group.title}</span>
            </span>
            <span class="activity-group-meta">${group.meta}</span>
          </summary>
          <div class="activity-branch-list">${branchPanels}</div>
        </details>`;
    }).join('');

    root.querySelectorAll('.activity-branch').forEach((details) => {
      const branchId = details.dataset.branch;
      const tryInit = () => {
        if (!details.open) return;
        const chartEl = details.querySelector('.activity-branch-chart');
        const group = groups.find((g) => g.branches.some((b) => b.id === branchId));
        if (!group) return;
        const branchEvents = branchEventsFor(group.events, branchId);
        initBranchActivityChart(branchId, branchEvents, chartEl);
      };

      details.addEventListener('toggle', tryInit);
      if (details.open) tryInit();
    });

    root.querySelectorAll('.activity-group').forEach((groupEl) => {
      groupEl.addEventListener('toggle', () => {
        if (!activitySyncEnabled || timelineSyncLock || !groupEl.open) return;
        const groupId = groupEl.dataset.group;
        const tabIdx = TIMELINE_SECTIONS.findIndex((s) => s.activityGroupId === groupId);
        if (tabIdx >= 0 && timelineState.tabIndex !== tabIdx) {
          setTimelineTab(tabIdx, { syncActivity: false });
        }
        groupEl.querySelectorAll('.activity-branch[open] .activity-branch-chart').forEach((chartEl) => {
          const branchId = chartEl.id.replace('activity-chart-', '');
          const group = groups.find((g) => g.branches.some((b) => b.id === branchId));
          if (!group) return;
          initBranchActivityChart(branchId, branchEventsFor(group.events, branchId), chartEl);
        });
      });
    });

    root.querySelectorAll('.activity-branch').forEach((branchEl) => {
      branchEl.addEventListener('toggle', () => {
        if (!activitySyncEnabled || timelineSyncLock || !branchEl.open) return;
        const branchId = branchEl.dataset.branch;
        const groupEl = branchEl.closest('.activity-group');
        if (!groupEl) return;
        const groupId = groupEl.dataset.group;
        const tabIdx = TIMELINE_SECTIONS.findIndex((s) => s.activityGroupId === groupId);
        if (tabIdx >= 0) {
          if (timelineState.tabIndex !== tabIdx) setTimelineTab(tabIdx, { syncActivity: false });
          const sectionId = TIMELINE_SECTIONS[tabIdx].id;
          if (timelineState.branchFocus[sectionId] !== branchId) {
            setTimelineBranch(sectionId, branchId);
          }
        }
      });
    });
  }

  const ACTIVITY_YEARS = [2023, 2024, 2025, 2026];

  const PIPELINE_STAGE_BRANCHES = {
    DVC: 'main',
    CI: 'colossus',
    Colossus: 'colossus',
    Grok: 'grok',
    Vision: 'terrafab',
    Agents: 'grok',
    FT: 'openai',
  };

  const activityYearState = {
    calendar: ACTIVITY_YEARS[ACTIVITY_YEARS.length - 1],
    pipeline: ACTIVITY_YEARS[ACTIVITY_YEARS.length - 1],
  };

  /** Forbes profile → venture gitgraph branch mapping (entityId). */
  const ENTITY_BRANCH_MAP = {
    tesla: { sectionId: 'portfolio', branchId: 'tesla' },
    spacex: { sectionId: 'portfolio', branchId: 'spacex-ops' },
    xai: { sectionId: 'cluster', branchId: 'grok' },
    grok: { sectionId: 'cluster', branchId: 'grok' },
    colossus: { sectionId: 'cluster', branchId: 'colossus' },
    terrafab: { sectionId: 'cluster', branchId: 'terrafab' },
    neuralink: { sectionId: 'portfolio', branchId: 'neuralink' },
    boring: { sectionId: 'portfolio', branchId: 'boring' },
    openai: { sectionId: 'portfolio', branchId: 'openai' },
    'x-corp': { sectionId: 'portfolio', branchId: 'x-corp' },
    zip2: { sectionId: 'portfolio', branchId: 'tesla' },
    paypal: { sectionId: 'portfolio', branchId: 'tesla' },
  };

  let activityProfileState = null;
  let pendingActivityProfile = null;
  let forbesProfiles = [];
  let historicalByRank = {};
  const timelineWealthCharts = {};

  const TIMELINE_WORLD_GEO_URL = 'https://cdn.jsdelivr.net/npm/echarts@4/map/json/world.json';
  const TIMELINE_GLOBAL_BENCHMARKS_URL = 'data/global-wealth-benchmarks.json';
  const TIMELINE_GEO_COUNTRY_MAP = {
    'South Korea': 'Korea',
    'Czech Republic': 'Czech Rep.',
    'Hong Kong': 'China',
  };

  let timelineGlobalGeoReady = false;
  let timelineGlobalBenchmarks = null;
  let timelineGlobalMapChart = null;
  let timelineGlobalBarChart = null;

  function profileNetWorthB(profile) {
    const nw = profile?.netWorth;
    if (nw?.value != null) return Number(nw.value);
    return 0;
  }

  function formatWealthBillions(billions) {
    if (billions >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
    if (billions >= 100) return `$${billions.toFixed(0)}B`;
    return `$${billions.toFixed(1)}B`;
  }

  function aggregateWealthByCountry(profiles) {
    const map = {};
    profiles.forEach((profile) => {
      const country = profile.country || 'Unknown';
      map[country] = (map[country] || 0) + profileNetWorthB(profile);
    });
    return map;
  }

  function countryToGeoName(country) {
    if (Object.prototype.hasOwnProperty.call(TIMELINE_GEO_COUNTRY_MAP, country)) {
      return TIMELINE_GEO_COUNTRY_MAP[country];
    }
    return country;
  }

  async function loadTimelineGlobalContext() {
    if (!timelineGlobalBenchmarks) {
      try {
        const resp = await fetch(TIMELINE_GLOBAL_BENCHMARKS_URL);
        if (resp.ok) timelineGlobalBenchmarks = await resp.json();
      } catch {
        timelineGlobalBenchmarks = null;
      }
    }
  }

  async function ensureTimelineGlobalGeo() {
    if (timelineGlobalGeoReady || typeof echarts === 'undefined') return timelineGlobalGeoReady;
    try {
      const resp = await fetch(TIMELINE_WORLD_GEO_URL);
      if (!resp.ok) return false;
      const geo = await resp.json();
      echarts.registerMap('world', geo);
      timelineGlobalGeoReady = true;
      return true;
    } catch {
      return false;
    }
  }

  function buildTimelineGlobalChoropleth(byCountry) {
    const merged = {};
    Object.entries(byCountry).forEach(([country, wealthB]) => {
      const geoName = countryToGeoName(country);
      if (!geoName) return;
      merged[geoName] = (merged[geoName] || 0) + wealthB;
    });
    return Object.entries(merged).map(([name, value]) => ({ name, value }));
  }

  async function renderTimelineGlobalWealthMap(byCountry) {
    const el = $('#timeline-global-wealth-map');
    if (!el || typeof echarts === 'undefined') return;

    if (timelineGlobalMapChart) {
      timelineGlobalMapChart.dispose();
      timelineGlobalMapChart = null;
    }

    const ready = await ensureTimelineGlobalGeo();
    if (!ready) {
      el.innerHTML = '<p class="timeline-global-wealth-empty">Map unavailable — world GeoJSON could not load.</p>';
      return;
    }

    const choropleth = buildTimelineGlobalChoropleth(byCountry);
    const maxWealth = Math.max(...choropleth.map((row) => row.value), 1);

    timelineGlobalMapChart = echarts.init(el, null, { renderer: 'canvas' });
    timelineGlobalMapChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter(params) {
          if (params.value == null) return `${params.name}<br/>No ranked members`;
          return `${params.name}<br/>${formatWealthBillions(params.value)} combined`;
        },
      },
      visualMap: {
        min: 0,
        max: maxWealth,
        text: ['More', 'Less'],
        realtime: false,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 10,
        itemHeight: 80,
        textStyle: { fontSize: 10, color: '#64748b' },
        inRange: { color: ['#fef9c3', '#fbbf24', '#b45309'] },
      },
      series: [
        {
          name: 'Wealth by country',
          type: 'map',
          map: 'world',
          roam: false,
          zoom: 1.12,
          center: [12, 18],
          data: choropleth,
          itemStyle: {
            areaColor: '#eef2f7',
            borderColor: '#cbd5e1',
            borderWidth: 0.5,
          },
          emphasis: {
            label: { show: true, fontSize: 10, color: '#334155' },
            itemStyle: { areaColor: '#fcd34d' },
          },
        },
      ],
    });
  }

  function renderTimelineGlobalWealthBars(totalB, benchmarks) {
    const el = $('#timeline-global-wealth-chart');
    if (!el || typeof echarts === 'undefined') return;

    if (timelineGlobalBarChart) {
      timelineGlobalBarChart.dispose();
      timelineGlobalBarChart = null;
    }

    const worldGdpT = benchmarks?.worldGdpUsdT ?? 105.4;
    const householdT = benchmarks?.globalHouseholdWealthUsdT ?? 454;
    const totalT = totalB / 1000;
    const gdpShare = ((totalT / worldGdpT) * 100).toFixed(1);
    const householdShare = ((totalT / householdT) * 100).toFixed(2);

    timelineGlobalBarChart = echarts.init(el, null, { renderer: 'canvas' });
    timelineGlobalBarChart.setOption({
      backgroundColor: 'transparent',
      title: {
        text: `${gdpShare}% of world GDP`,
        subtext: `${householdShare}% of global household wealth`,
        left: 0,
        top: 0,
        textStyle: { fontSize: 13, fontWeight: 600, color: '#334155' },
        subtextStyle: { fontSize: 11, color: '#64748b' },
      },
      grid: { left: 8, right: 16, top: 52, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        max: householdT * 1.02,
        axisLabel: {
          formatter: (v) => `$${v}T`,
          fontSize: 10,
          color: '#64748b',
        },
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: ['Global household wealth', 'World GDP (nominal)', 'Forbes ranks (this page)'],
        axisLabel: { fontSize: 10, color: '#475569' },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter(params) {
          const row = params[0];
          if (!row) return '';
          return `${row.name}<br/><strong>${formatWealthBillions(row.value * 1000)}</strong>`;
        },
      },
      series: [
        {
          type: 'bar',
          data: [
            { value: householdT, itemStyle: { color: '#e2e8f0' } },
            { value: worldGdpT, itemStyle: { color: '#94a3b8' } },
            { value: totalT, itemStyle: { color: '#b45309' } },
          ],
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: (p) => formatWealthBillions(p.value * 1000),
            fontSize: 10,
            color: '#475569',
          },
        },
      ],
    });
  }

  async function renderTimelineGlobalWealth(profiles) {
    const panel = $('#timeline-global-wealth');
    const statsEl = $('#timeline-global-wealth-stats');
    const footEl = $('#timeline-global-wealth-foot');
    if (!panel || !profiles?.length) return;

    await loadTimelineGlobalContext();
    const benchmarks = timelineGlobalBenchmarks || {
      worldGdpUsdT: 105.4,
      globalHouseholdWealthUsdT: 454,
      asOf: '2024',
    };

    const byCountry = aggregateWealthByCountry(profiles);
    const totalB = profiles.reduce((sum, profile) => sum + profileNetWorthB(profile), 0);
    const countryCount = Object.keys(byCountry).length;
    const worldGdpT = benchmarks.worldGdpUsdT;
    const gdpShare = ((totalB / 1000) / worldGdpT * 100).toFixed(1);

    if (statsEl) {
      statsEl.innerHTML = `
        <span class="timeline-global-stat"><strong>${profiles.length}</strong> ranked members</span>
        <span class="timeline-global-stat"><strong>${formatWealthBillions(totalB)}</strong> combined net worth</span>
        <span class="timeline-global-stat"><strong>${countryCount}</strong> countries</span>
        <span class="timeline-global-stat"><strong>${gdpShare}%</strong> of ~$${worldGdpT}T world GDP</span>`;
    }

    if (footEl) {
      footEl.textContent = `Benchmarks as of ${benchmarks.asOf || '2024'} · Choropleth sums Forbes net worth by country of residence (Hong Kong rolled into China).`;
    }

    await renderTimelineGlobalWealthMap(byCountry);
    renderTimelineGlobalWealthBars(totalB, benchmarks);
  }

  async function loadHistoricalNetWorth() {
    try {
      const resp = await fetch('data/historical-net-worth.json');
      if (!resp.ok) return;
      historicalByRank = await resp.json();
    } catch {
      historicalByRank = {};
    }
  }

  function parseEventYear(raw) {
    const match = String(raw || '').match(/(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function crossRefYearRange(profile) {
    const years = [...parseTimelineYears(profile?.timeline || [])];
    const hist = historicalByRank[String(profile?.rank)] || [];
    hist.forEach((p) => years.push(p.year));
    if (!years.length) return { min: 2010, max: 2026 };
    return { min: Math.min(...years), max: Math.max(...years) };
  }

  function yearToSlot(year, min, max, slots) {
    if (year == null || year < min || year > max) return -1;
    if (max === min) return 0;
    return Math.round(((year - min) / (max - min)) * (slots - 1));
  }

  function buildCrossRefLanes(profile, slots = 20) {
    const { min, max } = crossRefYearRange(profile);
    const milestoneSlots = Array(slots).fill(0);
    const wealthSlots = Array(slots).fill(0);
    const slotYears = Array.from({ length: slots }, (_, i) =>
      Math.round(min + (i / Math.max(1, slots - 1)) * (max - min)),
    );
    const milestoneTips = Array(slots).fill(null).map(() => []);
    const wealthTips = Array(slots).fill(null).map(() => []);

    (profile.timeline || []).forEach((ev) => {
      const y = parseEventYear(ev.year);
      const s = yearToSlot(y, min, max, slots);
      if (s < 0) return;
      milestoneSlots[s] = Math.min(4, milestoneSlots[s] + 1);
      milestoneTips[s].push(`${ev.year}: ${ev.title}`);
    });

    const hist = historicalByRank[String(profile.rank)] || [];
    const histByYear = Object.fromEntries(hist.map((p) => [p.year, p.netWorthB]));
    const maxNw = Math.max(...hist.map((p) => p.netWorthB), 1);

    slotYears.forEach((year, i) => {
      const nw = histByYear[year];
      if (nw != null) {
        wealthSlots[i] = Math.max(1, Math.round((nw / maxNw) * 4));
        wealthTips[i].push(`${year}: $${nw}B`);
      }
    });

    if (!hist.length && (profile.wealthBreakdown || []).length) {
      wealthSlots[slots - 1] = 3;
      wealthTips[slots - 1].push('Present stake breakdown');
    }

    const overlaps = milestoneSlots.map((m, i) => m > 0 && wealthSlots[i] > 0);
    return { min, max, milestoneSlots, wealthSlots, milestoneTips, wealthTips, overlaps, slotYears };
  }

  function renderCrossRefCardBody(profile) {
    const lanes = buildCrossRefLanes(profile);
    const cell = (level, overlap, tips, kind) => {
      const title = tips.filter(Boolean).join('\n') || `${kind} · ${lanes.min}–${lanes.max}`;
      return `<span class="rank-card-cell${overlap ? ' is-overlap' : ''}" data-level="${level}" title="${escapeHtml(title)}"></span>`;
    };
    return `
      <span class="rank-card-crossref" aria-hidden="true">
        <span class="rank-card-lane">
          <span class="rank-card-lane-label">Milestones</span>
          <span class="rank-card-lane-cells">
            ${lanes.milestoneSlots.map((level, i) => cell(level, lanes.overlaps[i], lanes.milestoneTips[i], 'Milestone')).join('')}
          </span>
        </span>
        <span class="rank-card-lane">
          <span class="rank-card-lane-label">Wealth</span>
          <span class="rank-card-lane-cells rank-card-lane-wealth">
            ${lanes.wealthSlots.map((level, i) => cell(level, lanes.overlaps[i], lanes.wealthTips[i], 'Wealth')).join('')}
          </span>
        </span>
        <span class="rank-card-year-axis">
          <span>${lanes.min}</span>
          <span>${lanes.max}</span>
        </span>
      </span>`;
  }

  function disposeTimelineWealthChart(containerId) {
    if (timelineWealthCharts[containerId]) {
      timelineWealthCharts[containerId].dispose();
      delete timelineWealthCharts[containerId];
    }
  }

  function collectMilestoneMarks(profile, { includeVentureEvents = false } = {}) {
    const marks = [];
    const seen = new Set();
    const add = (yearRaw, title) => {
      const year = parseEventYear(yearRaw);
      if (!year) return;
      const key = `${year}::${title}`;
      if (seen.has(key)) return;
      seen.add(key);
      marks.push({ year, title });
    };
    (profile?.timeline || []).forEach((ev) => add(ev.year, ev.title));
    if (includeVentureEvents) {
      [...TIMELINE_CLUSTER_EVENTS, ...TIMELINE_PORTFOLIO_EVENTS].forEach((ev) => {
        add(ev.date || ev.sort, ev.title);
      });
    }
    return marks;
  }

  function renderTimelineWealthChart(containerId, profile, { includeVentureEvents = false } = {}) {
    const el = document.getElementById(containerId);
    if (!el || typeof echarts === 'undefined' || !profile) return;

    disposeTimelineWealthChart(containerId);
    const hist = historicalByRank[String(profile.rank)] || [];
    const marks = collectMilestoneMarks(profile, { includeVentureEvents });

    if (!hist.length) {
      el.innerHTML = '<p class="timeline-wealth-empty">No historical net-worth series — milestone lanes still align by year in the cards above.</p>';
      return;
    }

    el.innerHTML = '';
    const years = hist.map((p) => String(p.year));
    const values = hist.map((p) => p.netWorthB);
    const markByYear = Object.fromEntries(marks.map((m) => [m.year, m.title]));
    const peakValue = Math.max(...values);
    const peakYear = years[values.indexOf(peakValue)];
    const markPoints = hist
      .filter((p) => markByYear[p.year])
      .map((p) => {
        const isPeak = p.netWorthB === peakValue && String(p.year) === peakYear;
        return {
          name: markByYear[p.year],
          coord: [String(p.year), p.netWorthB],
          value: markByYear[p.year],
          symbol: isPeak ? 'diamond' : 'circle',
          symbolSize: isPeak ? 14 : 8,
          itemStyle: isPeak
            ? { color: '#b45309', shadowBlur: 6, shadowColor: 'rgba(180, 83, 9, 0.35)' }
            : { color: '#ffffff', borderColor: '#b45309', borderWidth: 2 },
        };
      });

    timelineWealthCharts[containerId] = echarts.init(el, null, { renderer: 'canvas' });
    timelineWealthCharts[containerId].setOption({
      backgroundColor: 'transparent',
      color: ['#171717', '#b45309'],
      tooltip: {
        trigger: 'axis',
        formatter(params) {
          const p = params[0];
          const mark = markByYear[Number(p.name)];
          return mark
            ? `${p.name}: $${p.value}B<br/><strong>Milestone:</strong> ${mark}`
            : `${p.name}: $${p.value}B`;
        },
      },
      grid: { left: 8, right: 16, top: 36, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: years,
        boundaryGap: false,
        axisLabel: { color: '#737373', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: '$B',
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
          areaStyle: { color: 'rgba(0, 0, 0, 0.05)' },
          data: values,
          markPoint: markPoints.length
            ? {
                label: { show: false },
                data: markPoints,
              }
            : undefined,
        },
      ],
    });
  }

  function renderUnifiedVentureView(profile) {
    TIMELINE_SECTIONS.forEach((section) => {
      renderTimelineCompanyPills(section);
      renderTimelineSection(section);
    });
    renderTimelineWealthChart('timeline-unified-wealth', profile || timelineProfileState, {
      includeVentureEvents: true,
    });
  }

  function formatProfileNetWorth(profile) {
    const nw = profile?.netWorth;
    if (nw && typeof nw === 'object' && nw.value != null) {
      return `$${nw.value}${nw.unit || 'B'}`;
    }
    return '—';
  }

  function placeholderCellsForProfile(profile, weeks = 53) {
    const events = profile?.timeline || [];
    const eventCount = events.length;
    const rank = profile?.rank || 1;
    const cells = [];
    for (let w = 0; w < weeks; w += 1) {
      if (!eventCount) {
        cells.push(0);
        continue;
      }
      const pulse = (rank * 17 + w * 13) % 53;
      if (pulse >= eventCount + 8) {
        cells.push(0);
        continue;
      }
      cells.push(1 + ((rank + w + pulse) % 4));
    }
    return cells;
  }

  async function loadForbesProfiles() {
    try {
      const resp = await fetch('data/forbes-billionaires.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rows = await resp.json();
      forbesProfiles = rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      return forbesProfiles;
    } catch {
      forbesProfiles = [];
      return [];
    }
  }

  function highlightWealthRankCards(profile) {
    document.querySelectorAll('.wealth-rank-card').forEach((card) => {
      const active = profile && Number(card.dataset.rank) === profile.rank;
      card.classList.toggle('is-active', Boolean(active));
      card.classList.toggle('is-profile-match', Boolean(active));
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderWealthRankGrid(rootId, { scrollTargetId = 'forbes', crossRef = false } = {}) {
    const root = document.getElementById(rootId);
    if (!root) return;

    if (!forbesProfiles.length) {
      root.innerHTML = '<p class="activity-ranks-empty">Could not load ranked profiles.</p>';
      return;
    }

    if (crossRef) root.classList.add('timeline-ranks-crossref');

    root.innerHTML = forbesProfiles.map((profile) => {
      const cells = placeholderCellsForProfile(profile);
      const milestones = (profile.timeline || []).length;
      const crossRefBody = crossRef ? renderCrossRefCardBody(profile) : `
          <span class="activity-rank-placeholder" aria-hidden="true">
            ${cells.map((level) => `<span class="activity-rank-cell" data-level="${level}"></span>`).join('')}
          </span>`;
      const overlapCount = crossRef ? buildCrossRefLanes(profile).overlaps.filter(Boolean).length : 0;
      return `
        <button
          type="button"
          class="activity-rank-card wealth-rank-card${crossRef ? ' wealth-rank-card-crossref' : ''}"
          data-rank="${profile.rank}"
          aria-pressed="false"
          aria-label="Rank ${profile.rank}, ${escapeHtml(profile.name)}"
        >
          <span class="activity-rank-card-head">
            <span class="activity-rank-num">#${profile.rank}</span>
            <span class="activity-rank-name">${escapeHtml(profile.name)}</span>
          </span>
          ${crossRefBody}
          <span class="activity-rank-meta">
            <span>${milestones} milestone${milestones === 1 ? '' : 's'}${crossRef && overlapCount ? ` · ${overlapCount} overlap${overlapCount === 1 ? '' : 's'}` : ''}</span>
            <span>${escapeHtml(formatProfileNetWorth(profile))}</span>
          </span>
        </button>`;
    }).join('');

    root.querySelectorAll('.wealth-rank-card').forEach((card) => {
      card.addEventListener('click', () => {
        const rank = Number(card.dataset.rank);
        const profile = forbesProfiles.find((p) => p.rank === rank);
        if (!profile) return;
        const hash = `#forbes?rank=${profile.rank}&name=${encodeURIComponent(profile.name)}`;
        if (window.location.hash !== hash) {
          history.replaceState(null, '', hash);
        }
        window.dispatchEvent(new CustomEvent('forbes:select', { detail: { person: profile } }));
        scrollToSectionElement(document.getElementById(scrollTargetId), { behavior: 'smooth' });
      });
    });

    const activeProfile = rootId === 'activity-ranks' ? activityProfileState : timelineProfileState;
    if (activeProfile) highlightWealthRankCards(activeProfile);
  }

  function renderActivityRankGrid(profiles) {
    if (profiles?.length) forbesProfiles = profiles;
    renderWealthRankGrid('activity-ranks', { scrollTargetId: 'forbes' });
  }

  function renderTimelineRankGrid(profiles) {
    if (profiles?.length) forbesProfiles = profiles;
    renderTimelineGlobalWealth(forbesProfiles);
    renderWealthRankGrid('timeline-ranks', { scrollTargetId: 'timeline', crossRef: true });
  }

  function parseTimelineYears(timeline) {
    const years = new Set();
    (timeline || []).forEach((ev) => {
      const match = String(ev.year || '').match(/\d{4}/);
      if (match) years.add(Number(match[0]));
    });
    return [...years].sort((a, b) => a - b);
  }

  function resolveProfileBranches(profile) {
    const branches = [];
    const seen = new Set();
    const add = (sectionId, branchId) => {
      const key = `${sectionId}:${branchId}`;
      if (!seen.has(key)) {
        seen.add(key);
        branches.push({ sectionId, branchId });
      }
    };

    (profile.entities || []).forEach((entity) => {
      const mapped = ENTITY_BRANCH_MAP[entity.id];
      if (mapped) add(mapped.sectionId, mapped.branchId);
    });

    (profile.timeline || []).forEach((ev) => {
      if (!ev.entityId) return;
      const mapped = ENTITY_BRANCH_MAP[ev.entityId];
      if (mapped) add(mapped.sectionId, mapped.branchId);
    });

    (profile.wealthBreakdown || []).forEach((row) => {
      const name = String(row.entity || '').toLowerCase();
      if (name.includes('tesla')) add('portfolio', 'tesla');
      if (name.includes('spacex')) add('portfolio', 'spacex-ops');
      if (name.includes('xai') || name.includes('grok')) add('cluster', 'grok');
      if (name.includes('neuralink')) add('portfolio', 'neuralink');
      if (name.includes('openai')) add('portfolio', 'openai');
    });

    return branches;
  }

  function getProfileActivityFilter() {
    if (!activityProfileState) return null;
    const branches = resolveProfileBranches(activityProfileState);
    return {
      branchIds: branches.map((b) => b.branchId),
      years: parseTimelineYears(activityProfileState.timeline),
    };
  }

  function pickActivityYear(years) {
    const inRange = years.filter((y) => ACTIVITY_YEARS.includes(y));
    if (inRange.length) return inRange[inRange.length - 1];
    if (!years.length) return activityYearState.calendar;
    const latest = years[years.length - 1];
    return ACTIVITY_YEARS.reduce((best, y) =>
      (Math.abs(y - latest) < Math.abs(best - latest) ? y : best));
  }

  function updateActivityProfileContext(profile, branches) {
    const el = document.getElementById('activity-profile-context');
    if (!el) return;
    if (!profile) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    const branchLabels = branches.map((b) => {
      const section = TIMELINE_SECTIONS.find((s) => s.id === b.sectionId);
      const branch = section?.branches.find((br) => br.id === b.branchId);
      return branch?.label || b.branchId;
    });
    const focus = branchLabels.length
      ? branchLabels.join(', ')
      : `${profile.sector || 'sector'} · ${parseTimelineYears(profile.timeline).length} milestone years`;
    el.hidden = false;
    el.innerHTML = `Viewing <strong>${escapeHtml(profile.name)}</strong> · ${escapeHtml(focus)}`;
  }

  function renderProfileTimelinePanel(profile) {
    const panel = document.getElementById('activity-profile-events');
    if (!panel) return;
    const events = profile?.timeline || [];
    if (!events.length) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    panel.innerHTML = `
      <header class="activity-profile-events-header">
        <h3 class="activity-profile-events-title">${escapeHtml(profile.name)} · wealth journey</h3>
        <p class="activity-profile-events-meta">${events.length} milestone${events.length === 1 ? '' : 's'} from profile</p>
      </header>
      <ol class="activity-event-list activity-profile-event-list">
        ${events.map((ev) => {
          const approx = String(ev.year).includes('s') ? ' <span class="activity-event-approx">~</span>' : '';
          const type = ev.type ? `<span class="activity-event-type">${escapeHtml(ev.type)}</span> ` : '';
          return `<li class="activity-event-item is-profile-event">
            <span class="activity-event-date">${escapeHtml(ev.year)}</span>
            ${type}<span>${escapeHtml(ev.title)}</span>${approx}
          </li>`;
        }).join('')}
      </ol>`;
  }

  function clearProfileActivityHighlight() {
    document.querySelectorAll('.activity-group, .activity-branch').forEach((el) => {
      el.classList.remove('is-profile-match', 'is-profile-dim');
    });
    document.getElementById('activity')?.classList.remove('has-profile-focus');
  }

  function highlightActivityForProfile(branches) {
    clearProfileActivityHighlight();
    const branchIds = new Set(branches.map((b) => b.branchId));
    if (!branchIds.size) return;

    document.getElementById('activity')?.classList.add('has-profile-focus');

    document.querySelectorAll('.activity-branch').forEach((branchEl) => {
      const id = branchEl.dataset.branch;
      if (branchIds.has(id)) {
        branchEl.classList.add('is-profile-match');
        if (!branchEl.open) {
          branchEl.open = true;
          const chartEl = branchEl.querySelector('.activity-branch-chart');
          const section = TIMELINE_SECTIONS.find((s) =>
            s.branches.some((b) => b.id === id),
          );
          if (section && chartEl) {
            initBranchActivityChart(id, branchEventsFor(section.events, id), chartEl);
          }
        }
      } else {
        branchEl.classList.add('is-profile-dim');
      }
    });

    document.querySelectorAll('.activity-group').forEach((groupEl) => {
      const hasMatch = groupEl.querySelector('.activity-branch.is-profile-match');
      if (hasMatch) {
        groupEl.classList.add('is-profile-match');
        groupEl.open = true;
      } else {
        groupEl.classList.add('is-profile-dim');
      }
    });
  }

  function syncActivityFromProfile(profile) {
    if (!activitySyncEnabled) {
      pendingActivityProfile = profile;
      return;
    }

    activityProfileState = profile || null;

    if (!profile) {
      updateActivityProfileContext(null, []);
      renderProfileTimelinePanel(null);
      clearProfileActivityHighlight();
      highlightWealthRankCards(null);
      renderOverviewCalendar(activityYearState.calendar);
      renderOverviewPipeline(activityYearState.pipeline);
      return;
    }

    const branches = resolveProfileBranches(profile);
    const years = parseTimelineYears(profile.timeline);
    const targetYear = pickActivityYear(years);

    activityYearState.calendar = targetYear;
    activityYearState.pipeline = targetYear;

    updateActivityProfileContext(profile, branches);
    renderProfileTimelinePanel(profile);
    highlightActivityForProfile(branches);
    highlightWealthRankCards(profile);
    renderOverviewCalendar(targetYear);
    renderOverviewPipeline(targetYear);

    if (branches.length) {
      timelineSyncLock = true;
      const primary = branches[0];
      const tabIdx = TIMELINE_SECTIONS.findIndex((s) => s.id === primary.sectionId);
      if (tabIdx >= 0) {
        if (timelineState.tabIndex !== tabIdx) {
          setTimelineTab(tabIdx, { syncActivity: false });
        }
        setTimelineBranch(primary.sectionId, primary.branchId, { syncActivity: false });
        syncActivityFromTimeline(primary.sectionId, primary.branchId);
      }
      timelineSyncLock = false;
    }
  }

  let overviewCalendarChart = null;
  let overviewPipelineChart = null;

  function heatmapColorFromScale(scale, value, max) {
    if (!value || value <= 0) return scale[0];
    const idx = Math.min(scale.length - 1, Math.round((value / max) * (scale.length - 1)));
    return scale[idx];
  }

  function sortKeyToDate(sortKey, index, total) {
    const [y, m] = sortKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const day = Math.min(
      daysInMonth,
      Math.max(1, Math.round(((index + 1) * daysInMonth) / (total + 1))),
    );
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function buildSectorContributionIndex() {
    const byDate = new Map();
    const allEvents = [...TIMELINE_CLUSTER_EVENTS, ...TIMELINE_PORTFOLIO_EVENTS];

    allEvents.forEach((ev) => {
      const year = Number(ev.sort.slice(0, 4));
      if (!ACTIVITY_YEARS.includes(year)) return;
      const siblings = allEvents.filter((e) => e.sort === ev.sort);
      const idx = siblings.findIndex((e) => e.id === ev.id);
      const date = sortKeyToDate(ev.sort, idx, siblings.length);
      const key = date;
      if (!byDate.has(key)) byDate.set(key, { branch: ev.branch, count: 0 });
      const entry = byDate.get(key);
      entry.count += ev.merge ? 3 : 2;
      entry.branch = ev.branch;
    });

    return byDate;
  }

  const sectorContributionIndex = buildSectorContributionIndex();

  function buildCalendarDataForYear(year, filter = null) {
    const data = [];
    const branchLabels = Object.fromEntries(
      [...TIMELINE_CLUSTER_BRANCHES, ...TIMELINE_PORTFOLIO_BRANCHES].map((b) => [b.id, b.label]),
    );
    const allowedBranches = filter?.branchIds?.length ? new Set(filter.branchIds) : null;

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hit = sectorContributionIndex.get(date);
        if (hit) {
          if (allowedBranches && !allowedBranches.has(hit.branch)) continue;
          data.push([date, hit.count, hit.branch]);
          continue;
        }
        const noise = Math.random();
        if (noise < 0.18) {
          const branches = year >= 2025
            ? ['grok', 'colossus', 'terrafab', 'tesla', 'spacex-ops']
            : year >= 2024
              ? ['grok', 'colossus', 'tesla', 'spacex-ops', 'neuralink']
              : ['tesla', 'openai', 'neuralink', 'boring', 'grok'];
          const pool = allowedBranches
            ? branches.filter((b) => allowedBranches.has(b))
            : branches;
          if (!pool.length) continue;
          const branch = pool[Math.floor(Math.random() * pool.length)];
          data.push([date, 1 + Math.floor(Math.random() * 4), branch]);
        }
      }
    }

    return { data, branchLabels };
  }

  function buildPipelineDataForYear(year, filter = null) {
    const stages = ['DVC', 'CI', 'Colossus', 'Grok', 'Vision', 'Agents', 'FT'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = [];
    const yearBias = (year - 2023) * 0.6;
    const allowedBranches = filter?.branchIds?.length ? new Set(filter.branchIds) : null;

    stages.forEach((stage, stageIdx) => {
      const stageBranch = PIPELINE_STAGE_BRANCHES[stage] || 'main';
      if (allowedBranches && !allowedBranches.has(stageBranch)) return;

      months.forEach((_, monthIdx) => {
        const seasonal = 1 + Math.sin((monthIdx + stageIdx) * 0.55) * 0.35;
        const runs = Math.max(
          0,
          Math.round((2 + yearBias + seasonal * 2.5 + Math.random() * 4) * (stage === 'Colossus' || stage === 'Grok' ? 1.2 : 1)),
        );
        if (runs > 0) data.push([stageIdx, monthIdx, runs]);
      });
    });

    return { stages, months, data };
  }

  function renderOverviewCalendar(year) {
    if (!overviewCalendarChart) return;
    const filter = getProfileActivityFilter();
    const { data, branchLabels } = buildCalendarDataForYear(year, filter);
    const meta = document.getElementById('calendar-meta');
    if (meta) meta.textContent = String(year);

    overviewCalendarChart.setOption({
      calendar: { range: year },
      series: [{
        data,
        itemStyle: {
          color: (params) => {
            const branchId = params.data[2] || 'main';
            const scale = branchHeatmapScale(getBranchCssColor(branchId));
            return heatmapColorFromScale(scale, params.data[1], 6);
          },
        },
      }],
      tooltip: {
        formatter: (p) => {
          const branchId = p.data[2] || 'main';
          const label = branchLabels[branchId] || branchId;
          return `${p.data[0]}<br/><span style="color:${getBranchCssColor(branchId)}">${label}</span> · ${p.data[1]} events`;
        },
      },
    });
  }

  function renderOverviewPipeline(year) {
    if (!overviewPipelineChart) return;
    const filter = getProfileActivityFilter();
    const { stages, months, data } = buildPipelineDataForYear(year, filter);
    const stageColors = stages.map((stage) => getBranchCssColor(PIPELINE_STAGE_BRANCHES[stage] || 'main'));
    const meta = document.getElementById('pipeline-meta');
    if (meta) meta.textContent = String(year);

    overviewPipelineChart.setOption({
      xAxis: {
        data: stages,
        axisLabel: {
          rich: Object.fromEntries(
            stages.map((stage, i) => [`s${i}`, { color: stageColors[i], fontWeight: 500 }]),
          ),
          formatter: (value, idx) => `{s${idx}|${value}}`,
        },
      },
      yAxis: { data: months },
      series: [{
        data,
        itemStyle: {
          borderWidth: 3,
          borderColor: '#ffffff',
          color: (params) => {
            const stageIdx = params.data[0];
            const branchId = PIPELINE_STAGE_BRANCHES[stages[stageIdx]] || 'main';
            const scale = branchHeatmapScale(getBranchCssColor(branchId));
            return heatmapColorFromScale(scale, params.data[2], 12);
          },
        },
      }],
      tooltip: {
        formatter: (p) => `${stages[p.data[0]]} · ${months[p.data[1]]} ${year}<br/>${p.data[2]} runs`,
      },
    });
  }

  function bindYearNav({ minYear, maxYear, stateKey, onChange, prevId, nextId }) {
    const prevBtn = document.getElementById(prevId);
    const nextBtn = document.getElementById(nextId);
    const syncButtons = () => {
      if (prevBtn) prevBtn.disabled = activityYearState[stateKey] <= minYear;
      if (nextBtn) nextBtn.disabled = activityYearState[stateKey] >= maxYear;
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (activityYearState[stateKey] > minYear) {
          activityYearState[stateKey] -= 1;
          onChange(activityYearState[stateKey]);
          syncButtons();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (activityYearState[stateKey] < maxYear) {
          activityYearState[stateKey] += 1;
          onChange(activityYearState[stateKey]);
          syncButtons();
        }
      });
    }
    syncButtons();
  }

  function initActivityCharts() {
    if (typeof echarts === 'undefined') return;

    const calendarEl = document.getElementById('calendar');
    const cartesianEl = document.getElementById('cartesian');
    if (!calendarEl || !cartesianEl) return;

    const startYear = activityYearState.calendar;

    overviewCalendarChart = echarts.init(calendarEl, null, { renderer: 'canvas' });
    overviewCalendarChart.setOption({
      backgroundColor: CHART.bg,
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: CHART.border,
        textStyle: { color: '#1a1a1a', fontSize: 12 },
      },
      calendar: {
        range: startYear,
        cellSize: ['auto', 11],
        top: 8,
        left: 16,
        right: 8,
        bottom: 8,
        itemStyle: {
          borderWidth: 2,
          borderColor: '#ffffff',
          color: CHART.grid,
        },
        yearLabel: { show: false },
        monthLabel: {
          color: CHART.text,
          fontSize: 10,
          nameMap: 'en',
          margin: 8,
        },
        dayLabel: {
          firstDay: 0,
          color: CHART.text,
          fontSize: 9,
          nameMap: ['', 'M', '', 'W', '', 'F', ''],
        },
        splitLine: { show: false },
      },
      series: [{
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: [],
      }],
    });
    renderOverviewCalendar(startYear);

    const pipelineYear = activityYearState.pipeline;
    const initialPipeline = buildPipelineDataForYear(pipelineYear);
    const stageColors = initialPipeline.stages.map((stage) =>
      getBranchCssColor(PIPELINE_STAGE_BRANCHES[stage] || 'main'),
    );

    overviewPipelineChart = echarts.init(cartesianEl, null, { renderer: 'canvas' });
    overviewPipelineChart.setOption({
      backgroundColor: CHART.bg,
      grid: { top: 8, left: 48, right: 12, bottom: 32 },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: CHART.border,
        textStyle: { color: '#1a1a1a', fontSize: 12 },
      },
      xAxis: {
        type: 'category',
        data: initialPipeline.stages,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: CHART.text,
          fontSize: 10,
          margin: 10,
          rich: Object.fromEntries(
            initialPipeline.stages.map((stage, i) => [`s${i}`, { color: stageColors[i], fontWeight: 500 }]),
          ),
          formatter: (value, idx) => `{s${idx}|${value}}`,
        },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: initialPipeline.months,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: CHART.text, fontSize: 10, margin: 8 },
        splitArea: { show: false },
      },
      series: [{
        type: 'heatmap',
        data: initialPipeline.data,
        itemStyle: {
          borderWidth: 3,
          borderColor: '#ffffff',
          color: (params) => {
            const stageIdx = params.data[0];
            const branchId = PIPELINE_STAGE_BRANCHES[initialPipeline.stages[stageIdx]] || 'main';
            const scale = branchHeatmapScale(getBranchCssColor(branchId));
            return heatmapColorFromScale(scale, params.data[2], 12);
          },
        },
        emphasis: {
          itemStyle: { borderColor: CHART.border },
        },
      }],
    });
    renderOverviewPipeline(pipelineYear);

    activityCharts.push(overviewCalendarChart, overviewPipelineChart);

    const minYear = ACTIVITY_YEARS[0];
    const maxYear = ACTIVITY_YEARS[ACTIVITY_YEARS.length - 1];
    bindYearNav({
      minYear,
      maxYear,
      stateKey: 'calendar',
      onChange: renderOverviewCalendar,
      prevId: 'calendar-year-prev',
      nextId: 'calendar-year-next',
    });
    bindYearNav({
      minYear,
      maxYear,
      stateKey: 'pipeline',
      onChange: renderOverviewPipeline,
      prevId: 'pipeline-year-prev',
      nextId: 'pipeline-year-next',
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        activityCharts.forEach((c) => c.resize());
      }, 120);
    });
  }

  function initSiteNav() {
    window.addEventListener('fwj:panel-nav', (e) => {
      const id = e.detail?.id || '';
      if (id.startsWith('timeline-')) {
        applyTimelineDeepLink(`#${id}`);
      }
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash;
      if (h.startsWith('#timeline-')) {
        applyTimelineDeepLink(h);
      }
    });
  }

  function initNavHighlight() {
    window.fwjSyncNavHighlight?.();
  }

  async function boot() {
    init();
    await loadHistoricalNetWorth();
    initTimelineGitgraph();
    renderActivityBranches();
    initActivityCharts();
    await loadForbesProfiles();
    renderActivityRankGrid(forbesProfiles);
    renderTimelineRankGrid(forbesProfiles);
    activitySyncEnabled = true;
    const section = TIMELINE_SECTIONS[timelineState.tabIndex];
    if (section) {
      timelineSyncLock = true;
      syncActivityFromTimeline(section.id, timelineState.branchFocus[section.id]);
      timelineSyncLock = false;
    }
    window.addEventListener('resize', () => {
      Object.values(timelineWealthCharts).forEach((chart) => chart?.resize());
      timelineGlobalMapChart?.resize();
      timelineGlobalBarChart?.resize();
    });
    if (pendingActivityProfile) {
      syncActivityFromProfile(pendingActivityProfile);
      syncTimelineFromProfile(pendingActivityProfile);
      pendingActivityProfile = null;
    } else if (forbesProfiles.length) {
      syncTimelineFromProfile(forbesProfiles[0]);
    }
    window.addEventListener('forbes:select', (e) => {
      const person = e.detail?.person || null;
      syncActivityFromProfile(person);
      syncTimelineFromProfile(person);
    });
    window.WealthActivity = { syncFromProfile: syncActivityFromProfile };
    initSiteNav();
    initNavHighlight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
