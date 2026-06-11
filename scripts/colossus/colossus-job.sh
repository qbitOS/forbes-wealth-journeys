#!/usr/bin/env bash
# Colossus SLURM job script — multi-host JAX training
#SBATCH --job-name=grok-colossus
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=8
#SBATCH --gres=gpu:8
#SBATCH --time=24:00:00

set -euo pipefail

echo "Colossus job on $(hostname)"
echo "JAX multi-host: set JAX_PLATFORMS and coordinator address"
python scripts/train.py --config configs/colossus.yaml
