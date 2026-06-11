#!/usr/bin/env python3
"""Preprocess raw data for DVC pipeline."""

from __future__ import annotations

from pathlib import Path


def main() -> None:
    raw = Path("data/raw")
    out = Path("data/processed")
    out.mkdir(parents=True, exist_ok=True)
    print(f"[preprocess] raw={raw} -> processed={out}")


if __name__ == "__main__":
    main()
