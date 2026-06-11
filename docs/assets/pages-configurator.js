/**
 * grok-repo-template — GitHub Pages template configurator
 * Static client-side wizard → auto-config prompt + manifest exports
 */
(function () {
  'use strict';

  const REPO = 'fornevercollective/grok-repo-template';
  const REPO_BASE = `https://github.com/${REPO}`;
  const PAGES_URL = 'https://fornevercollective.github.io/grok-repo-template/';

  const DOMAINS = [
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
