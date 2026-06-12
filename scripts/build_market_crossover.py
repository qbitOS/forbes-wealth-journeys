#!/usr/bin/env python3
"""Build Forbes rank → crossover market snapshot from robinhood-agentic flip-board rows."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = Path("/Volumes/qbitOS/00.dev/cursor/robinhood-agentic/data/flip-board/rows.json")
PROFILES_PATH = ROOT / "data/forbes-billionaires.json"
ENTITIES_PATH = ROOT / "data/entities.json"
OUT_PATH = ROOT / "data/market-crossover.json"


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def ticker_lookup_ids(ticker: str) -> list[str]:
    if not ticker:
        return []
    base = ticker.upper().strip()
    candidates = [base, base.replace(".", "-"), base.split(".")[0], base.split(":")[0]]
    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def compact_market(row: dict) -> dict:
    day = (row.get("frames") or {}).get("day") or {}
    week = (row.get("frames") or {}).get("week") or {}
    pot_day = (row.get("potentials") or {}).get("day") or {}
    last_flip = day.get("lastFlip") or {}
    return {
        "ticker": row.get("id"),
        "name": row.get("name") or row.get("id"),
        "exchange": row.get("exchange"),
        "sector": row.get("sector"),
        "close": day.get("close"),
        "asOf": day.get("asOf"),
        "macdBias": day.get("macdBias"),
        "histogramBias": day.get("histogramBias"),
        "bbPosition": day.get("bbPosition"),
        "daysSinceFlip": day.get("daysSinceFlip"),
        "lastFlip": {
            "date": last_flip.get("date"),
            "type": last_flip.get("type"),
            "price": last_flip.get("price"),
        }
        if last_flip
        else None,
        "weekMacdBias": week.get("macdBias"),
        "potential": {
            "side": pot_day.get("side"),
            "pct": pot_day.get("pct"),
            "evPct": pot_day.get("evPct"),
            "winRate": pot_day.get("winRate"),
            "floor": pot_day.get("floor"),
            "ceiling": pot_day.get("ceiling"),
            "flipType": pot_day.get("flipType"),
        }
        if pot_day
        else None,
    }


def profile_symbols(profile: dict, entity_catalog: dict[str, dict]) -> list[dict]:
    seen: set[str] = set()
    items: list[dict] = []

    def add(entry: dict) -> None:
        ticker = entry.get("ticker")
        if not ticker:
            return
        key = ticker.upper()
        if key in seen:
            return
        seen.add(key)
        items.append(entry)

    for row in profile.get("wealthBreakdown") or []:
        add(
            {
                "ticker": row.get("ticker"),
                "entity": row.get("entity"),
                "entityId": None,
                "stakePct": row.get("stakePct"),
                "valueUsdB": row.get("valueUsdB"),
                "type": row.get("type"),
                "source": "wealthBreakdown",
            }
        )

    for ent in profile.get("entities") or []:
        cat = entity_catalog.get(ent.get("id") or "", {})
        ticker = ent.get("ticker") or cat.get("ticker")
        add(
            {
                "ticker": ticker,
                "entity": ent.get("name") or cat.get("name") or ent.get("id"),
                "entityId": ent.get("id"),
                "stakePct": None,
                "valueUsdB": ent.get("valuationUsdB") or cat.get("valuationUsdB"),
                "type": ent.get("status") or cat.get("status"),
                "source": "entities",
            }
        )

    return items


def main() -> int:
    rows_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROWS
    if not rows_path.is_file():
        print(f"Missing flip-board rows: {rows_path}", file=sys.stderr)
        return 1
    if not PROFILES_PATH.is_file():
        print(f"Missing profiles: {PROFILES_PATH}", file=sys.stderr)
        return 1

    profiles = load_json(PROFILES_PATH)
    entities = load_json(ENTITIES_PATH) if ENTITIES_PATH.is_file() else []
    entity_catalog = {e["id"]: e for e in entities if e.get("id")}
    rows = load_json(rows_path)
    row_by_id = {r["id"]: r for r in rows if r.get("id")}

    ranks_out = []
    matched_tickers = 0
    total_symbols = 0

    for profile in sorted(profiles, key=lambda p: (p.get("rank") or 999, p.get("name") or "")):
        symbols = profile_symbols(profile, entity_catalog)
        symbol_rows = []
        for sym in symbols:
            total_symbols += 1
            market = None
            for cand in ticker_lookup_ids(sym.get("ticker") or ""):
                src = row_by_id.get(cand)
                if src:
                    market = compact_market(src)
                    sym["ticker"] = cand
                    matched_tickers += 1
                    break
            symbol_rows.append({**sym, "market": market})

        ranks_out.append(
            {
                "rank": profile.get("rank"),
                "name": profile.get("name"),
                "country": profile.get("country"),
                "sector": profile.get("sector"),
                "netWorth": profile.get("netWorth"),
                "symbolCount": len(symbol_rows),
                "marketCount": sum(1 for s in symbol_rows if s.get("market")),
                "symbols": symbol_rows,
            }
        )

    as_of = max(
        (s["market"]["asOf"] for r in ranks_out for s in r["symbols"] if s.get("market") and s["market"].get("asOf")),
        default=None,
    )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": str(rows_path),
        "crossoverStyle": "fornevercollective/crossover · robinhood-agentic flip-board",
        "asOf": as_of,
        "summary": {
            "ranks": len(ranks_out),
            "symbols": total_symbols,
            "withMarketData": matched_tickers,
        },
        "ranks": ranks_out,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")

    print(f"Wrote {OUT_PATH}")
    print(f"  {payload['summary']['withMarketData']}/{payload['summary']['symbols']} symbols with crossover data")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
