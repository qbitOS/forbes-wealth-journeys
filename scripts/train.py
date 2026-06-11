#!/usr/bin/env python3
"""Main training entrypoint — Colossus/Dojo compatible."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train model")
    parser.add_argument("--config", type=Path, default=Path("configs/default.yaml"))
    args = parser.parse_args()
    print(f"[train] config={args.config} — implement training loop here")


if __name__ == "__main__":
    main()
