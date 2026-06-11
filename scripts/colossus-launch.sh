#!/usr/bin/env bash
# Colossus cluster launch wrapper — SLURM/K8s entrypoint
set -euo pipefail

CONFIG="${1:-configs/colossus.yaml}"
echo "[colossus-launch] config=${CONFIG}"
echo "Submit job via scripts/colossus/colossus-job.sh or your scheduler."
