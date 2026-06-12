# data/

DVC-tracked data layout (Cookiecutter-style):

- `raw/` — immutable source data (DVC or Git LFS)
- `interim/` — intermediate transforms
- `processed/` — model-ready datasets
- `explore/` — EDA outputs from `dvc repro explore`
- **`forbes-billionaires.json`** — Forbes wealth journey profiles (rank, net worth, timeline milestones)

Do not commit large files directly — use DVC remotes.

## Forbes billionaire dataset

[`forbes-billionaires.json`](forbes-billionaires.json) powers the **Forbes** section on GitHub Pages. Each entry:

```json
{
  "rank": 1,
  "name": "Elon Musk",
  "netWorth": "794.6B",
  "age": 55,
  "country": "United States",
  "sector": "Technology",
  "companies": ["Tesla", "SpaceX"],
  "sourceOfWealth": "Tesla, SpaceX",
  "firstFortuneDecade": "1990s",
  "summary": "…",
  "timeline": [
    { "year": "1995", "title": "…", "description": "…", "impact": "…" }
  ]
}
```

Append objects to the array to expand toward Forbes 500. The UI loads via `fetch('data/forbes-billionaires.json')` in [`docs/assets/forbes-wealth.js`](../docs/assets/forbes-wealth.js).
