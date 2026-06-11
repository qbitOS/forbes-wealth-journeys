# Colossus Cluster Setup

Detailed guide for running pipelines on xAI's Colossus supercluster.

## Overview

- 100k–200k+ H100 GPUs, liquid cooling, RDMA Ethernet
- JAX multi-host distributed training
- SLURM/K8s job submission

## Key Files

| File | Purpose |
|------|---------|
| `configs/colossus.yaml` | Node/GPU scaling |
| `scripts/colossus/colossus-job.sh` | SLURM job script |
| `scripts/colossus-launch.sh` | Launch wrapper |
| `Dockerfiles/Dockerfile.colossus` | Colossus CUDA/JAX image |

## Quick Launch

```bash
sbatch scripts/colossus/colossus-job.sh
# or
./scripts/colossus-launch.sh configs/colossus.yaml
```

## Domain Examples

- Vision: `examples/vision/`
- Agents: `examples/agents/`
- Fine-tuning: `examples/fine-tuning/`
- JAX MoE: `examples/jax-colossus/`

## DVC + Grok Connectors

Integrate DVC artifact paths with Grok connector pipelines in `scripts/connectors/`.

See also: [COLOSSUS_SETUP.md](./COLOSSUS_SETUP.md)
