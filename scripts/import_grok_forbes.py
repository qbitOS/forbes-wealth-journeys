#!/usr/bin/env python3
"""Import Grok-curated Forbes billionaire profiles into the dataset."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = REPO_ROOT / "data" / "forbes-billionaires.json"
REQUIRED_FIELDS = frozenset({"rank", "name", "netWorth", "timeline"})


def validate_entry(entry: Any, index: int) -> None:
    if not isinstance(entry, dict):
        raise ValueError(f"Entry {index} must be an object")

    missing = REQUIRED_FIELDS - entry.keys()
    if missing:
        raise ValueError(f"Entry {index} ({entry.get('name', '?')}) missing fields: {sorted(missing)}")

    if not isinstance(entry["rank"], int):
        raise ValueError(f"Entry {index} rank must be an integer")

    if not isinstance(entry["name"], str) or not entry["name"].strip():
        raise ValueError(f"Entry {index} name must be a non-empty string")

    if not isinstance(entry["netWorth"], str) or not entry["netWorth"].strip():
        raise ValueError(f"Entry {index} netWorth must be a non-empty string")

    timeline = entry["timeline"]
    if not isinstance(timeline, list) or len(timeline) < 1:
        raise ValueError(f"Entry {index} timeline must be a non-empty array")

    for event_index, event in enumerate(timeline):
        if not isinstance(event, dict):
            raise ValueError(f"Entry {index} timeline[{event_index}] must be an object")
        for key in ("year", "title", "description", "impact"):
            if key not in event or not str(event[key]).strip():
                raise ValueError(
                    f"Entry {index} timeline[{event_index}] missing or empty '{key}'"
                )


def validate_dataset(data: Any) -> list[dict[str, Any]]:
    if not isinstance(data, list):
        raise ValueError("Root JSON must be an array of billionaire objects")
    if not data:
        raise ValueError("Dataset must contain at least one entry")

    for index, entry in enumerate(data):
        validate_entry(entry, index)

    return data


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replace data/forbes-billionaires.json with a Grok-curated export."
    )
    parser.add_argument(
        "source",
        type=Path,
        help="Path to JSON file containing billionaire profiles",
    )
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if not source.is_file():
        print(f"Error: file not found: {source}", file=sys.stderr)
        sys.exit(1)

    try:
        with source.open(encoding="utf-8") as handle:
            data = json.load(handle)
        entries = validate_dataset(data)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Imported {len(entries)} entries -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
