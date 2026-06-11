# Colossus Setup (Quick Reference)

> Full guide: [colossus-cluster-setup.md](./colossus-cluster-setup.md)

## Key Features

- JAX distributed training
- Multi-node SLURM jobs
- Integration with DVC
- Docker image: `Dockerfiles/Dockerfile.colossus`

## Entry Points

- `scripts/colossus/colossus-job.sh` — SLURM submission
- `scripts/colossus-launch.sh` — launch wrapper
- `configs/colossus.yaml` — scaling config