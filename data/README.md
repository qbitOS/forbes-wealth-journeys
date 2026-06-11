# data/

DVC-tracked data layout (Cookiecutter-style):

- `raw/` — immutable source data (DVC or Git LFS)
- `interim/` — intermediate transforms
- `processed/` — model-ready datasets
- `explore/` — EDA outputs from `dvc repro explore`

Do not commit large files directly — use DVC remotes.
