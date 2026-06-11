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
    window.scrollTo({ top: $('#configurator').offsetTop - 20, behavior: 'smooth' });
  }

  function init() {
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
    { sort: '2025-11', date: 'Nov 2025', branch: 'grok', id: 'grok-4-1', title: 'Grok 4.1 · EQ-Bench lead', approx: false },
    { sort: '2026-01', date: 'Jan 2026', branch: 'colossus', id: 'colossus-2-gw', title: 'Colossus 2 · ~1 GW online', approx: true },
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
    { sort: '2026-02', date: 'Feb 2026', branch: 'tesla', id: 'cybercab-line', title: 'First Cybercab · Giga Texas', approx: false },
    { sort: '2026-02', date: 'Feb 2026', branch: 'spacex-ops', id: 'starlink-10m', title: '10M+ Starlink subscribers', approx: true },
    { sort: '2026-03', date: 'Mar 2026', branch: 'x-corp', id: 'imagine-paywall', title: 'Imagine → SuperGrok paywall', approx: false },
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

  function mergeBranchEvents(baseEvents, branchId) {
    const drill = TIMELINE_DRILLDOWN_EVENTS[branchId] || [];
    const merged = [...baseEvents.filter((e) => e.branch === branchId), ...drill];
    return merged.sort((a, b) => a.sort.localeCompare(b.sort) || a.id.localeCompare(b.id));
  }

  function renderDrilldownList(events, branchId, container) {
    if (!container) return;
    const color = getBranchCssColor(branchId);
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
          const tag = ev.drilldown ? ' <span class="timeline-drilldown-tag">detail</span>' : '';
          const mergeCls = ev.merge ? ' is-merge' : '';
          return `<li class="timeline-drilldown-item${mergeCls}">
            <span class="timeline-drilldown-dot branch-${ev.branch}"></span>
            <div class="timeline-drilldown-body">
              <time class="timeline-drilldown-date">${ev.date}</time>
              <span class="timeline-drilldown-id">${ev.id}</span>${approx}${tag}
              <p class="timeline-drilldown-desc">${ev.title}</p>
            </div>
          </li>`;
        }).join('')}
      </ol>`;
  }

  function renderTimelineGitgraph({ branches, events, containerId, legendId, singleBranch }) {
    const container = document.getElementById(containerId);
    const legendEl = legendId ? document.getElementById(legendId) : null;
    if (!container) return;

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
        `<span class="legend-item"><span class="legend-swatch" style="background:${getBranchCssColor(b.id)}"></span>${b.label}</span>`
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
        if (ev.merge) dot.style.color = activeBranches.find((b) => b.id === ev.branch)?.color || '#525252';

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
        branchEl.dispatchEvent(new Event('toggle'));
      }
    }
  }

  function setTimelineTab(index, { syncActivity = true } = {}) {
    const tabs = TIMELINE_SECTIONS;
    const clamped = Math.max(0, Math.min(tabs.length - 1, index));
    timelineState.tabIndex = clamped;
    const section = tabs[clamped];

    const tabBtns = document.querySelectorAll('.timeline-tab-btn');
    const panels = document.querySelectorAll('.timeline-tab-panel');
    tabBtns.forEach((btn, i) => {
      const selected = i === clamped;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel, i) => {
      const active = i === clamped;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });

    const prevBtn = document.getElementById('timeline-tab-prev');
    const nextBtn = document.getElementById('timeline-tab-next');
    if (prevBtn) prevBtn.disabled = clamped === 0;
    if (nextBtn) nextBtn.disabled = clamped === tabs.length - 1;

    const heading = document.getElementById('timeline-heading');
    const lead = document.getElementById('timeline-lead');
    if (heading) heading.textContent = section.heading;
    if (lead) lead.textContent = section.lead;

    syncActivityGroupHighlight(section.activityGroupId);
    renderTimelineSection(section);
    if (syncActivity) {
      syncActivityFromTimeline(section.id, timelineState.branchFocus[section.id]);
    }

    if (history.replaceState) {
      const branch = timelineState.branchFocus[section.id];
      const hash = branch === 'all' ? `#timeline-${section.id}` : `#timeline-${section.id}-${branch}`;
      history.replaceState(null, '', hash);
    }
  }

  function setTimelineBranch(sectionId, branchId) {
    timelineState.branchFocus[sectionId] = branchId;
    const section = TIMELINE_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return;

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
    syncActivityFromTimeline(sectionId, branchId);

    if (history.replaceState) {
      const hash = branchId === 'all' ? `#timeline-${sectionId}` : `#timeline-${sectionId}-${branchId}`;
      history.replaceState(null, '', hash);
    }
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
      pill.addEventListener('click', () => setTimelineBranch(section.id, pill.dataset.branch));
    });
  }

  function initTimelineTabs() {
    TIMELINE_SECTIONS.forEach((section) => renderTimelineCompanyPills(section));

    const tabList = document.querySelector('.timeline-tab-list');
    const prevBtn = document.getElementById('timeline-tab-prev');
    const nextBtn = document.getElementById('timeline-tab-next');

    document.querySelectorAll('.timeline-tab-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => setTimelineTab(i));
    });

    if (prevBtn) prevBtn.addEventListener('click', () => setTimelineTab(timelineState.tabIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => setTimelineTab(timelineState.tabIndex + 1));

    if (tabList) {
      let touchStartX = 0;
      tabList.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      tabList.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(dx) < 48) return;
        if (dx < 0) setTimelineTab(timelineState.tabIndex + 1);
        else setTimelineTab(timelineState.tabIndex - 1);
      }, { passive: true });
    }

    document.getElementById('timeline-tabs')?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setTimelineTab(timelineState.tabIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setTimelineTab(timelineState.tabIndex + 1);
      }
    });

    const hash = window.location.hash.slice(1);
    if (hash.startsWith('timeline-')) {
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
      if (section) {
        const valid = branchId === 'all' || section.branches.some((b) => b.id === branchId);
        if (!valid) branchId = 'all';
        timelineState.branchFocus[sectionId] = branchId;
        const tabIdx = TIMELINE_SECTIONS.findIndex((s) => s.id === sectionId);
        setTimelineTab(tabIdx >= 0 ? tabIdx : 0, { syncActivity: false });
        TIMELINE_SECTIONS.forEach((s) => renderTimelineCompanyPills(s));
        setTimelineBranch(sectionId, branchId);
        return;
      }
    }
    setTimelineTab(0, { syncActivity: false });
  }

  function initTimelineGitgraph() {
    initTimelineTabs();
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
      branchOpen: index === 0,
    }));

    root.innerHTML = groups.map((group) => {
      const branchPanels = group.branches.map((branch) => {
        const branchEvents = branchEventsFor(group.events, branch.id);
        const span = formatSortSpan(branchEvents);
        const openAttr = group.branchOpen ? ' open' : '';

        return `
          <details class="activity-branch" data-branch="${branch.id}"${openAttr}>
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
        if (!groupEl.open) return;
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
        if (!branchEl.open) return;
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

  const PIPELINE_STAGE_BRANCHES = {
    DVC: 'main',
    CI: 'colossus',
    Colossus: 'colossus',
    Grok: 'grok',
    Vision: 'terrafab',
    Agents: 'grok',
    FT: 'openai',
  };

  function heatmapColorFromScale(scale, value, max) {
    if (!value || value <= 0) return scale[0];
    const idx = Math.min(scale.length - 1, Math.round((value / max) * (scale.length - 1)));
    return scale[idx];
  }

  function initActivityCharts() {
    if (typeof echarts === 'undefined') return;

    const calendarEl = document.getElementById('calendar');
    const cartesianEl = document.getElementById('cartesian');
    if (!calendarEl || !cartesianEl) return;

    const year = new Date().getFullYear();
    const meta = document.getElementById('calendar-meta');
    if (meta) meta.textContent = String(year);

    const calendarScale = branchHeatmapScale(getBranchCssColor('grok'));

    const calendarData = [];
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        calendarData.push([
          `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          Math.floor(Math.random() * 8),
        ]);
      }
    }

    const cal = echarts.init(calendarEl, null, { renderer: 'canvas' });
    cal.setOption({
      backgroundColor: CHART.bg,
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: CHART.border,
        textStyle: { color: '#1a1a1a', fontSize: 12 },
        formatter: (p) => `${p.data[0]}<br/>${p.data[1]} events`,
      },
      visualMap: {
        min: 0,
        max: 8,
        show: false,
        inRange: { color: calendarScale },
      },
      calendar: {
        range: year,
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
        data: calendarData,
      }],
    });

    const stages = ['DVC', 'CI', 'Colossus', 'Grok', 'Vision', 'Agents', 'FT'];
    const weeks = ['W1', 'W2', 'W3', 'W4'];
    const pipelineData = [
      [0, 0, 5], [1, 0, 8], [2, 1, 3], [3, 2, 9],
      [4, 3, 2], [5, 1, 6], [6, 2, 4],
    ];
    const stageColors = stages.map((stage) => {
      const branchId = PIPELINE_STAGE_BRANCHES[stage] || 'main';
      return getBranchCssColor(branchId);
    });

    const cart = echarts.init(cartesianEl, null, { renderer: 'canvas' });
    cart.setOption({
      backgroundColor: CHART.bg,
      grid: { top: 8, left: 48, right: 12, bottom: 32 },
      tooltip: {
        backgroundColor: '#ffffff',
        borderColor: CHART.border,
        textStyle: { color: '#1a1a1a', fontSize: 12 },
        formatter: (p) => `${stages[p.data[0]]} · ${weeks[p.data[1]]}<br/>${p.data[2]} runs`,
      },
      xAxis: {
        type: 'category',
        data: stages,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: CHART.text,
          fontSize: 10,
          margin: 10,
          rich: Object.fromEntries(
            stages.map((stage, i) => [
              `s${i}`,
              { color: stageColors[i], fontWeight: 500 },
            ]),
          ),
          formatter: (value, idx) => `{s${idx}|${value}}`,
        },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: weeks,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: CHART.text, fontSize: 10, margin: 8 },
        splitArea: { show: false },
      },
      series: [{
        type: 'heatmap',
        data: pipelineData,
        itemStyle: {
          borderWidth: 3,
          borderColor: '#ffffff',
          color: (params) => {
            const stageIdx = params.data[0];
            const branchId = PIPELINE_STAGE_BRANCHES[stages[stageIdx]] || 'main';
            const scale = branchHeatmapScale(getBranchCssColor(branchId));
            return heatmapColorFromScale(scale, params.data[2], 10);
          },
        },
        emphasis: {
          itemStyle: { borderColor: CHART.border },
        },
      }],
    });

    activityCharts.push(cal, cart);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        activityCharts.forEach((c) => c.resize());
      }, 120);
    });
  }

  function initNavHighlight() {
    const navLinks = document.querySelectorAll('.site-nav a[href^="#"]');
    if (!navLinks.length) return;

    const sections = [...navLinks]
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    const sync = () => {
      const scrollY = window.scrollY + 100;
      let current = sections[0]?.id;
      sections.forEach((section) => {
        if (section.offsetTop <= scrollY) current = section.id;
      });
      navLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${current}`);
      });
    };

    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  function boot() {
    init();
    renderActivityBranches();
    initActivityCharts();
    initTimelineGitgraph();
    initNavHighlight();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
