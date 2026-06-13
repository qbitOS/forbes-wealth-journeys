# Forbes Wealth Journeys — Color System

Design tokens for the **industry-stream** dark terminal theme and crossover visualizations. Tokens live in `docs/assets/fwj-tokens.css` as `--fwj-*` custom properties; charts read them via `docs/assets/fwj-color.js`.

---

## Reference analysis

### 1. Current site + crossover dark theme

The existing industry-stream page uses a **Tokyo Night–inspired terminal palette**: deep charcoal backgrounds (`#0f1114`), elevated panels, monospace tickers, and neon-ish semantic greens/reds for MACD bias. This matches the **financial terminal / data-viz aesthetic** (dense panels, high information density, dark canvas).

**Takeaway:** Keep dark-only chart backgrounds (Carbon “Gray 100 tier”), strong surface separation, and tabular numerals. Avoid decorative color — every hue should encode data.

### 2. Financial terminal imagery (Asset Servicing Times reference)

Classic terminal UIs use:

- Near-black canvas with subtle grid lines
- Amber/gold for labels and key metrics
- Green/red for up/down (never as the only signal)
- Blue for selection / focus / links

**Takeaway:** `--fwj-gold` for timeframe labels (Q) and squeeze highlights; `--fwj-accent` (cool blue) for focus and links; bull/bear as diverging pair with text labels.

### 3. Bloomberg density vs simplification (Ginetta / Avaloq)

Bloomberg pioneered information-dense finance UIs; the Ginetta article argues for **simplification without losing depth**:

| Pattern | Forbes application |
|--------|---------------------|
| **Categorical** | Timeframes (Q/M/W/D), stream kinds, venture branches |
| **Sequential** | Heatmap activity, squeeze score tiers |
| **Diverging** | Bullish vs bearish MACD / flip bias |
| **Comparison** | Secondary palette for sector/group overlays |

**Takeaway:** Fixed colors per category (mental map). Primary palette for timeframes/branches; semantic green/red only for bias. Progressive disclosure (accordions, drawer feed) reduces simultaneous color load.

### 4. Material Design — data visualization style

Material emphasizes:

- Color for **category**, **quantity**, **highlight**, and **meaning** — used sparingly for highlights
- **Never color alone** — pair with labels, shapes, or icons
- Accessible alternatives: contrast, texture, direct labeling

**Takeaway:** Stream feed uses **left rail + kind label**; flip pills show `MACD↑` text; compression cards use score number + tier color.

### 5. IBM Design Language / Carbon charts

Carbon organizes charts by goal (comparison, trend, part-to-whole, correlation). For Forbes:

- **Heatmaps** → correlation / activity density (sequential scale)
- **Overlay lines** → trend comparison (categorical series palette)
- **Flip walls** → change-over-time markers (timeframe + type encoding)

Carbon restricts chart backgrounds to **lightest or darkest theme tier** for maximum series contrast.

### 6. Carbon accessibility (Shixie / Medium)

Key principles applied:

| Requirement | Implementation |
|-------------|----------------|
| WCAG 2.1 **4.5:1** body text | `--fwj-text` (#e8eaed) on `--fwj-bg` (~15:1); `--fwj-text-muted` (#9aa0a6) (~5.8:1) |
| **3:1** non-text graphics | Chart series and heatmap cells use brighter `--fwj-*` values on dark bg |
| Categorical **colorblind safety** | Palette mixes warm (gold, orange, coral) and cool (blue, teal, violet) — not red/green-only |
| Neighbor contrast | 2px **background-color dividers** on calendar heatmap cells (`borderColor: --fwj-heatmap-track`) |
| Color-agnostic cues | Text flip labels, `data-kind` / `data-bias` attributes, branch left borders |

Carbon’s extended **yellow/orange spectrum** informs `--fwj-branch-terrafab` and squeeze-mid tier.

---

## Token catalog

### Surfaces

| Token | Value | Use |
|-------|-------|-----|
| `--fwj-bg` | `#0f1114` | Page background |
| `--fwj-bg-elevated` | `#12151a` | Chart canvas |
| `--fwj-surface` | `#171a1f` | Cards, stream rows |
| `--fwj-surface-raised` | `#1e2229` | Nested panels |
| `--fwj-border` | `#2a3038` | Borders, axis lines |
| `--fwj-header` | `rgba(15,17,20,0.92)` | Sticky header |

### Typography

| Token | Value | Contrast on bg |
|-------|-------|----------------|
| `--fwj-text` | `#e8eaed` | ~15:1 ✓ |
| `--fwj-text-secondary` | `#b8bcc4` | ~9:1 ✓ |
| `--fwj-text-muted` | `#9aa0a6` | ~5.8:1 ✓ |

### Semantic market (diverging)

| Token | Value | Use |
|-------|-------|-----|
| `--fwj-bull` | `#42d392` | MACD bullish, positive bias |
| `--fwj-bear` | `#f07178` | MACD bearish, breakdown |
| `--fwj-neutral` | `#8b939e` | Empty / unknown bias |
| `--fwj-*-dim` | 12–15% alpha | Pill/chip backgrounds |

### Timeframes (categorical)

| Token | Hue | TF |
|-------|-----|-----|
| `--fwj-tf-quarter` | Gold `#e6c068` | Q |
| `--fwj-tf-month` | Blue `#78a9ff` | M |
| `--fwj-tf-week` | Green `#42d392` | W |
| `--fwj-tf-day` | Violet `#c6a0f6` | D |
| `--fwj-tf-5h` | Coral `#ff8389` | 5h |
| `--fwj-tf-1h` | Teal `#42beaa` | 1h |

### Venture branches

| Token | Branch |
|-------|--------|
| `--fwj-branch-colossus` | Colossus (green) |
| `--fwj-branch-terrafab` | Terrafab (orange) |
| `--fwj-branch-grok` | Grok (blue) |
| `--fwj-branch-spacex` | SpaceX IPO (purple) |
| `--fwj-branch-tesla` | Tesla (coral) |
| `--fwj-branch-spacex-ops` | SpaceX ops (light blue) |

### Squeeze tiers (sequential)

| Token | Level |
|-------|-------|
| `--fwj-squeeze-high` | High compression (green) |
| `--fwj-squeeze-mid` | Mid (gold) |
| `--fwj-squeeze-low` | Low (muted) |

### Stream feed kinds

| Token | Kind |
|-------|------|
| `--fwj-kind-flip` | Crossover flip |
| `--fwj-kind-grok` | Grok branch event |
| `--fwj-kind-milestone` | Forbes milestone |
| `--fwj-kind-world` | World context |

### Chart series

`--fwj-chart-1` … `--fwj-chart-14` — Carbon-inspired categorical palette for multi-symbol overlay lines.

### Heatmap sequential

Empty cell → low → high via `FWJColor.heatmapScale(branchColor)`:

```
--fwj-heatmap-empty → 20% tint → 53% tint → full branch color
```

---

## File map

| File | Role |
|------|------|
| `docs/assets/fwj-tokens.css` | Source of truth for `--fwj-*` |
| `docs/assets/fwj-color.js` | Runtime token reader for ECharts/canvas |
| `docs/assets/industry-stream.css` | Imports tokens; legacy `--bg` aliases; component styles |
| `docs/assets/timeline-cluster.js` | Sector heatmaps — uses `FWJColor` |
| `docs/assets/flip-overlay-chart.js` | Overlay + flip walls — uses `FWJColor` |
| `docs/assets/industry-stream.js` | Stream feed kinds — uses `FWJColor` |

Main Forbes site (`docs/assets/pages.css`) keeps its **light theme** and `--branch-*` tokens. Future work: import `fwj-tokens.css` under a `[data-theme="dark"]` scope or shared branch aliases.

---

## Before / after (industry-stream MVP)

| Area | Before | After |
|------|--------|-------|
| Token source | Scattered hex in CSS + JS | Central `--fwj-*` + `FWJColor` helper |
| Stream kinds | Inline hex in JS | CSS `data-kind` rails + token-backed JS |
| Compression scores | Generic bull/gold/muted | Named squeeze tier tokens |
| Branch chips | Single green chip | Per-branch warm/cool colors |
| Heatmaps | Hardcoded `#12151a` / `#1a1f28` | Theme object from tokens |
| Flip overlay | 23-color ad hoc palette | 14-color Carbon-aligned `--fwj-chart-*` |
| Accessibility | Implicit | Documented contrast; bias always labeled |

---

## Usage

```css
@import url("fwj-tokens.css");

.my-card {
  background: var(--fwj-surface);
  border: 1px solid var(--fwj-border);
  color: var(--fwj-text);
}
```

```javascript
const accent = FWJColor.token('--fwj-accent');
const tfColor = FWJColor.timeframe('month');
const series = FWJColor.chartPalette();
```

Rebuild static data after pipeline changes: `python3 scripts/build_industry_stream.py`
