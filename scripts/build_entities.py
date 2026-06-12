#!/usr/bin/env python3
"""Build data/entities.json catalog from billionaire profiles and seed entities."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "forbes-billionaires.json"
OUTPUT_PATH = REPO_ROOT / "data" / "entities.json"

# Known market caps / private valuations (seed; profile data fills gaps)
SEED_ENTITIES: list[dict[str, Any]] = [
    {"id": "spacex", "name": "SpaceX", "founded": 2002, "status": "private", "valuationUsdB": 350, "ticker": None},
    {"id": "tesla", "name": "Tesla", "founded": 2003, "status": "public", "valuationUsdB": 1200, "ticker": "TSLA"},
    {"id": "xai", "name": "xAI", "founded": 2023, "status": "private", "valuationUsdB": 50, "ticker": None},
    {"id": "google", "name": "Google", "founded": 1998, "status": "public", "valuationUsdB": 2800, "ticker": "GOOGL"},
    {"id": "alphabet", "name": "Alphabet", "founded": 2015, "status": "public", "valuationUsdB": 2800, "ticker": "GOOGL"},
    {"id": "amazon", "name": "Amazon", "founded": 1994, "status": "public", "valuationUsdB": 2200, "ticker": "AMZN"},
    {"id": "oracle", "name": "Oracle", "founded": 1977, "status": "public", "valuationUsdB": 450, "ticker": "ORCL"},
    {"id": "nvidia", "name": "Nvidia", "founded": 1993, "status": "public", "valuationUsdB": 3200, "ticker": "NVDA"},
    {"id": "meta", "name": "Meta", "founded": 2004, "status": "public", "valuationUsdB": 1500, "ticker": "META"},
    {"id": "microsoft", "name": "Microsoft", "founded": 1975, "status": "public", "valuationUsdB": 3400, "ticker": "MSFT"},
    {"id": "dell", "name": "Dell Technologies", "founded": 1984, "status": "public", "valuationUsdB": 90, "ticker": "DELL"},
    {"id": "lvmh", "name": "LVMH", "founded": 1987, "status": "public", "valuationUsdB": 400, "ticker": "MC.PA"},
    {"id": "berkshire", "name": "Berkshire Hathaway", "founded": 1955, "status": "public", "valuationUsdB": 900, "ticker": "BRK.A"},
    {"id": "walmart", "name": "Walmart", "founded": 1962, "status": "public", "valuationUsdB": 650, "ticker": "WMT"},
    {"id": "blackstone", "name": "Blackstone", "founded": 1985, "status": "public", "valuationUsdB": 180, "ticker": "BX"},
    {"id": "netease", "name": "NetEase", "founded": 1997, "status": "public", "valuationUsdB": 80, "ticker": "NTES"},
    {"id": "antofagasta", "name": "Antofagasta", "founded": 1980, "status": "public", "valuationUsdB": 25, "ticker": "ANTO.L"},
    {"id": "msc", "name": "MSC", "founded": 1970, "status": "private", "valuationUsdB": 200, "ticker": None},
    {"id": "mars-inc", "name": "Mars Inc.", "founded": 1911, "status": "private", "valuationUsdB": 120, "ticker": None},
    {"id": "schwarz-group", "name": "Schwarz Group (Lidl)", "founded": 1930, "status": "private", "valuationUsdB": 150, "ticker": None},
    {"id": "citadel", "name": "Citadel", "founded": 1990, "status": "private", "valuationUsdB": 60, "ticker": None},
]


def merge_entity(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    merged = dict(existing)
    for key, value in incoming.items():
        if value is None:
            continue
        if key not in merged or merged[key] in (None, ""):
            merged[key] = value
    return merged


def ticker_from_breakdown(entity_id: str, entity_name: str, profiles: list[dict[str, Any]]) -> str | None:
    name_lower = entity_name.lower()
    for profile in profiles:
        for row in profile.get("wealthBreakdown") or []:
            ent = str(row.get("entity", "")).lower()
            if ent == name_lower or entity_id in ent.replace(" ", "-"):
                return row.get("ticker")
    return None


def main() -> None:
    profiles = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    by_id: dict[str, dict[str, Any]] = {e["id"]: dict(e) for e in SEED_ENTITIES}

    for profile in profiles:
        for entity in profile.get("entities") or []:
            eid = entity.get("id")
            if not eid:
                continue
            row = {
                "id": eid,
                "name": entity.get("name"),
                "founded": entity.get("founded"),
                "status": entity.get("status"),
                "valuationUsdB": entity.get("valuationUsdB"),
                "ticker": entity.get("ticker") or ticker_from_breakdown(eid, entity.get("name", ""), profiles),
            }
            by_id[eid] = merge_entity(by_id.get(eid, {}), row)

    entities = sorted(by_id.values(), key=lambda e: (e.get("name") or "").casefold())
    OUTPUT_PATH.write_text(json.dumps(entities, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(entities)} entities -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
