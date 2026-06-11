#!/usr/bin/env python3
"""DVC explore stage — data profiling and EDA outputs."""

from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    raw = Path("data/raw")
    explore = Path("data/explore")
    explore.mkdir(parents=True, exist_ok=True)
    report = {"raw_files": len(list(raw.glob("*"))) if raw.exists() else 0, "status": "explore_stub"}
    (explore / "profile.json").write_text(json.dumps(report, indent=2))
    print(f"[explore] wrote {explore / 'profile.json'}")


if __name__ == "__main__":
    main()
