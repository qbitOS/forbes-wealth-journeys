#!/usr/bin/env python3
"""Merge Grok-enriched billionaire profiles into forbes-billionaires.json by name."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "forbes-billionaires.json"

ENRICHMENT_KEYS = frozenset(
    {
        "wealthBreakdown",
        "entities",
        "timeline",
        "summary",
        "grokipediaLink",
        "forbesProfile",
        "wikipediaLink",
        "sector",
        "country",
        "age",
    }
)

# Grok short names -> Forbes dataset names
NAME_ALIASES: dict[str, str] = {
    "carlos slim": "Carlos Slim Helu & family",
    "jim walton": "Jim Walton & family",
    "françoise bettencourt meyers": "Francoise Bettencourt Meyers & family",
    "francoise bettencourt meyers": "Francoise Bettencourt Meyers & family",
    "charles koch": "Charles Koch & family",
    "german larrea mota velasco": "Germán Larrea Mota Velasco & family",
    "germán larrea mota velasco": "Germán Larrea Mota Velasco & family",
    "tadashi yanai": "Tadashi Yanai & family",
    "miriam adelson": "Miriam Adelson & family",
    "thomas frist jr": "Thomas Frist Jr & family",
    "he xiangjian": "He Xiangjian & family",
    "savitri jindal": "Savitri Jindal & family",
    "k p singh": "K.P. Singh",
    "n r narayana murthy": "N. R. Narayana Murthy",
}


def normalize_name(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = re.sub(r"\s*&\s*family$", "", text)
    text = re.sub(r"\s+helu$", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def build_name_index(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for entry in entries:
        index[normalize_name(entry["name"])] = entry
        index[entry["name"].casefold()] = entry
    return index


def resolve_target(enrichment: dict[str, Any], index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    name = enrichment["name"]
    if name in {e["name"] for e in index.values()}:
        return next(e for e in index.values() if e["name"] == name)

    alias = NAME_ALIASES.get(normalize_name(name))
    if alias:
        return next((e for e in index.values() if e["name"] == alias), None)

    return index.get(normalize_name(name))


def merge_entry(existing: dict[str, Any], enrichment: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)
    for key in ENRICHMENT_KEYS:
        if key in enrichment and enrichment[key] not in (None, "", []):
            merged[key] = enrichment[key]

    # Preserve Forbes rank and net worth snapshot
    merged["rank"] = existing["rank"]
    merged["netWorth"] = existing["netWorth"]

    if existing.get("firstFortuneDecade") and "firstFortuneDecade" not in enrichment:
        merged["firstFortuneDecade"] = existing["firstFortuneDecade"]

    # Drop legacy v1 fields when fully enriched
    for legacy in ("companies", "sourceOfWealth"):
        merged.pop(legacy, None)

    return merged


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge Grok enrichment JSON by billionaire name.")
    parser.add_argument("source", type=Path, help="Grok enrichment JSON array")
    args = parser.parse_args()

    source = args.source.expanduser().resolve()
    if not source.is_file():
        print(f"Error: file not found: {source}", file=sys.stderr)
        sys.exit(1)

    try:
        enrichments = json.loads(source.read_text(encoding="utf-8"))
        dataset = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(enrichments, list):
        print("Error: enrichment source must be a JSON array", file=sys.stderr)
        sys.exit(1)

    index = build_name_index(dataset)
    merged_count = 0
    missing: list[str] = []

    for item in enrichments:
        if not isinstance(item, dict) or "name" not in item:
            continue
        target = resolve_target(item, index)
        if not target:
            missing.append(item["name"])
            continue
        updated = merge_entry(target, item)
        target.clear()
        target.update(updated)
        merged_count += 1

    dataset.sort(key=lambda e: (e["rank"], e["name"].casefold()))
    DATA_PATH.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    enriched = sum(
        1
        for e in dataset
        if e.get("wealthBreakdown") and e["wealthBreakdown"][0].get("stakePct") is not None
    )
    print(f"Merged {merged_count} profiles -> {DATA_PATH}")
    print(f"Stake-level breakdown: {enriched}/{len(dataset)}")
    if missing:
        print(f"Not found ({len(missing)}): {', '.join(missing)}", file=sys.stderr)


if __name__ == "__main__":
    main()
