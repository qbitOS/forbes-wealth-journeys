# scripts/

Entrypoint scripts for training, inference, DVC stages, and Colossus launch.

| Script | Purpose |
|--------|---------|
| `train.py` | Main training |
| `infer.py` | Inference / validation |
| `preprocess.py` | DVC preprocess stage |
| `explore_dvc.py` | DVC explore/EDA stage |
| `colossus-launch.sh` | Cluster launch wrapper |
| `colossus/colossus-job.sh` | SLURM job |
| `connectors/` | Grok connector pipeline stubs |
