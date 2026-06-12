#!/usr/bin/env python3
"""Build Forbes rank → crossover market snapshot from robinhood-agentic flip-board rows."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROWS = Path("/Volumes/qbitOS/00.dev/cursor/robinhood-agentic/data/flip-board/rows.json")
DEFAULT_CHARTS = Path("/Volumes/qbitOS/00.dev/cursor/robinhood-agentic/data/flip-board/charts")
PROFILES_PATH = ROOT / "data/forbes-billionaires.json"
ENTITIES_PATH = ROOT / "data/entities.json"
OUT_PATH = ROOT / "data/market-crossover.json"
CHART_POINT_LIMIT = 90


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


def ema(values: list[float], period: int) -> list[float]:
    k = 2 / (period + 1)
    out = [values[0]]
    for i in range(1, len(values)):
        out.append(values[i] * k + out[-1] * (1 - k))
    return out


def compute_macd(closes: list[float]) -> list[dict]:
    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal = ema(macd_line, 9)
    return [
        {"macd": m, "signal": s, "hist": m - s}
        for m, s in zip(macd_line, signal)
    ]


def compute_bollinger(closes: list[float], period: int = 20, mult: float = 2.0) -> list[dict]:
    out: list[dict] = []
    for i in range(len(closes)):
        if i < period - 1:
            out.append({"bbM": None, "bbU": None, "bbL": None})
            continue
        window = closes[i - period + 1 : i + 1]
        mid = sum(window) / period
        variance = sum((x - mid) ** 2 for x in window) / period
        sd = variance**0.5
        out.append({"bbM": mid, "bbU": mid + mult * sd, "bbL": mid - mult * sd})
    return out


def compact_chart_payload(ticker: str, charts_dir: Path, limit: int = CHART_POINT_LIMIT) -> dict | None:
    path = charts_dir / f"{ticker}.json"
    if not path.is_file():
        return None
    raw = load_json(path)
    daily = raw.get("daily") or {}
    dates = daily.get("d") or []
    closes = daily.get("c") or []
    if len(closes) < 26 or len(dates) != len(closes):
        return None

    macd = compute_macd(closes)
    bb = compute_bollinger(closes)
    start = max(0, len(closes) - limit)
    points = []
    for i in range(start, len(closes)):
        m = macd[i]
        b = bb[i]
        points.append(
            {
                "date": dates[i],
                "close": round(closes[i], 4),
                "bbU": round(b["bbU"], 4) if b["bbU"] is not None else None,
                "bbM": round(b["bbM"], 4) if b["bbM"] is not None else None,
                "bbL": round(b["bbL"], 4) if b["bbL"] is not None else None,
                "macd": round(m["macd"], 4),
                "signal": round(m["signal"], 4),
                "hist": round(m["hist"], 4),
            }
        )

    window_start = dates[start]
    flips = []
    last_flip = None
    for i in range(1, len(closes)):
        if dates[i] < window_start:
            continue
        prev_m = macd[i - 1]
        cur_m = macd[i]
        prev_b = bb[i - 1]
        cur_b = bb[i]
        if prev_m["macd"] <= prev_m["signal"] and cur_m["macd"] > cur_m["signal"]:
            flips.append({"date": dates[i], "type": "macd_bullish", "indicator": "macd"})
        elif prev_m["macd"] >= prev_m["signal"] and cur_m["macd"] < cur_m["signal"]:
            flips.append({"date": dates[i], "type": "macd_bearish", "indicator": "macd"})
        if cur_b["bbL"] is not None:
            if closes[i - 1] >= prev_b["bbL"] and closes[i] < cur_b["bbL"]:
                flips.append({"date": dates[i], "type": "bb_lower_breakdown", "indicator": "bollinger"})
            elif closes[i - 1] <= prev_b["bbU"] and closes[i] > cur_b["bbU"]:
                flips.append({"date": dates[i], "type": "bb_upper_breakout", "indicator": "bollinger"})

    return {
        "ticker": ticker,
        "asOf": dates[-1],
        "close": round(closes[-1], 4),
        "points": points,
        "flips": flips[-8:],
    }


def compact_market(row: dict, chart: dict | None = None) -> dict:
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
        "chart": chart,
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
    charts_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_CHARTS
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
                    chart = compact_chart_payload(cand, charts_dir)
                    market = compact_market(src, chart)
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
