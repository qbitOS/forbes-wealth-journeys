# data/

DVC-tracked data layout (Cookiecutter-style):

- `raw/` — immutable source data (DVC or Git LFS)
- `interim/` — intermediate transforms
- `processed/` — model-ready datasets
- `explore/` — EDA outputs from `dvc repro explore`
- **`forbes-billionaires.json`** — Forbes wealth journey profiles (rank, net worth, timeline milestones)

Do not commit large files directly — use DVC remotes.

## Forbes billionaire dataset (schema v2)

[`forbes-billionaires.json`](forbes-billionaires.json) powers the **Forbes** section on GitHub Pages.

```json
{
  "rank": 1,
  "name": "Elon Musk",
  "netWorth": { "value": 794.6, "unit": "B", "currency": "USD", "asOf": "2026-06-11" },
  "age": 55,
  "country": "United States",
  "sector": "Technology",
  "grokipediaLink": "https://grok.x.ai/wiki/elon-musk",
  "forbesProfile": "https://www.forbes.com/profile/elon-musk/",
  "wikipediaLink": "https://en.wikipedia.org/wiki/Elon_Musk",
  "wealthBreakdown": [
    { "entity": "Tesla", "ticker": "TSLA", "stakePct": 12.8, "valueUsdB": 120, "type": "public" }
  ],
  "entities": [
    { "id": "tesla", "name": "Tesla", "role": "ceo", "founded": 2003, "status": "public", "ticker": "TSLA" }
  ],
  "summary": "…",
  "timeline": [
    {
      "year": "2002",
      "type": "founding",
      "entityId": "spacex",
      "title": "Founded SpaceX",
      "valuationUsdB": 350,
      "source": "https://www.spacex.com"
    }
  ]
}
```

**Migrate legacy v1 → v2:**

```bash
python scripts/migrate_forbes_v2.py
```

Append objects to the array to expand toward Forbes 500. The UI loads via `fetch('data/forbes-billionaires.json')` in [`docs/assets/forbes-wealth.js`](../docs/assets/forbes-wealth.js).

**Rebuild all 100 entries:**

```bash
python scripts/build_forbes_billionaires.py
```

**Import full Grok JSON export (replace entire dataset):**

```bash
python3 scripts/import_grok_forbes.py /path/to/grok-export.json
```

**Merge Grok enrichment by name (keeps Forbes rank & net worth):**

```bash
python3 scripts/merge_grok_enrichment.py data/grok-enrichment-7-20.json
```

**Rebuild entity catalog** from profiles + seed valuations:

```bash
python3 scripts/build_entities.py
```

[`market-crossover.json`](market-crossover.json) — Forbes rank holdings joined to crossover flip-board rows. Rebuild from local robinhood-agentic data:

```bash
python3 scripts/build_market_crossover.py
# optional rows path:
python3 scripts/build_market_crossover.py /path/to/robinhood-agentic/data/flip-board/rows.json
```

[`industry-stream.json`](industry-stream.json) — unified stream for `unified.html` (flips + milestones + Grok branches + world context + Q/M/W/D compression). Rebuild after market-crossover:

```bash
python3 scripts/build_industry_stream.py /path/to/robinhood-agentic/data/flip-board/rows.json
```

[`grok-branch-events.json`](grok-branch-events.json) — Grok cluster/portfolio timeline events (source for industry stream). Sync from robinhood-agentic when pages-configurator events change:

```bash
cp ../robinhood-agentic/data/grok-template-timeline-raw.json data/grok-branch-events.json
```

[`historical-net-worth.json`](historical-net-worth.json) — estimated net worth by year for all **100** Forbes ranks, keyed by rank (`"1"` … `"100"`). Loaded in the Story tab line chart:

```json
{
  "1": [
    { "year": 1987, "netWorthB": 0.1 },
    { "year": 2026, "netWorthB": 794.6 }
  ]
}
```

[`13f-top20.json`](13f-top20.json) — public 13F / insider holdings for enriched profiles (ticker, shares, valueUsdB, pctPortfolio). Rank keys match `forbes-billionaires.json`. Shown under **Portfolio**:

```json
{
  "rank": 1,
  "name": "Elon Musk",
  "holdings": [
    { "ticker": "TSLA", "shares": 300000000, "valueUsdB": 120, "pctPortfolio": 40 }
  ]
}
```

[`entities.json`](entities.json) — deduplicated companies (`id`, `name`, `ticker`, `valuationUsdB`, `status`) extracted from billionaire profiles. Rebuild after merges:

```bash
python3 scripts/build_entities.py
```

Source thread: [Grok Forbes 500 Wealth Journeys](https://grok.com/share/bGVnYWN5LWNvcHk_90513d22-f9d1-4544-87f7-ca5db3b07748)
