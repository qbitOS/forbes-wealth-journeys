# GitHub Pages Template Configurator

Interactive wizard on [GitHub Pages](https://fornevercollective.github.io/grok-repo-template/) for bootstrapping Grok-optimized projects from `grok-repo-template`.

## Purpose

The configurator is an **auto-configuration first-prompt jumping off point**. Users (and Grok GitHub connectors) pick domains, infrastructure, and ecosystem paths, then copy or download structured output that routes agents to the fastest GitHub search pipe for SpaceX/Terrafab/Grok/SuperHeavy server paths (Grokipedia, X.com, X.ai, Imagine, Colossus, etc.).

## UX Flow

1. **Landing** → "Configure your template" hero section
2. **Step 1 — Domains** — vision, agents, fine-tuning, jax-colossus, rust-dojo, python-grok, CUDA kernels, DVC, Colossus, connectors, standards
3. **Step 2 — Infrastructure** — Colossus, DVC, Docker, CI/CD
4. **Step 3 — Connectors & ecosystem** — Grok skills + Grokipedia / X.com / X.ai / Imagine / SpaceX-Terrafab / SuperHeavyGrok paths
5. **Step 4 — Export** — first-prompt markdown, JSON, `metadata.yaml`, `llms.txt` hints

## Export Formats

| Format | Use case |
|--------|----------|
| **First prompt (markdown)** | Paste into Grok chat or GitHub connector as the bootstrap instruction |
| **JSON manifest** | Machine-readable config; download as `{project}-manifest.json` |
| **metadata.yaml snippet** | Merge into project root; compatible with template `metadata.yaml` |
| **llms.txt hints** | Append to or merge with root `llms.txt` per [llmstxt.org](https://llmstxt.org/) |

Each export includes:

- Selected `.grok/skills/` paths
- Priority repo paths with deep links
- Optimized `repo:fornevercollective/grok-repo-template …` GitHub code search query
- Connector hook IDs (Grok GitHub active; Cursor / terminal placeholders)

## How Connectors Should Consume Output

### Grok GitHub connector

1. User completes wizard on Pages (or connector opens Pages URL with future query-param presets).
2. Copy **First prompt** tab → inject as first message in Grok Build session.
3. Optionally attach **JSON manifest** or **metadata.yaml** as repo bootstrap files.
4. Run `grok inspect` after clone to verify skills listed in export.

### Programmatic (future)

```json
{
  "agent_hooks": {
    "grok_github": { "id": "grok-github-connector", "status": "active", "inject": "first_prompt" },
    "cursor_agent": { "id": "cursor-agent-placeholder", "status": "coming_soon" },
    "terminal_agent": { "id": "terminal-agent-placeholder", "status": "coming_soon" }
  }
}
```

Connectors can parse JSON export `project.priority_paths`, `project.github_search`, and `project.grok_skills` without scraping the UI.

## Implementation

- **Static only** — no backend; all logic in `docs/assets/pages-configurator.js`
- **Deployed via** `.github/workflows/pages.yml` (entire repo root as artifact)
- **Styles** — dark theme aligned with `docs/assets/banner.svg` (#0f0f12, #8af accent)

## Local preview

```bash
python -m http.server 8080
# open http://localhost:8080/
```

## Related files

- `index.html` — landing + wizard + ECharts
- `metadata.yaml` — template routing manifest (includes `pages_configurator` URL)
- `standards/xai-spacex-terrafab-grokipedia.md` — ecosystem standards reference
- `scripts/connectors/` — connector pipeline stubs referenced in exports
