#!/usr/bin/env python3
"""Inference and validation entrypoint."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run inference")
    parser.add_argument("--config", type=Path, default=Path("configs/default.yaml"))
    parser.add_argument("--validate", action="store_true", help="Run validation stage")
    args = parser.parse_args()
    mode = "validate" if args.validate else "infer"
    print(f"[{mode}] config={args.config} — implement inference here")


if __name__ == "__main__":
    main()
