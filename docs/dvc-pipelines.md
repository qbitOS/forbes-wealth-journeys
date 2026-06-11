# DVC Pipelines Guide

This template uses [DVC](https://dvc.org/) for data versioning and reproducible pipelines.

## Pipeline Stages

Defined in `dvc.yaml`:

| Stage | Command | Outputs |
|-------|---------|---------|
| explore | `scripts/explore_dvc.py` | `data/explore/` |
| preprocess | `scripts/preprocess.py` | `data/processed/` |
| train | `scripts/train.py` | `models/checkpoint/` |
| validate | `scripts/infer.py --validate` | `models/validation_report.json` |

## Commands

```bash
dvc init          # first-time setup
dvc repro           # run full pipeline
dvc repro explore   # single stage
dvc push            # sync to remote
```

## Colossus Integration

Large artifacts stay off git — use DVC remote (S3/GCS) compatible with Colossus data ingestion.
See `metadata.yaml` and `docs/colossus-cluster-setup.md`.
