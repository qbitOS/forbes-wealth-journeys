#!/usr/bin/env python3
"""Build Forbes historical index — list years, data coverage, timeline anchors, gaps.

Usage:
  python3 scripts/build_forbes_historical_index.py

Output: data/forbes-historical-index.json
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HISTORICAL_PATH = ROOT / "data/historical-net-worth.json"
PROFILES_PATH = ROOT / "data/forbes-billionaires.json"
OUT_PATH = ROOT / "data/forbes-historical-index.json"

FORBES_LIST_START = 1982
FORBES_BILLIONAIRES_START = 1987
DEFAULT_LATEST = 2026

TIMELINE_ANCHORS = [
    {"year": 1792, "month": 5, "label": "Buttonwood Agreement · NYSE origins", "era": "markets", "category": "exchange"},
    {"year": 1817, "label": "New York Stock & Exchange Board (NYSE)", "era": "markets", "category": "exchange"},
    {"year": 1896, "label": "Dow Jones Industrial Average launched", "era": "markets", "category": "index"},
    {"year": 1929, "month": 10, "label": "Black Tuesday · market crash", "era": "markets", "category": "crisis"},
    {"year": 1969, "month": 10, "label": "ARPANET first message (UCLA ↔ SRI)", "era": "internet", "category": "network"},
    {"year": 1969, "month": 12, "label": "ARPANET four-node university loop (UCLA · SRI · UCSB · Utah)", "era": "internet", "category": "network"},
    {"year": 1971, "label": "NASDAQ founded · electronic trading", "era": "markets", "category": "exchange"},
    {"year": 1971, "month": 11, "label": "Intel 4004 · microprocessor era", "era": "tech", "category": "hardware"},
    {"year": 1982, "month": 9, "label": "Forbes 400 inaugural list", "era": "forbes", "category": "list"},
    {"year": 1987, "month": 3, "label": "Forbes Billionaires list debuts (~140 names)", "era": "forbes", "category": "list"},
    {"year": 1987, "month": 10, "label": "Black Monday", "era": "markets", "category": "crisis"},
    {"year": 1995, "month": 8, "label": "Netscape IPO · commercial web boom", "era": "internet", "category": "ipo"},
    {"year": 2000, "label": "Dot-com peak · NASDAQ record", "era": "markets", "category": "cycle"},
    {"year": 2008, "label": "Global financial crisis", "era": "markets", "category": "crisis"},
    {"year": 2020, "label": "Pandemic market shock · tech wealth surge", "era": "markets", "category": "crisis"},
]

GAPS = [
    {
        "id": "pre-1982-forbes",
        "summary": "No official Forbes rich list before September 1982 (Forbes 400).",
        "impact": "Year slider before 1982 shows market/internet context only — not Forbes ranks.",
    },
    {
        "id": "pre-1987-billionaires",
        "summary": "Forbes Billionaires list began March 1987; Forbes 400 (1982+) is a separate ranking.",
        "impact": "MVP uses 100 modern profiles with estimated historical net worth — not year-by-year Forbes rank snapshots.",
    },
    {
        "id": "rank-snapshot-coverage",
        "summary": "historical-net-worth.json has sparse early-year anchors; values between anchors are interpolated.",
        "impact": "List reorder by year uses interpolated estimates, not published Forbes ranks.",
    },
    {
        "id": "private-holdings",
        "summary": "Private companies (SpaceX, etc.) lack public tickers and crossover tape data.",
        "impact": "Industry stream / through-line universe skews toward public stakes; private wealth is milestone-only.",
    },
    {
        "id": "full-500-expansion",
        "summary": "Dataset holds 100 profiles toward Forbes 500 — not full historical 400/500 lists by year.",
        "impact": "Historical expansion path: ingest Forbes API/archives → per-year rank snapshots keyed by person ID.",
    },
]


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def net_worth_at_year(series: list[dict], year: int) -> float | None:
    if not series:
        return None
    sorted_pts = sorted(series, key=lambda p: p["year"])
    if year < sorted_pts[0]["year"] or year > sorted_pts[-1]["year"]:
        return None
    exact = next((p for p in sorted_pts if p["year"] == year), None)
    if exact:
        return exact["netWorthB"]
    lo = max(p for p in sorted_pts if p["year"] < year)
    hi = min(p for p in sorted_pts if p["year"] > year)
    t = (year - lo["year"]) / (hi["year"] - lo["year"])
    return round(lo["netWorthB"] + t * (hi["netWorthB"] - lo["netWorthB"]), 2)


def expand_historical_series(hist: list[dict]) -> list[dict]:
    if not hist:
        return []
    sorted_pts = sorted(hist, key=lambda p: p["year"])
    if len(sorted_pts) == 1:
        return [dict(sorted_pts[0], anchor=True)]
    out: list[dict] = []
    for i in range(len(sorted_pts) - 1):
        a, b = sorted_pts[i], sorted_pts[i + 1]
        out.append({"year": a["year"], "netWorthB": a["netWorthB"], "anchor": True})
        for y in range(a["year"] + 1, b["year"]):
            t = (y - a["year"]) / (b["year"] - a["year"])
            nw = round(a["netWorthB"] + t * (b["netWorthB"] - a["netWorthB"]), 2)
            out.append({"year": y, "netWorthB": nw, "interpolated": True})
    out.append(
        {
            "year": sorted_pts[-1]["year"],
            "netWorthB": sorted_pts[-1]["netWorthB"],
            "anchor": True,
        }
    )
    return out


def net_worth_at_year_expanded(series: list[dict], year: int) -> float | None:
    expanded = expand_historical_series(series)
    pt = next((p for p in expanded if p["year"] == year), None)
    return pt["netWorthB"] if pt else None


def build_rank_snapshots(
    historical: dict,
    profiles: list[dict],
    years: list[int],
) -> dict[str, list[dict]]:
    rank_to_name = {p["rank"]: p["name"] for p in profiles}
    snapshots: dict[str, list[dict]] = {}
    for year in years:
        rows: list[tuple[int, float]] = []
        for rank_key, series in historical.items():
            if not isinstance(series, list):
                continue
            nw = net_worth_at_year_expanded(series, year)
            if nw is not None:
                rows.append((int(rank_key), nw))
        rows.sort(key=lambda x: (-x[1], x[0]))
        snapshots[str(year)] = [
            {
                "yearRank": i + 1,
                "profileRank": profile_rank,
                "name": rank_to_name.get(profile_rank, f"#{profile_rank}"),
                "netWorthB": nw,
            }
            for i, (profile_rank, nw) in enumerate(rows)
        ]
    return snapshots


def main() -> None:
    historical = load_json(HISTORICAL_PATH) if HISTORICAL_PATH.is_file() else {}
    profiles = load_json(PROFILES_PATH) if PROFILES_PATH.is_file() else []

    year_counts: Counter[int] = Counter()
    all_years: set[int] = set()
    for rank, series in historical.items():
        for pt in series:
            y = int(pt["year"])
            year_counts[y] += 1
            all_years.add(y)

    earliest_data = min(all_years) if all_years else FORBES_LIST_START
    latest_data = max(all_years) if all_years else DEFAULT_LATEST

    slider_min = FORBES_LIST_START
    slider_max = latest_data

    ranks_with_year = {str(y): year_counts[y] for y in sorted(year_counts)}

    snapshot_years = [y for y in range(2023, latest_data + 1) if y <= latest_data]
    rank_snapshots = build_rank_snapshots(historical, profiles, snapshot_years)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "forbesLists": {
            "400": {
                "firstYear": FORBES_LIST_START,
                "firstPublished": "1982-09",
                "description": "Forbes 400 — richest Americans (annual, Sept issue from 1982)",
            },
            "billionaires": {
                "firstYear": FORBES_BILLIONAIRES_START,
                "firstPublished": "1987-03",
                "description": "Forbes World's Billionaires (global, annual from March 1987)",
            },
        },
        "dataCoverage": {
            "profilesCount": len(profiles),
            "historicalRanksCount": len(historical),
            "earliestDataYear": earliest_data,
            "latestDataYear": latest_data,
            "forbesListStartYear": FORBES_LIST_START,
            "sliderMinYear": slider_min,
            "sliderMaxYear": slider_max,
            "ranksWithYear": ranks_with_year,
            "note": "100 modern profiles with estimated net-worth series — not official Forbes rank archives.",
        },
        "rankSnapshotsByYear": rank_snapshots,
        "rankSnapshotNote": (
            "yearRank is computed by sorting interpolated netWorthB from historical-net-worth.json "
            "across all profiles — estimates, not official Forbes list snapshots."
        ),
        "timelineAnchors": TIMELINE_ANCHORS,
        "gaps": GAPS,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")

    print(f"Wrote {OUT_PATH}")
    print(f"  profiles: {len(profiles)} · historical ranks: {len(historical)}")
    print(f"  slider: {slider_min}–{slider_max} · anchors: {len(TIMELINE_ANCHORS)} · gaps: {len(GAPS)}")


if __name__ == "__main__":
    main()
