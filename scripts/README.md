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
| `build_market_crossover.py` | Join Forbes holdings to flip-board crossover rows |
| `build_industry_stream.py` | Merge stream JSON for industry-stream.html |
