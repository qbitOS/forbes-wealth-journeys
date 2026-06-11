# LLMS.md – Instructions for Grok & AI Agents

> Canonical agent instructions. See also: `AGENTS.md`, `llms.txt`, `ReadMe.LLM`

## Project Purpose

Grok-native GitHub template for AI/ML projects routed through Colossus/Dojo training
pipelines. Use this repo as a skill to scaffold new vision, agent, or fine-tuning projects.

## Route 1: Standard Grok Parsing

**Key directories:** `src/`, `examples/`, `configs/`, `scripts/`

**Ignore:** `data/raw/`, `models/checkpoints/`, `.dvc/cache/`

**Run:**
```bash
uv run scripts/train.py --config configs/default.yaml
dvc repro
```

## Route 2: Vision-Specific

See `examples/vision/pipeline.py` and `examples/vision/configs/vision.yaml`.
Use Grok vision prompts from `examples/vision/README.md`.

## Route 3: Agent Loop

See `examples/agents/agent_loop.py` + `examples/agents/prompts/`.
Config: `examples/agents/configs/agent.yaml`

## Route 4: Fine-Tuning

See `examples/fine-tuning/peft_lora.py` and `examples/fine-tuning/dataset.py`.
Config: `examples/fine-tuning/configs/finetune.yaml`

## Route 5: JAX / Colossus Distributed

See `examples/jax-colossus/` for MoE + multi-host JAX patterns.
Launch: `scripts/colossus/colossus-job.sh`

## Route 6: Rust / Dojo Performance

See `examples/rust-dojo/src/` for low-latency Rust patterns.

## Route 7: Python Grok Patterns

See `examples/python-grok/src/` for type-hinted, docstring-heavy Python.

## Grok Connector Skills

Skills in `.grok/skills/` cover: GitHub, web_search, browse_page, code_execution, X tools.

## Standards Integration

See `standards/xai-spacex-terrafab-grokipedia.md` for org-wide compliance workflows.

## Metadata

Machine-readable manifest: `metadata.yaml`
