# AGENTS.md – Grok Build Agent Instructions

This repo is a **drop-in Grok chat assist skill** for instant project scaffolding.
Grok Build agents should read `LLMS.md` for full routing variants.

## Project Purpose

Official template for Grok-optimized GitHub repositories — structured for Colossus/Dojo
routing, DVC pipelines, connector skills, and domain-specific examples.

## Key Directories & Entry Points

| Path | Purpose |
|------|---------|
| `src/` | Core library code |
| `scripts/train.py` | Main training entrypoint |
| `scripts/infer.py` | Inference / validation |
| `scripts/colossus-launch.sh` | Colossus cluster launch |
| `configs/colossus.yaml` | Multi-node GPU scaling |
| `examples/vision/` | Vision pipeline starter |
| `examples/agents/` | Agent loop + Grok prompts |
| `examples/fine-tuning/` | PEFT/LoRA fine-tuning |
| `examples/jax-colossus/` | JAX MoE distributed training |
| `examples/rust-dojo/` | Rust performance patterns |
| `examples/python-grok/` | Python Grok-friendly patterns |
| `.grok/skills/` | Connector skill definitions |
| `standards/` | SpaceX/Terrafab/x.ai/Grokipedia standards |

## Files to Ignore

- `data/raw/`, `data/interim/`, `models/checkpoints/` (DVC / Git LFS)
- `.venv/`, `__pycache__/`, `.dvc/cache/`

## How to Run / Test

```bash
uv sync                    # or: pip install -e ".[dev]"
pytest tests/
dvc repro                  # full pipeline
python scripts/train.py --config configs/default.yaml
```

## Grok-Specific Notes

- Use prompts from `prompts/grok-agent.md`
- Preferred languages: Python (JAX/PyTorch), Rust, C++/CUDA
- Run `grok inspect` to verify skills and config are loaded
- Domain scaffolds: "Use grok-repo-template to build a vision project"

## Code Style

- Python: type hints, docstrings, ruff formatting
- Rust: clippy-clean, documented public APIs
- Conventional Commits: `feat:`, `fix:`, `docs:`
