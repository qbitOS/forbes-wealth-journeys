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

**Import full Grok JSON export:**

```bash
python scripts/import_grok_forbes.py /path/to/grok-export.json
```

Source thread: [Grok Forbes 500 Wealth Journeys](https://grok.com/share/bGVnYWN5LWNvcHk_90513d22-f9d1-4544-87f7-ca5db3b07748)
