# Contributing

Thanks for contributing to grok-repo-template!

## Getting Started

1. Fork and clone the repo
2. `uv sync` or `pip install -e ".[dev]"`
3. Create a branch: `feat/my-feature`
4. Run tests: `pytest tests/`
5. Run lint: `ruff check .`

## Conventional Commits

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` maintenance

## Pull Requests

Use the PR template. Ensure CI passes (lint, test, Docker build).

## Domain Examples

When adding examples, follow the pattern in `examples/vision/`:
README.md + configs/ + src/ or top-level scripts.

## Grok / Colossus

Update `LLMS.md` and `metadata.yaml` when adding new entrypoints or domains.
