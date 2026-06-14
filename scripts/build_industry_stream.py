#!/usr/bin/env python3
"""Build unified industry stream JSON for industry-stream.html.

Merges Forbes wealth journeys, crossover flip-board signals, Grok branch events,
world context, and optional robinhood-agentic forbes-crossover alignments.

Usage:
  python3 scripts/build_industry_stream.py
  python3 scripts/build_industry_stream.py /path/to/flip-board/rows.json

Prerequisites (run in order when refreshing market data):
  cd ../robinhood-agentic && python3 scripts/build_flip_board.py focus
  python3 scripts/build_market_crossover.py ../robinhood-agentic/data/flip-board/rows.json
  python3 scripts/forbes_crossover.py build   # optional — richer alignments
  python3 scripts/build_industry_stream.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))
from build_market_crossover import compact_chart_payload  # noqa: E402

AGENTIC = Path(os.environ.get("AGENTIC_REPO", str(ROOT.parent / "robinhood-agentic")))
CHARTS_DIR = AGENTIC / "data/flip-board/charts"

MARKET_PATH = ROOT / "data/market-crossover.json"
PROFILES_PATH = ROOT / "data/forbes-billionaires.json"
ENTITIES_PATH = ROOT / "data/entities.json"
GROK_PATH = ROOT / "data/grok-branch-events.json"
WORLD_PATH = ROOT / "data/world-context-events.json"
CROSSOVER_INDEX = AGENTIC / "data/forbes-crossover/index.json"
DEFAULT_ROWS = AGENTIC / "data/flip-board/rows.json"
TIMELINES_DIR = AGENTIC / "data/flip-board/timelines"
RH_YEAR_DIR = AGENTIC / "data/robinhood-year"
RH_MANIFEST_PATH = RH_YEAR_DIR / "manifest.json"
MANIFEST_PATH = AGENTIC / "config/forbes-tick-manifest.json"
OUT_PATH = ROOT / "data/industry-stream.json"
PRIVATE_EARNINGS_PATH = ROOT / "data/private-earnings-events.json"
OVERLAY_PATH = ROOT / "data/flip-overlay.json"
OVERLAY_WINDOW_START = "2023-01-01"
ROBINHOOD_YEAR = AGENTIC / "data/robinhood-year"
ROBINHOOD_YEAR_MANIFEST = ROBINHOOD_YEAR / "manifest.json"
TRADING_DAYS_YEAR = 252
SPARKLINE_LIMIT = 90
TRADING_RECENT_DAYS = 30

# Flip-board / Robinhood tape aliases (profile ticker → data ticker)
TICKER_ALIASES: dict[str, str] = {
    "BRK.A": "BRK.B",
}

# Foreign ticker → US ADR proxy (from forbes-tick-manifest)
FOREIGN_ADR_ALIASES: dict[str, str] = {
    "9983.T": "FRCOY",
    "9984.T": "SFTBY",
    "DRREDDY.NS": "RDY",
}

TIMEFRAMES = ("quarter", "month", "week", "day")
FLIP_SHORT = {
    "macd_bullish": "MACD↑",
    "macd_bearish": "MACD↓",
    "histogram_bullish": "Hist↑",
    "histogram_bearish": "Hist↓",
    "bb_upper_breakout": "BB↑brk",
    "bb_upper_reentry": "BB↑↩",
    "bb_lower_breakdown": "BB↓brk",
    "bb_lower_reentry": "BB↓↩",
    "bb_middle_bullish": "SMA↑",
    "bb_middle_bearish": "SMA↓",
    "squeeze_on": "Sq ON",
    "squeeze_release": "Sq REL",
}

ENTITY_BRANCHES: dict[str, list[str]] = {
    "tesla": ["tesla"],
    "spacex": ["spacex", "spacex-ops", "spacex-ipo"],
    "xai": ["grok", "colossus"],
    "openai": ["openai"],
    "neuralink": ["neuralink"],
    "boring": ["boring"],
    "x": ["x-corp"],
    "twitter": ["x-corp"],
    "xcorp": ["x-corp"],
    "terrafab": ["terrafab"],
}


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


def parse_sort_key(sort: str | None) -> str:
    if not sort:
        return "0000-00-00"
    sort = str(sort).strip()
    m = re.match(r"^(\d{4})-Q(\d)$", sort)
    if m:
        y, q = int(m.group(1)), int(m.group(2))
        mo = (q - 1) * 3 + 2
        return f"{y}-{mo:02d}-15"
    m = re.match(r"^(\d{4})-(\d{2})(?:-(\d{2}))?$", sort)
    if m:
        d = m.group(3) or "15"
        return f"{m.group(1)}-{m.group(2)}-{d}"
    m = re.match(r"^(\d{4})$", sort)
    if m:
        return f"{m.group(1)}-06-15"
    return sort[:10] if len(sort) >= 10 else sort


def flip_label(flip_type: str | None) -> str:
    if not flip_type:
        return "—"
    return FLIP_SHORT.get(flip_type, flip_type.replace("_", " "))


def compression_row(row: dict) -> dict | None:
    frames = row.get("frames") or {}
    tf_out = {}
    inside_count = 0
    flip_types: list[str] = []
    for tf in TIMEFRAMES:
        f = frames.get(tf)
        if not f:
            continue
        last = f.get("lastFlip") or {}
        ft = last.get("type")
        bb = f.get("bbPosition") or "unknown"
        if bb == "inside":
            inside_count += 1
        if ft:
            flip_types.append(ft)
        tf_out[tf] = {
            "asOf": f.get("asOf"),
            "close": f.get("close"),
            "macdBias": f.get("macdBias"),
            "bbPosition": bb,
            "lastFlip": {
                "date": last.get("date"),
                "type": ft,
                "label": flip_label(ft),
            }
            if last
            else None,
            "daysSinceFlip": f.get("daysSinceFlip"),
        }
    if not tf_out:
        return None
    # Squeeze score: more inside bands + recent flips → higher compression tension
    squeeze = min(100, inside_count * 18 + sum(1 for t in flip_types if "squeeze" in (t or "")) * 12)
    if inside_count >= 3:
        squeeze = min(100, squeeze + 15)
    return {
        "ticker": row.get("id"),
        "name": row.get("name") or row.get("id"),
        "sector": row.get("sector"),
        "squeezeScore": squeeze,
        "insideCount": inside_count,
        "timeframes": tf_out,
    }


def branches_for_entity(entity_id: str | None) -> set[str]:
    if not entity_id:
        return set()
    eid = entity_id.lower().strip()
    branches = set(ENTITY_BRANCHES.get(eid, [eid]))
    branches.add(eid)
    return branches


def grok_stream_events(grok: dict) -> list[dict]:
    out: list[dict] = []
    for key in ("clusterEvents", "portfolioEvents"):
        for ev in grok.get(key) or []:
            sort = ev.get("sort") or ev.get("date") or ""
            out.append(
                {
                    "id": f"grok-{ev.get('id', sort)}",
                    "kind": "grok_branch",
                    "sortKey": parse_sort_key(sort),
                    "date": ev.get("date") or sort,
                    "title": ev.get("title") or ev.get("id"),
                    "branch": ev.get("branch"),
                    "group": "cluster" if key == "clusterEvents" else "portfolio",
                    "approx": ev.get("approx", False),
                    "tags": ["grok", ev.get("branch") or "branch", key.replace("Events", "")],
                }
            )
    return out


def milestone_stream_events(profiles: list[dict]) -> list[dict]:
    out: list[dict] = []
    for p in profiles:
        rank = p.get("rank")
        name = p.get("name")
        sector = p.get("sector")
        for ev in p.get("timeline") or []:
            year = ev.get("year")
            sort = str(year) if year else "0000"
            out.append(
                {
                    "id": f"milestone-{rank}-{ev.get('entityId')}-{sort}-{ev.get('title', '')[:20]}",
                    "kind": "milestone",
                    "sortKey": parse_sort_key(sort),
                    "date": sort,
                    "title": ev.get("title") or ev.get("type"),
                    "description": ev.get("description") or ev.get("impact"),
                    "entityId": ev.get("entityId"),
                    "eventType": ev.get("type"),
                    "forbesRank": rank,
                    "forbesName": name,
                    "sector": sector,
                    "tags": ["milestone", ev.get("type") or "event", sector or "sector"],
                }
            )
    return out


def flip_stream_events(market: dict) -> list[dict]:
    out: list[dict] = []
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            m = sym.get("market")
            if not m:
                continue
            flip = m.get("lastFlip") or {}
            ft = flip.get("type")
            if not ft:
                continue
            sort = flip.get("date") or m.get("asOf") or ""
            out.append(
                {
                    "id": f"flip-{sym.get('ticker')}-{sort}-{ft}",
                    "kind": "flip",
                    "sortKey": parse_sort_key(sort),
                    "date": sort,
                    "title": f"{sym.get('ticker')} · {flip_label(ft)}",
                    "description": f"{sym.get('entity')} · {m.get('macdBias')} MACD · BB {m.get('bbPosition')}",
                    "ticker": sym.get("ticker"),
                    "entity": sym.get("entity"),
                    "entityId": sym.get("entityId"),
                    "flipType": ft,
                    "flipLabel": flip_label(ft),
                    "forbesRank": rank_row.get("rank"),
                    "forbesName": rank_row.get("name"),
                    "sector": m.get("sector") or rank_row.get("sector"),
                    "macdBias": m.get("macdBias"),
                    "bbPosition": m.get("bbPosition"),
                    "potentialPct": (m.get("potential") or {}).get("pct"),
                    "tags": ["flip", ft, sym.get("ticker") or "ticker"],
                }
            )
            for f in (m.get("chart") or {}).get("flips") or []:
                fd = f.get("date") or ""
                out.append(
                    {
                        "id": f"flip-hist-{sym.get('ticker')}-{fd}-{f.get('type')}",
                        "kind": "flip",
                        "sortKey": parse_sort_key(fd),
                        "date": fd,
                        "title": f"{sym.get('ticker')} · {flip_label(f.get('type'))}",
                        "description": sym.get("entity"),
                        "ticker": sym.get("ticker"),
                        "entity": sym.get("entity"),
                        "flipType": f.get("type"),
                        "flipLabel": flip_label(f.get("type")),
                        "forbesRank": rank_row.get("rank"),
                        "forbesName": rank_row.get("name"),
                        "tags": ["flip", "history", f.get("type") or "signal"],
                    }
                )
    return out


def world_stream_events(world: dict) -> list[dict]:
    out: list[dict] = []
    for ev in world.get("events") or []:
        y = ev.get("year")
        sort = str(y) if y else "0000"
        out.append(
            {
                "id": f"world-{y}-{ev.get('label', '')[:16]}",
                "kind": "world",
                "sortKey": parse_sort_key(sort),
                "date": str(y),
                "title": ev.get("label"),
                "description": ev.get("description"),
                "category": ev.get("category"),
                "tags": ["world", ev.get("category") or "context"],
            }
        )
    return out


def build_interlinks(market: dict, entities: list[dict], compression: list[dict]) -> list[dict]:
    entity_by_id = {e["id"]: e for e in entities if e.get("id")}
    comp_by_ticker = {c["ticker"]: c for c in compression}
    links: list[dict] = []
    seen: set[str] = set()

    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            eid = sym.get("entityId")
            ent = entity_by_id.get(eid or "", {})
            comp = comp_by_ticker.get(ticker or "")
            m = sym.get("market")
            key = f"{rank_row.get('rank')}::{ticker}::{eid}"
            if key in seen:
                continue
            seen.add(key)
            branches = sorted(branches_for_entity(eid))
            links.append(
                {
                    "forbesRank": rank_row.get("rank"),
                    "forbesName": rank_row.get("name"),
                    "sector": rank_row.get("sector"),
                    "entity": sym.get("entity") or ent.get("name"),
                    "entityId": eid,
                    "ticker": ticker,
                    "type": sym.get("type"),
                    "stakePct": sym.get("stakePct"),
                    "valueUsdB": sym.get("valueUsdB"),
                    "branches": branches,
                    "market": {
                        "macdBias": m.get("macdBias") if m else None,
                        "bbPosition": m.get("bbPosition") if m else None,
                        "lastFlip": m.get("lastFlip") if m else None,
                        "close": m.get("close") if m else None,
                    }
                    if m
                    else None,
                    "squeezeScore": comp.get("squeezeScore") if comp else None,
                }
            )
    return sorted(links, key=lambda x: (x.get("forbesRank") or 999, x.get("entity") or ""))


SQUEEZE_HIGH = 60  # matches scoreLevel() in industry-stream.js
SQUEEZE_MAX = 100


def build_compression_summary(compression: list[dict]) -> dict:
    """Aggregate squeeze stats for the compression section header."""
    if not compression:
        return {
            "winner": None,
            "winnerEntity": None,
            "winnerScore": 0,
            "winPct": 0,
            "avgSqueezePct": 0,
            "highSqueezePct": 0,
            "tiedAtTop": 0,
            "totalTickers": 0,
        }

    scores = [c.get("squeezeScore") or 0 for c in compression]
    top_score = max(scores)
    tied = [c for c in compression if (c.get("squeezeScore") or 0) == top_score]
    winner_row = min(tied, key=lambda c: c.get("ticker") or "")
    high_count = sum(1 for s in scores if s >= SQUEEZE_HIGH)
    total = len(compression)

    return {
        "winner": winner_row.get("ticker"),
        "winnerEntity": winner_row.get("entity") or winner_row.get("name"),
        "winnerScore": top_score,
        "winPct": round(top_score * 100 / SQUEEZE_MAX),
        "avgSqueezePct": round(sum(scores) / total),
        "highSqueezePct": round(100 * high_count / total),
        "tiedAtTop": len(tied),
        "totalTickers": total,
    }


def build_through_line_summary(
    market: dict,
    crossover_index: dict | None,
    stream: list[dict],
) -> dict:
    """Aggregate Forbes/crossover flip stats for the through-line header."""
    symbols: list[dict] = []
    total_flips = 0
    seen_tickers: set[str] = set()

    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            m = sym.get("market")
            if not m or not ticker:
                continue
            pot = m.get("potential") or {}
            wr = pot.get("winRate")
            if wr is not None and ticker not in seen_tickers:
                seen_tickers.add(ticker)
                pct = pot.get("pct") or 0
                ev = pot.get("evPct") or 0
                flip_type = pot.get("flipType") or (m.get("lastFlip") or {}).get("type")
                symbols.append(
                    {
                        "ticker": ticker,
                        "entity": sym.get("entity"),
                        "winRate": float(wr),
                        "pct": float(pct) if pct is not None else 0.0,
                        "evPct": float(ev) if ev is not None else 0.0,
                        "flipType": flip_type,
                        "flipLabel": flip_label(flip_type),
                        "score": abs(float(wr) * float(pct)) if pct is not None else float(wr),
                    }
                )
            chart_flips = (m.get("chart") or {}).get("flips") or []
            if m.get("lastFlip"):
                total_flips += 1
            total_flips += len(chart_flips)

    if not total_flips:
        total_flips = sum(1 for e in stream if e.get("kind") == "flip" and e.get("forbesRank"))

    win_pct = round(sum(s["winRate"] for s in symbols) / len(symbols), 1) if symbols else None

    patterns = (crossover_index or {}).get("patterns") or {}
    alignments = patterns.get("topAlignments") or []
    window_days = patterns.get("windowDays") or 90
    alignment_pct = None
    if alignments:
        proximity = [max(0.0, 100.0 - (float(a.get("daysApart") or 0) / window_days) * 100.0) for a in alignments]
        alignment_pct = round(sum(proximity) / len(proximity), 1)

    by_ticker: dict[str, list[dict]] = {}
    for hit in alignments:
        t = hit.get("ticker")
        if t:
            by_ticker.setdefault(t, []).append(hit)

    sym_by_ticker = {s["ticker"]: s for s in symbols}
    winner = None
    winner_detail = None
    winner_score = -1.0

    for ticker, hits in by_ticker.items():
        sym = sym_by_ticker.get(ticker, {})
        score = len(hits) * 10.0 + sym.get("score", 0.0)
        if score > winner_score:
            winner_score = score
            winner = ticker
            best = min(hits, key=lambda h: h.get("daysApart", 9999))
            life = best.get("lifecycle") or ""
            if " · " in life:
                life = life.split(" · ", 1)[1]
            flip_id = best.get("flipId")
            flip_txt = flip_label(flip_id) if flip_id else (best.get("flip") or "")[:32]
            winner_detail = f"{life} ↔ {flip_txt}" if life else flip_txt

    if not winner and symbols:
        top = max(symbols, key=lambda s: s.get("score", 0.0))
        winner = top["ticker"]
        winner_detail = top.get("flipLabel") or flip_label(top.get("flipType"))

    return {
        "winPct": win_pct,
        "alignmentPct": alignment_pct,
        "winner": winner,
        "winnerDetail": winner_detail,
        "totalFlips": total_flips,
        "symbolsWithSignals": len(symbols),
        "alignmentCount": len(alignments),
    }


def alignment_pct_by_ticker(crossover_index: dict | None) -> dict[str, float]:
    """Per-ticker lifecycle↔flip alignment proximity (0–100)."""
    patterns = (crossover_index or {}).get("patterns") or {}
    alignments = patterns.get("topAlignments") or []
    window_days = patterns.get("windowDays") or 90
    by_ticker: dict[str, list[float]] = defaultdict(list)
    for hit in alignments:
        ticker = hit.get("ticker")
        if not ticker:
            continue
        proximity = max(0.0, 100.0 - (float(hit.get("daysApart") or 0) / window_days) * 100.0)
        by_ticker[ticker].append(proximity)
    return {t: round(sum(vals) / len(vals), 1) for t, vals in by_ticker.items()}


def rh_year_date_range(rh_manifest: dict | None) -> tuple[str, str] | None:
    if not rh_manifest or not rh_manifest.get("date_range"):
        return None
    dr = rh_manifest["date_range"]
    start = dr.get("start")
    end = dr.get("end")
    if start and end:
        return start, end
    return None


def dates_in_year_window(dates: list[str], window: tuple[str, str] | None) -> list[str]:
    if not window:
        return dates
    start, end = window
    return [d for d in dates if start <= d <= end]


def market_active_days_by_ticker(market: dict, window: tuple[str, str] | None = None) -> dict[str, int]:
    """Active trading days from market-crossover chart points."""
    out: dict[str, int] = {}
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            m = sym.get("market") or {}
            points = (m.get("chart") or {}).get("points") or []
            if ticker and points:
                dates = [p.get("date") for p in points if p.get("date")]
                dates = dates_in_year_window(dates, window)
                if dates:
                    out[ticker] = len(set(dates))
    return out


def flip_board_active_days(row_by_id: dict[str, dict]) -> dict[str, int]:
    """barsDaily from flip-board rows when chart points are unavailable."""
    out: dict[str, int] = {}
    for row_id, row in row_by_id.items():
        bars = row.get("barsDaily")
        if bars:
            out[row_id] = int(bars)
    return out


def manifest_company_type(entry: dict, *, skipped: bool) -> str:
    if skipped:
        reason = entry.get("skip_reason") or ""
        if reason == "private":
            return "private"
        if reason == "foreign_only":
            return "foreign"
        return "private"
    return "us" if entry.get("region") == "us" else "foreign"


def rh_year_daily_file(symbol: str, rh_manifest: dict | None) -> Path | None:
    if not rh_manifest:
        return None
    sym_entry = (rh_manifest.get("symbols") or {}).get(symbol) or {}
    day_iv = (sym_entry.get("intervals") or {}).get("day") or {}
    chunks = day_iv.get("chunks") or {}
    if not chunks:
        return None
    chunk = next(iter(chunks.values()))
    rel = chunk.get("file")
    if not rel:
        return None
    path = ROBINHOOD_YEAR / rel
    return path if path.is_file() else None


def load_rh_year_daily_dates(
    symbol: str, rh_manifest: dict | None, window: tuple[str, str] | None = None
) -> list[str]:
    """All daily bar dates for a symbol from robinhood-year (every manifest chunk)."""
    if not rh_manifest:
        return []
    sym_entry = (rh_manifest.get("symbols") or {}).get(symbol) or {}
    day_iv = (sym_entry.get("intervals") or {}).get("day") or {}
    chunks = day_iv.get("chunks") or {}
    dates: set[str] = set()
    for chunk in chunks.values():
        rel = chunk.get("file")
        if not rel:
            continue
        path = ROBINHOOD_YEAR / rel
        if path.is_file():
            dates.update(load_daily_dates(path, window))
    return sorted(dates)


def market_latest_date(market: dict) -> str | None:
    latest: str | None = None
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            points = ((sym.get("market") or {}).get("chart") or {}).get("points") or []
            if points:
                d = points[-1].get("date")
                if d and (latest is None or d > latest):
                    latest = d
    return latest


def through_line_heatmap_window(rh_manifest: dict | None, market: dict) -> tuple[str, str]:
    """Calendar heatmap span — aligned with flip overlay (Jan 2023 → latest tape)."""
    end: str | None = None
    if rh_manifest and rh_manifest.get("date_range", {}).get("end"):
        end = rh_manifest["date_range"]["end"]
    market_end = market_latest_date(market)
    if market_end and (not end or market_end > end):
        end = market_end
    if not end:
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return OVERLAY_WINDOW_START, end


def market_chart_dates_by_ticker(
    market: dict, window: tuple[str, str] | None = None
) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            if not ticker:
                continue
            points = ((sym.get("market") or {}).get("chart") or {}).get("points") or []
            dates = [p.get("date") for p in points if p.get("date")]
            filtered = dates_in_year_window(dates, window)
            if filtered:
                out[ticker] = filtered
    return out


def load_daily_dates(path: Path, window: tuple[str, str] | None = None) -> list[str]:
    raw = load_json(path)
    dates: list[str] = []
    for bar in raw.get("bars") or []:
        begins = bar.get("begins_at") or ""
        if begins:
            dates.append(begins[:10])
    return dates_in_year_window(dates, window)


def active_days_for_ticker(
    ticker: str,
    rh_manifest: dict | None,
    market_days: dict[str, int],
    board_days: dict[str, int],
    window: tuple[str, str] | None = None,
) -> tuple[int | None, str | None]:
    """Return (active_days, source) for a tradable symbol."""
    rh_path = rh_year_daily_file(ticker, rh_manifest)
    if rh_path:
        dates = load_daily_dates(rh_path, window)
        if dates:
            return len(dates), "robinhood-year"
    if ticker in market_days:
        return market_days[ticker], "market-crossover"
    for cand in ticker_lookup_ids(ticker):
        if cand in board_days:
            days = board_days[cand]
            if window:
                days = min(days, TRADING_DAYS_YEAR)
            return days, "flip-board"
    return None, None


def activity_pct(active_days: int | None) -> float | None:
    if active_days is None:
        return None
    return round(min(100.0, 100.0 * active_days / TRADING_DAYS_YEAR), 1)


def company_display_label(name: str | None, ticker: str | None) -> str:
    """Human-readable label, e.g. L'Oréal (OR.PA) for foreign tickers."""
    display_name = (name or "").strip() or (ticker or "").strip()
    if ticker and display_name and display_name.upper() != ticker.upper():
        return f"{display_name} ({ticker})"
    if ticker:
        return ticker
    return display_name or "—"


def enrich_through_line_company(
    company: dict,
    entity_catalog: dict[str, dict],
    ticker_to_entity_id: dict[str, str],
) -> dict:
    ticker = company.get("ticker")
    eid = company.get("entityId")
    if not eid and ticker:
        eid = ticker_to_entity_id.get(normalize_entity_ticker(ticker) or "")
    cat = entity_catalog.get(eid or "", {})
    name = (cat.get("name") or company.get("name") or ticker or "").strip()
    out = {**company, "name": name}
    if eid:
        out["entityId"] = eid
    out["displayLabel"] = company_display_label(name, ticker)
    return out


def build_through_line_universe(
    tick_manifest: dict,
    market: dict,
    crossover_index: dict | None,
    rh_manifest: dict | None,
    row_by_id: dict[str, dict],
    entity_catalog: dict[str, dict] | None = None,
    ticker_to_entity_id: dict[str, str] | None = None,
) -> list[dict]:
    """All Forbes manifest companies with percent metrics for the through-line roster."""
    catalog = entity_catalog or {}
    ticker_map = ticker_to_entity_id or {}
    alignments = alignment_pct_by_ticker(crossover_index)
    year_window = rh_year_date_range(rh_manifest)
    market_days = market_active_days_by_ticker(market, year_window)
    board_days = flip_board_active_days(row_by_id)
    universe: list[dict] = []

    for sym in tick_manifest.get("symbols") or []:
        ticker = sym.get("symbol")
        eid = sym.get("entity_id") or sym.get("entityId")
        if not eid and ticker:
            eid = ticker_map.get(normalize_entity_ticker(ticker) or "")
        cat = catalog.get(eid or "", {})
        name = cat.get("name") or sym.get("entity") or ticker
        ctype = manifest_company_type(sym, skipped=False)
        active_days, source = active_days_for_ticker(
            ticker, rh_manifest, market_days, board_days, year_window
        )
        pct_kind = None
        pct = None
        pct_reason = None
        if ticker in alignments:
            pct = alignments[ticker]
            pct_kind = "alignment"
        elif active_days is not None:
            pct = activity_pct(active_days)
            pct_kind = "activity"
        else:
            pct_reason = "no market data"
        universe.append(
            enrich_through_line_company(
                {
                    "name": name,
                    "ticker": ticker,
                    "entityId": eid,
                    "type": ctype,
                    "region": sym.get("region"),
                    "status": sym.get("status"),
                    "pct": pct,
                    "pctKind": pct_kind,
                    "pctReason": pct_reason,
                    "activeDays": active_days,
                    "activeDaysSource": source,
                    "robinhood": sym.get("robinhood", False),
                },
                catalog,
                ticker_map,
            )
        )

    for skip in tick_manifest.get("skipped") or []:
        eid = skip.get("entity_id") or skip.get("entityId")
        cat = catalog.get(eid or "", {})
        name = cat.get("name") or skip.get("name")
        ctype = manifest_company_type(skip, skipped=True)
        reason = skip.get("skip_reason") or "skipped"
        universe.append(
            enrich_through_line_company(
                {
                    "name": name,
                    "ticker": None,
                    "entityId": eid,
                    "type": ctype,
                    "region": None,
                    "status": skip.get("status") or "skip",
                    "pct": None,
                    "pctKind": None,
                    "pctReason": reason,
                    "activeDays": None,
                    "activeDaysSource": None,
                    "robinhood": False,
                    "foreignTickers": skip.get("foreign_tickers"),
                },
                catalog,
                ticker_map,
            )
        )

    return sorted(universe, key=lambda c: (-(c.get("pct") or -1), c.get("name") or ""))


def build_through_line_heatmap(
    universe: list[dict],
    rh_manifest: dict | None,
    market: dict,
) -> dict:
    """Aggregate daily symbol activity for ECharts calendar heatmap."""
    date_counts: dict[str, int] = defaultdict(int)
    date_symbols: dict[str, set[str]] = defaultdict(set)
    symbols_with_data = 0
    heatmap_window = through_line_heatmap_window(rh_manifest, market)
    market_dates = market_chart_dates_by_ticker(market, heatmap_window)

    def record_symbol_day(day: str, ticker: str) -> None:
        date_counts[day] += 1
        date_symbols[day].add(ticker)

    for company in universe:
        ticker = company.get("ticker")
        if not ticker:
            continue
        symbol_dates: set[str] = set(load_rh_year_daily_dates(ticker, rh_manifest, heatmap_window))
        symbol_dates.update(market_dates.get(ticker) or [])
        if symbol_dates:
            for d in sorted(symbol_dates):
                record_symbol_day(d, ticker)
            symbols_with_data += 1

    calendar = sorted([[d, c] for d, c in date_counts.items()])
    values = [c for _, c in calendar]
    date_range = [heatmap_window[0], heatmap_window[1]]
    by_date = {
        day: sorted(symbols) for day, symbols in sorted(date_symbols.items())
    }

    return {
        "range": date_range,
        "rangeLabel": format_heatmap_range_label(date_range),
        "calendar": calendar,
        "byDate": by_date,
        "max": max(values) if values else 0,
        "symbolDays": sum(values),
        "symbolsWithData": symbols_with_data,
        "tradingDays": len(calendar),
    }


def tick_manifest_range(rh_manifest: dict | None, calendar: list[list]) -> list[str]:
    if rh_manifest and rh_manifest.get("date_range"):
        dr = rh_manifest["date_range"]
        return [dr.get("start", ""), dr.get("end", "")]
    if calendar:
        dates = [row[0] for row in calendar]
        return [dates[0], dates[-1]]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return [today, today]


def format_heatmap_range_label(date_range: list[str]) -> str:
    """Human-readable range for calendar heatmap subtitle (e.g. Jan 2023 – Jun 2026)."""
    if not date_range:
        return ""
    start = date_range[0] if date_range else ""
    end = date_range[-1] if len(date_range) > 1 else start
    if not start:
        return ""

    def fmt(iso: str) -> str:
        try:
            return datetime.strptime(iso, "%Y-%m-%d").strftime("%b %Y")
        except ValueError:
            return iso

    if start == end:
        return fmt(start)
    return f"{fmt(start)} – {fmt(end)}"


def iso_week_key(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def iso_week_bounds(week_key: str) -> tuple[str, str]:
    """ISO week key → Monday/Sunday date strings (YYYY-MM-DD)."""
    year_s, week_s = week_key.split("-W")
    year, week = int(year_s), int(week_s)
    jan4 = datetime(year, 1, 4)
    start = jan4 - timedelta(days=jan4.isocalendar().weekday - 1) + timedelta(weeks=week - 1)
    end = start + timedelta(days=6)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def easter_sunday(year: int) -> date:
    """Western Easter Sunday (Gregorian)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    month = (h + ell - 7 * m + 114) // 31
    day = ((h + ell - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> date:
    """weekday: Mon=0 … Sun=6; n=1 first, n=-1 last occurrence."""
    if n > 0:
        first = date(year, month, 1)
        offset = (weekday - first.weekday()) % 7
        return first + timedelta(days=offset + 7 * (n - 1))
    if month == 12:
        last = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    offset = (last.weekday() - weekday) % 7
    return last - timedelta(days=offset)


def observe_fixed_holiday(d: date) -> date:
    """NYSE-style weekend observation (Sat→Fri, Sun→Mon)."""
    if d.weekday() == 5:
        return d - timedelta(days=1)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def us_market_holidays_for_year(year: int) -> list[dict]:
    """NYSE full-day closures for a calendar year."""
    easter = easter_sunday(year)
    entries: list[tuple[date, str, str, str]] = [
        (observe_fixed_holiday(date(year, 1, 1)), "New Year's Day", "new_year", "US market closed"),
        (nth_weekday_of_month(year, 1, 0, 3), "MLK Day", "mlk", "US market closed"),
        (nth_weekday_of_month(year, 2, 0, 3), "Presidents' Day", "presidents", "US market closed"),
        (easter - timedelta(days=2), "Good Friday", "good_friday", "US market closed"),
        (easter, "Easter Sunday", "easter", "Markets closed (weekend)"),
        (nth_weekday_of_month(year, 5, 0, -1), "Memorial Day", "memorial", "US market closed"),
        (observe_fixed_holiday(date(year, 6, 19)), "Juneteenth", "juneteenth", "US market closed"),
        (observe_fixed_holiday(date(year, 7, 4)), "Independence Day", "july4", "US market closed"),
        (nth_weekday_of_month(year, 9, 0, 1), "Labor Day", "labor", "US market closed"),
        (nth_weekday_of_month(year, 11, 3, 4), "Thanksgiving", "thanksgiving", "US market closed"),
        (observe_fixed_holiday(date(year, 12, 25)), "Christmas", "christmas", "US market closed"),
    ]
    out: list[dict] = []
    for dt, label, event_id, note in entries:
        out.append(
            {
                "date": dt.isoformat(),
                "label": label,
                "eventId": event_id,
                "kind": "holiday",
                "note": note,
            }
        )
    return out


def fomc_meeting_dates(year: int) -> list[date]:
    """Scheduled FOMC statement dates (approximate — Wed of meeting week)."""
    by_year: dict[int, list[tuple[int, int]]] = {
        2023: [(2, 1), (3, 22), (5, 3), (6, 14), (7, 26), (9, 20), (11, 1), (12, 13)],
        2024: [(1, 31), (3, 20), (5, 1), (6, 12), (7, 31), (9, 18), (11, 7), (12, 18)],
        2025: [(1, 29), (3, 19), (5, 7), (6, 18), (7, 30), (9, 17), (10, 29), (12, 10)],
        2026: [(1, 28), (3, 18), (4, 29), (6, 17), (7, 29), (9, 16), (11, 4), (12, 16)],
    }
    return [date(year, mo, day) for mo, day in by_year.get(year, [])]


def major_market_events_for_year(year: int) -> list[dict]:
    """Non-holiday market context: FOMC weeks, NYE early close."""
    out: list[dict] = []
    for fomc in fomc_meeting_dates(year):
        out.append(
            {
                "date": fomc.isoformat(),
                "label": "FOMC week",
                "eventId": "fomc",
                "kind": "event",
                "note": "Fed policy meeting week",
            }
        )
    nye = date(year, 12, 31)
    if nye.weekday() < 5:
        out.append(
            {
                "date": nye.isoformat(),
                "label": "New Year's Eve",
                "eventId": "nye",
                "kind": "event",
                "note": "Early close (1:00 PM ET)",
            }
        )
    return out


def calendar_events_for_range(start_year: int, end_year: int) -> list[dict]:
    events: list[dict] = []
    for year in range(start_year, end_year + 1):
        events.extend(us_market_holidays_for_year(year))
        events.extend(major_market_events_for_year(year))
    return sorted(events, key=lambda e: e["date"])


def events_in_week(week_start: str, week_end: str, catalog: list[dict]) -> list[dict]:
    hits: list[dict] = []
    for ev in catalog:
        if week_start <= ev["date"] <= week_end:
            hits.append(ev)
    return hits


def speed_week_annotation(
    week_key: str,
    week_start: str,
    week_end: str,
    symbol_days: int,
    prior_days: int | None,
    week_events: list[dict],
    *,
    is_first: bool,
    median_days: float,
) -> dict | None:
    if week_events:
        primary = week_events[0]
        return {
            "week": week_key,
            "label": primary["label"],
            "kind": primary["kind"],
            "eventId": primary["eventId"],
            "date": primary["date"],
            "note": primary["note"],
        }
    if is_first and symbol_days < median_days * 0.6:
        return {
            "week": week_key,
            "label": "Ramp",
            "kind": "ramp",
            "eventId": "ramp",
            "note": "Partial first week",
        }
    if prior_days and prior_days > 0 and symbol_days < prior_days * 0.85:
        drop = round((1 - symbol_days / prior_days) * 100)
        if drop >= 15:
            return {
                "week": week_key,
                "label": f"−{drop}%",
                "kind": "dip",
                "eventId": "dip",
                "note": "Lower weekly activity",
            }
    return None


def build_through_line_speed(heatmap: dict) -> dict:
    """Weekly symbol-day velocity + 4-week rolling sum for speed chart."""
    week_totals: dict[str, int] = defaultdict(int)
    for date_str, count in heatmap.get("calendar") or []:
        week_totals[iso_week_key(date_str)] += count

    weeks = sorted(week_totals.keys())
    rolling_window = 4
    series: list[dict] = []
    prior_days: int | None = None
    day_values = list(week_totals.values())
    median_days = sorted(day_values)[len(day_values) // 2] if day_values else 0

    for i, week in enumerate(ours := weeks):
        window = ours[max(0, i - rolling_window + 1) : i + 1]
        rolling = sum(week_totals[w] for w in window)
        symbol_days = week_totals[week]
        week_start, week_end = iso_week_bounds(week)
        delta = symbol_days - prior_days if prior_days is not None else None
        delta_pct = round((delta / prior_days) * 100, 1) if prior_days and delta is not None else None
        series.append(
            {
                "week": week,
                "weekStart": week_start,
                "weekEnd": week_end,
                "symbolDays": symbol_days,
                "rollingSymbolDays": rolling,
                "velocity": round(rolling / len(window), 1),
                "deltaSymbolDays": delta,
                "deltaPct": delta_pct,
            }
        )
        prior_days = symbol_days

    peak_vel = max(series, key=lambda s: s["velocity"]) if series else None
    peak_raw = max(series, key=lambda s: s["symbolDays"]) if series else None
    date_range = heatmap.get("range") or []
    start_year = int((date_range[0] if date_range else "2023-01-01")[:4])
    end_year = int((date_range[-1] if date_range else "2026-12-31")[:4])
    event_catalog = calendar_events_for_range(start_year, end_year)

    annotations: list[dict] = []
    calendar_events: list[dict] = []
    seen_event_keys: set[str] = set()
    for i, row in enumerate(series):
        week_events = events_in_week(row["weekStart"], row["weekEnd"], event_catalog)
        for ev in week_events:
            key = f"{row['week']}::{ev['eventId']}::{ev['date']}"
            if key in seen_event_keys:
                continue
            seen_event_keys.add(key)
            calendar_events.append(
                {
                    "week": row["week"],
                    "weekStart": row["weekStart"],
                    "weekEnd": row["weekEnd"],
                    "date": ev["date"],
                    "label": ev["label"],
                    "kind": ev["kind"],
                    "eventId": ev["eventId"],
                    "note": ev["note"],
                    "symbolDays": row["symbolDays"],
                }
            )
        ann = speed_week_annotation(
            row["week"],
            row["weekStart"],
            row["weekEnd"],
            row["symbolDays"],
            series[i - 1]["symbolDays"] if i else None,
            week_events,
            is_first=i == 0,
            median_days=median_days,
        )
        if ann:
            annotations.append(ann)

    date_range = heatmap.get("range") or []
    return {
        "rollingWindow": rolling_window,
        "weeks": series,
        "peakWeek": peak_vel.get("week") if peak_vel else None,
        "peakVelocity": peak_vel.get("velocity") if peak_vel else 0,
        "peakSymbolDays": peak_raw.get("symbolDays") if peak_raw else 0,
        "rangeLabel": format_heatmap_range_label(date_range),
        "symbolCount": heatmap.get("symbolsWithData", 0),
        "avgVelocity": round(sum(s["velocity"] for s in series) / len(series), 1) if series else 0,
        "avgSymbolDays": round(sum(s["symbolDays"] for s in series) / len(series), 1) if series else 0,
        "currentWeek": series[-1] if series else None,
        "annotations": annotations,
        "events": calendar_events,
    }


def through_line_universe_summary(universe: list[dict]) -> dict:
    tradable = [c for c in universe if c.get("type") != "private" and c.get("pct") is not None]
    activity = [c for c in universe if c.get("pctKind") == "activity" and c.get("pct") is not None]
    alignment = [c for c in universe if c.get("pctKind") == "alignment"]
    private = [c for c in universe if c.get("type") == "private"]
    avg_activity = round(sum(c["pct"] for c in activity) / len(activity), 1) if activity else None
    top = max((c for c in universe if c.get("pct") is not None), key=lambda c: c["pct"], default=None)
    leader_label = top.get("displayLabel") if top else None
    if top and not leader_label:
        leader_label = company_display_label(top.get("name"), top.get("ticker"))
    return {
        "totalCompanies": len(universe),
        "tradableWithPct": len(tradable),
        "privateCount": len(private),
        "avgActivityPct": avg_activity,
        "alignmentCount": len(alignment),
        "leader": top.get("ticker") or top.get("name") if top else None,
        "leaderTicker": top.get("ticker") if top else None,
        "leaderName": top.get("name") if top else None,
        "leaderLabel": leader_label,
        "leaderPct": top.get("pct") if top else None,
        "leaderKind": top.get("pctKind") if top else None,
    }


def _interlink_signal_score(link: dict) -> int:
    market = link.get("market") or {}
    score = link.get("squeezeScore") or 0
    if market.get("lastFlip"):
        score += 20
    if market.get("macdBias"):
        score += 5
    return score


def _interlink_has_crossover_signal(link: dict) -> bool:
    market = link.get("market") or {}
    return bool(market.get("lastFlip")) or bool(market.get("macdBias"))


def resolve_data_ticker(ticker: str | None) -> str | None:
    if not ticker:
        return None
    base = ticker.upper().strip()
    if base in TICKER_ALIASES:
        return TICKER_ALIASES[base]
    if base in FOREIGN_ADR_ALIASES:
        return FOREIGN_ADR_ALIASES[base]
    return base


def load_foreign_adr_aliases() -> dict[str, str]:
    aliases = dict(FOREIGN_ADR_ALIASES)
    if not MANIFEST_PATH.is_file():
        return aliases
    manifest = load_json(MANIFEST_PATH)
    for sym in manifest.get("symbols") or []:
        ticker = (sym.get("symbol") or "").upper()
        adr = sym.get("us_adr")
        if ticker and adr:
            aliases[ticker] = adr.upper()
    return aliases


ENTITY_NAME_ALIASES: dict[str, str] = {
    "x corp": "x-corp",
    "x": "x-corp",
}

CONNECTION_EVENT_TYPES = frozenset({"merger", "acquisition"})
CONNECTION_RELATION_ORDER = {"merger": 0, "acquisition": 1, "ipo": 2, "co-held": 3}


def load_private_earnings_index(data: dict | None) -> dict[str, dict]:
    if not data:
        return {}
    return {e["entityId"]: e for e in data.get("entities") or [] if e.get("entityId")}


def private_entity_for_name(name: str, private_index: dict[str, dict]) -> tuple[str | None, dict | None]:
    label = (name or "").strip().lower()
    if not label:
        return None, None
    for eid, row in private_index.items():
        if (row.get("name") or "").strip().lower() == label:
            return eid, row
    return None, None


def resolve_entity_id(holding: dict, entity_catalog: dict[str, dict]) -> str | None:
    if holding.get("entityId"):
        return holding["entityId"]
    entity = (holding.get("entity") or "").strip()
    if not entity:
        return None
    key = entity.lower()
    if key in ENTITY_NAME_ALIASES:
        return ENTITY_NAME_ALIASES[key]
    for eid, cat in entity_catalog.items():
        if (cat.get("name") or "").strip().lower() == key:
            return eid
    slug = key.replace(" corp", "").replace(" ", "-")
    if slug in entity_catalog:
        return slug
    return None


def parse_event_counterparty(
    title: str,
    self_name: str,
    entity_catalog: dict[str, dict],
) -> dict | None:
    t = (title or "").lower()
    self_l = (self_name or "").strip().lower()
    best: dict | None = None
    best_len = 0
    for eid, cat in entity_catalog.items():
        name = (cat.get("name") or "").strip()
        nl = name.lower()
        if not nl or nl == self_l or nl not in t:
            continue
        if len(name) > best_len:
            best_len = len(name)
            best = {
                "entityId": eid,
                "entity": name,
                "ticker": cat.get("ticker"),
            }
    return best


def build_ipo_valuation_chart(
    private_entity: dict | None,
    catalog: dict | None,
    holding: dict,
    wealth_as_of: str | None,
) -> dict | None:
    is_private = (holding.get("type") or "").lower() == "private"
    if not is_private and not private_entity:
        return None

    events = sorted(
        (private_entity or {}).get("events") or [],
        key=lambda e: e.get("sortKey") or e.get("date") or "",
    )
    timeline_points: list[dict] = []
    val_series: list[tuple[str, float]] = []

    for ev in events:
        pt: dict = {
            "date": ev.get("date"),
            "eventType": ev.get("eventType"),
            "kind": ev.get("kind"),
            "title": ev.get("title"),
        }
        if ev.get("form"):
            pt["form"] = ev["form"]
        if ev.get("valuationUsdB") is not None:
            pt["valueUsdB"] = ev["valuationUsdB"]
            val_series.append((ev["date"], float(ev["valuationUsdB"])))
        if ev.get("metricUsdB") is not None:
            pt["metricUsdB"] = ev["metricUsdB"]
            pt["metricLabel"] = ev.get("metricLabel")
        timeline_points.append(pt)

    catalog_val = (catalog or {}).get("valuationUsdB")
    if catalog_val:
        founded = catalog.get("founded")
        anchor = f"{founded}-06-01" if founded else "2024-01-01"
        val_series.append((anchor, float(catalog_val)))

    stake = holding.get("stakePct")
    value = holding.get("valueUsdB")
    if stake and value and stake > 0:
        implied = round(float(value) / (float(stake) / 100.0), 1)
        ipo_dates = [
            e.get("date")
            for e in events
            if e.get("eventType") in ("ipo_filing", "ipo_pricing", "ipo_listing") and e.get("date")
        ]
        pre_ipo = min(ipo_dates) if ipo_dates else (wealth_as_of or "2026-05-01")
        val_series.append((pre_ipo, implied))

    deduped: dict[str, float] = {}
    for d, v in val_series:
        if d:
            deduped[d] = v
    val_series = sorted(deduped.items(), key=lambda x: x[0])

    sparkline = [round(v, 2) for _, v in val_series]
    sparkline_dates = [d for d, _ in val_series]
    has_chart = len(sparkline) >= 2

    if not timeline_points and not has_chart:
        return None

    return {
        "status": (private_entity or {}).get("status") or holding.get("type") or "private",
        "publicTicker": (private_entity or {}).get("publicTicker"),
        "points": timeline_points,
        "sparkline": sparkline if has_chart else [],
        "sparklineDates": sparkline_dates if has_chart else [],
        "hasChart": has_chart,
    }


def build_holding_connections(
    holding: dict,
    entity_id: str | None,
    private_entity: dict | None,
    sibling_holdings: list[dict],
    entity_catalog: dict[str, dict],
    grok: dict | None,
) -> list[dict]:
    connections: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    entity_name = holding.get("entity") or ""

    def linked_entities() -> set[str]:
        out: set[str] = set()
        for c in connections:
            out.add(c.get("entityId") or (c.get("entity") or "").lower())
        return out

    def add(
        entity: str,
        *,
        entity_id: str | None = None,
        ticker: str | None = None,
        relation: str,
        title: str | None = None,
        date: str | None = None,
    ) -> None:
        key = (ticker or "", entity_id or entity.lower(), relation)
        if key in seen:
            return
        seen.add(key)
        connections.append(
            {
                "entity": entity,
                "entityId": entity_id,
                "ticker": ticker,
                "relation": relation,
                "title": title or entity,
                "date": date,
            }
        )

    public_ticker = (private_entity or {}).get("publicTicker")
    if public_ticker:
        ipo_ev = next(
            (
                e
                for e in reversed((private_entity or {}).get("events") or [])
                if e.get("eventType") in ("ipo_listing", "ipo_pricing")
            ),
            None,
        )
        add(
            public_ticker,
            entity_id=entity_id,
            ticker=public_ticker,
            relation="ipo",
            title=ipo_ev.get("title") if ipo_ev else f"{public_ticker} · IPO proxy",
            date=ipo_ev.get("date") if ipo_ev else None,
        )

    for ev in (private_entity or {}).get("events") or []:
        if ev.get("eventType") not in CONNECTION_EVENT_TYPES:
            continue
        target = parse_event_counterparty(ev.get("title") or "", entity_name, entity_catalog)
        if not target:
            continue
        add(
            target["entity"],
            entity_id=target.get("entityId"),
            ticker=target.get("ticker"),
            relation=ev.get("eventType") or "merger",
            title=ev.get("title"),
            date=ev.get("date"),
        )

    grok_events: list[dict] = []
    for key in ("clusterEvents", "portfolioEvents", "events"):
        grok_events.extend((grok or {}).get(key) or [])

    for ev in grok_events:
        if not ev.get("merge"):
            continue
        title = ev.get("title") or ""
        if entity_name.lower() not in title.lower() and (entity_id or "") not in title.lower():
            continue
        target = parse_event_counterparty(title, entity_name, entity_catalog)
        if not target:
            continue
        add(
            target["entity"],
            entity_id=target.get("entityId"),
            ticker=target.get("ticker"),
            relation="merger",
            title=title,
            date=ev.get("date"),
        )

    self_key = (entity_name or "").strip().lower()
    for sib in sibling_holdings:
        sib_name = (sib.get("entity") or "").strip()
        if not sib_name or sib_name.lower() == self_key:
            continue
        sib_id = resolve_entity_id(sib, entity_catalog)
        sib_key = sib_id or sib_name.lower()
        if sib_key in linked_entities():
            continue
        add(
            sib_name,
            entity_id=sib_id,
            ticker=sib.get("ticker") or sib.get("dataTicker"),
            relation="co-held",
            title=f"Same Forbes profile · {sib_name}",
        )

    connections.sort(
        key=lambda c: (
            CONNECTION_RELATION_ORDER.get(c.get("relation") or "", 9),
            (c.get("entity") or "").lower(),
        )
    )
    return connections[:8]


def profile_holdings(profile: dict, entity_catalog: dict[str, dict]) -> list[dict]:
    """All Forbes-linked companies for a profile (public + private)."""
    seen: set[str] = set()
    items: list[dict] = []

    def add(entry: dict) -> None:
        entity = (entry.get("entity") or "").strip()
        if not entity:
            return
        key = entity.lower()
        if key in seen:
            return
        seen.add(key)
        items.append(entry)

    for row in profile.get("wealthBreakdown") or []:
        add(
            {
                "entity": row.get("entity"),
                "ticker": row.get("ticker"),
                "entityId": None,
                "stakePct": row.get("stakePct"),
                "valueUsdB": row.get("valueUsdB"),
                "type": row.get("type"),
                "source": "wealthBreakdown",
            }
        )

    for ent in profile.get("entities") or []:
        cat = entity_catalog.get(ent.get("id") or "", {})
        add(
            {
                "entity": ent.get("name") or cat.get("name") or ent.get("id"),
                "ticker": ent.get("ticker") or cat.get("ticker"),
                "entityId": ent.get("id"),
                "stakePct": None,
                "valueUsdB": ent.get("valuationUsdB") or cat.get("valuationUsdB"),
                "type": ent.get("status") or cat.get("status"),
                "source": "entities",
            }
        )

    for name in profile.get("companies") or []:
        label = (name or "").strip()
        if not label:
            continue
        add(
            {
                "entity": label,
                "ticker": None,
                "entityId": None,
                "stakePct": None,
                "valueUsdB": None,
                "type": "company",
                "source": "companies",
            }
        )

    return items


_rh_manifest_cache: dict | None = None


def rh_manifest() -> dict:
    global _rh_manifest_cache
    if _rh_manifest_cache is None:
        _rh_manifest_cache = load_json(RH_MANIFEST_PATH) if RH_MANIFEST_PATH.is_file() else {}
    return _rh_manifest_cache


def rh_day_path(ticker: str) -> Path | None:
    sym = rh_manifest().get("symbols", {}).get(ticker.upper())
    if not sym:
        return None
    day = (sym.get("intervals") or {}).get("day") or {}
    chunks = day.get("chunks") or {}
    if not chunks:
        return None
    latest = max(chunks.values(), key=lambda c: c.get("chunk_end") or "")
    rel = latest.get("file")
    if not rel:
        return None
    path = RH_YEAR_DIR / rel
    return path if path.is_file() else None


def load_rh_daily_bars(ticker: str) -> list[dict]:
    path = rh_day_path(ticker)
    if not path:
        return []
    raw = load_json(path)
    return raw.get("bars") or []


def sparkline_from_chart(
    chart: dict | None,
    limit: int = SPARKLINE_LIMIT,
    window_start: str | None = None,
) -> tuple[list[str], list[float]]:
    if not chart:
        return [], []
    points = chart.get("points") or []
    if window_start:
        points = [p for p in points if (p.get("date") or "") >= window_start]
    if len(points) < 2:
        return [], []
    tail = points[-limit:] if limit else points
    dates = [p.get("date") or "" for p in tail if p.get("close") is not None]
    closes = [float(p["close"]) for p in tail if p.get("close") is not None]
    return dates, closes


def sparkline_from_bars(
    bars: list[dict],
    limit: int = SPARKLINE_LIMIT,
    window_start: str | None = None,
) -> tuple[list[str], list[float]]:
    active = [b for b in bars if not b.get("interpolated") and b.get("close_price") is not None]
    if window_start:
        active = [b for b in active if str(b.get("begins_at", ""))[:10] >= window_start]
    if len(active) < 2:
        return [], []
    tail = active[-limit:] if limit else active
    dates = [str(b.get("begins_at", ""))[:10] for b in tail]
    closes = [float(b["close_price"]) for b in tail]
    return dates, closes


def trading_activity(
    bars: list[dict] | None = None,
    chart: dict | None = None,
    recent_days: int = TRADING_RECENT_DAYS,
) -> tuple[str | None, int]:
    """Return (lastActiveDate, tradingDaysRecent) from daily bars or chart points."""
    dates: list[str] = []
    if bars:
        for b in bars:
            if b.get("interpolated"):
                continue
            vol = float(b.get("volume") or 0)
            if vol <= 0:
                continue
            d = str(b.get("begins_at", ""))[:10]
            if d:
                dates.append(d)
    elif chart:
        for p in chart.get("points") or []:
            d = p.get("date")
            if d and p.get("close") is not None:
                dates.append(d)

    if not dates:
        return None, 0

    last_active = dates[-1]
    try:
        last_d = date.fromisoformat(last_active)
        cutoff = last_d - timedelta(days=recent_days)
        recent = sum(1 for d in dates if date.fromisoformat(d) >= cutoff)
    except ValueError:
        recent = min(len(dates), recent_days)
    return last_active, recent


def lookup_flip_row(
    ticker: str | None,
    row_by_id: dict[str, dict],
    adr_aliases: dict[str, str] | None = None,
) -> tuple[str | None, dict | None]:
    if not ticker:
        return None, None
    base = ticker.upper().strip()
    data_ticker = TICKER_ALIASES.get(base, base)
    if adr_aliases and base in adr_aliases:
        data_ticker = adr_aliases[base]
    for cand in ticker_lookup_ids(data_ticker):
        src = row_by_id.get(cand)
        if src:
            return cand, src
    return data_ticker, None


def build_market_index(market: dict) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            if ticker:
                out[ticker.upper()] = sym
    return out


def build_forbes_rankings(
    profiles: list[dict],
    entity_catalog: dict[str, dict],
    market: dict,
    compression: list[dict],
    row_by_id: dict[str, dict],
    private_earnings: dict | None = None,
    grok: dict | None = None,
) -> list[dict]:
    comp_by_ticker = {c["ticker"]: c for c in compression if c.get("ticker")}
    market_by_ticker = build_market_index(market)
    adr_aliases = load_foreign_adr_aliases()
    private_index = load_private_earnings_index(private_earnings)
    rankings: list[dict] = []

    for profile in sorted(profiles, key=lambda p: (p.get("rank") or 999, p.get("name") or "")):
        nw = profile.get("netWorth") or {}
        wealth_as_of = nw.get("asOf")
        raw_holdings = profile_holdings(profile, entity_catalog)
        holdings_out: list[dict] = []

        for holding in raw_holdings:
            entity_id = resolve_entity_id(holding, entity_catalog)
            private_entity = private_index.get(entity_id or "") if entity_id else None
            if not private_entity:
                matched_id, matched = private_entity_for_name(holding.get("entity") or "", private_index)
                if matched:
                    private_entity = matched
                    entity_id = entity_id or matched_id

            ticker = holding.get("ticker")
            data_ticker, flip_row = lookup_flip_row(ticker, row_by_id, adr_aliases)
            if not data_ticker and private_entity and private_entity.get("publicTicker"):
                data_ticker = private_entity["publicTicker"]
            sym = market_by_ticker.get((data_ticker or ticker or "").upper()) if (data_ticker or ticker) else None
            market_data = (sym or {}).get("market")
            chart = (market_data or {}).get("chart")

            comp = comp_by_ticker.get(data_ticker) if data_ticker else None
            if not comp and flip_row:
                comp = compression_row(flip_row)
                if comp:
                    comp["entity"] = holding.get("entity")

            bars = load_rh_daily_bars(data_ticker) if data_ticker else []
            spark_dates, spark_closes = sparkline_from_chart(
                chart, limit=0, window_start=OVERLAY_WINDOW_START
            )
            if len(spark_closes) < 2 and bars:
                spark_dates, spark_closes = sparkline_from_bars(
                    bars, limit=0, window_start=OVERLAY_WINDOW_START
                )
            if len(spark_closes) < 2:
                spark_dates, spark_closes = sparkline_from_chart(chart, limit=SPARKLINE_LIMIT)
                if len(spark_closes) < 2 and bars:
                    spark_dates, spark_closes = sparkline_from_bars(bars, limit=SPARKLINE_LIMIT)

            last_active, trading_recent = trading_activity(bars=bars or None, chart=chart)
            has_chart = len(spark_closes) >= 2

            catalog_entry = entity_catalog.get(entity_id or "") if entity_id else None
            ipo_chart = build_ipo_valuation_chart(
                private_entity, catalog_entry, holding, wealth_as_of
            )
            connections = build_holding_connections(
                holding,
                entity_id,
                private_entity,
                raw_holdings,
                entity_catalog,
                grok,
            )

            holdings_out.append(
                {
                    "ticker": ticker,
                    "dataTicker": data_ticker,
                    "entity": holding.get("entity"),
                    "entityId": entity_id,
                    "type": holding.get("type"),
                    "stakePct": holding.get("stakePct"),
                    "valueUsdB": holding.get("valueUsdB"),
                    "source": holding.get("source"),
                    "compression": comp,
                    "lastActiveDate": last_active,
                    "tradingDaysRecent": trading_recent,
                    "hasChart": has_chart,
                    "sparkline": [round(c, 4) for c in spark_closes] if has_chart else [],
                    "sparklineDates": spark_dates if has_chart else [],
                    "ipoChart": ipo_chart,
                    "connections": connections,
                    "market": {
                        "macdBias": market_data.get("macdBias") if market_data else None,
                        "bbPosition": market_data.get("bbPosition") if market_data else None,
                        "close": market_data.get("close") if market_data else None,
                        "asOf": market_data.get("asOf") if market_data else None,
                        "lastFlip": market_data.get("lastFlip") if market_data else None,
                    }
                    if market_data
                    else None,
                }
            )

        holdings_out.sort(
            key=lambda h: (
                h.get("lastActiveDate") or "0000-00-00",
                h.get("tradingDaysRecent") or 0,
                h.get("valueUsdB") or 0,
                h.get("entity") or "",
            ),
            reverse=True,
        )

        rankings.append(
            {
                "rank": profile.get("rank"),
                "name": profile.get("name"),
                "sector": profile.get("sector"),
                "country": profile.get("country"),
                "wealth": {
                    "value": nw.get("value"),
                    "unit": nw.get("unit"),
                    "currency": nw.get("currency"),
                    "asOf": nw.get("asOf"),
                },
                "holdingCount": len(holdings_out),
                "activeHoldingCount": sum(1 for h in holdings_out if h.get("lastActiveDate")),
                "holdings": holdings_out,
            }
        )

    return rankings


def build_forbes_rankings_summary(rankings: list[dict]) -> dict:
    people = len(rankings)
    holdings = sum(r.get("holdingCount") or 0 for r in rankings)
    with_chart = sum(
        1 for r in rankings for h in r.get("holdings") or [] if h.get("hasChart")
    )
    with_compression = sum(
        1 for r in rankings for h in r.get("holdings") or [] if h.get("compression")
    )
    with_ipo_chart = sum(
        1 for r in rankings for h in r.get("holdings") or [] if (h.get("ipoChart") or {}).get("hasChart")
    )
    with_connections = sum(
        1 for r in rankings for h in r.get("holdings") or [] if h.get("connections")
    )
    with_ticker = sum(
        1 for r in rankings for h in r.get("holdings") or [] if h.get("ticker")
    )
    active_holdings = sum(
        1 for r in rankings for h in r.get("holdings") or [] if h.get("lastActiveDate")
    )
    return {
        "people": people,
        "holdings": holdings,
        "withTicker": with_ticker,
        "withChart": with_chart,
        "withCompression": with_compression,
        "withIpoChart": with_ipo_chart,
        "withConnections": with_connections,
        "activeHoldings": active_holdings,
    }


def build_interplay_summary(interlinks: list[dict]) -> dict:
    """Aggregate Forbes↔entity interlink stats for the interplay section header."""
    total = len(interlinks)
    if not total:
        return {
            "winner": None,
            "winnerEntity": None,
            "winnerScore": 0,
            "winnerInterlinks": 0,
            "winnerSharePct": 0.0,
            "signalPct": 0.0,
            "activeSignals": 0,
            "totalInterlinks": 0,
            "forbesRanks": [],
        }

    active = sum(1 for link in interlinks if _interlink_has_crossover_signal(link))
    by_ticker: dict[str, list[dict]] = {}
    for link in interlinks:
        ticker = link.get("ticker")
        if ticker:
            by_ticker.setdefault(ticker, []).append(link)

    winner_ticker: str | None = None
    winner_rows: list[dict] = []
    best_score = -1
    for ticker, rows in by_ticker.items():
        agg = sum(_interlink_signal_score(row) for row in rows)
        if agg > best_score or (
            agg == best_score
            and (
                len(rows) > len(winner_rows)
                or (len(rows) == len(winner_rows) and ticker < (winner_ticker or ""))
            )
        ):
            best_score = agg
            winner_ticker = ticker
            winner_rows = rows

    top = winner_rows[0] if winner_rows else {}
    ranks = sorted({row.get("forbesRank") for row in winner_rows if row.get("forbesRank") is not None})

    return {
        "winner": winner_ticker,
        "winnerEntity": top.get("entity"),
        "winnerScore": best_score if winner_ticker else 0,
        "winnerInterlinks": len(winner_rows),
        "winnerSharePct": round(100 * len(winner_rows) / total, 1),
        "signalPct": round(100 * active / total, 1),
        "activeSignals": active,
        "totalInterlinks": total,
        "forbesRanks": ranks[:5],
    }


def flip_sort_to_iso(sort: str | None) -> str | None:
    """Map flip-board sort keys (day/week/month/quarter) to yyyy-MM-dd for chart axes."""
    if not sort:
        return None
    sort = str(sort).strip()
    m = re.match(r"^(\d{4})-Q(\d)$", sort)
    if m:
        y, q = int(m.group(1)), int(m.group(2))
        mo = (q - 1) * 3 + 2
        return f"{y}-{mo:02d}-15"
    m = re.match(r"^(\d{4})-(\d{2})(?:-(\d{2}))?$", sort)
    if m:
        d = m.group(3) or "15"
        return f"{m.group(1)}-{m.group(2)}-{d}"
    m = re.match(r"^(\d{4})$", sort)
    if m:
        return f"{m.group(1)}-06-15"
    return sort[:10] if len(sort) >= 10 else sort


def normalize_series(points: list[dict]) -> list[dict]:
    """Index-normalize close and BB bandwidth for multi-symbol overlay."""
    if not points:
        return []
    base = points[0].get("close")
    if not base:
        return []
    out: list[dict] = []
    vol_window: list[float] = []
    for p in points:
        close = p.get("close")
        if close is None:
            continue
        bb_u, bb_l, bb_m = p.get("bbU"), p.get("bbL"), p.get("bbM")
        bb_width = None
        if bb_u is not None and bb_l is not None and bb_m:
            bb_width = round((bb_u - bb_l) / bb_m, 6)
        vol_raw = p.get("volume")
        vol_f: float | None = None
        if vol_raw is not None:
            try:
                vol_f = float(vol_raw)
            except (TypeError, ValueError):
                vol_f = None
            if vol_f is not None and vol_f <= 0:
                vol_f = None
        vol_window.append(vol_f or 0.0)
        recent = [v for v in vol_window[-20:] if v > 0]
        vol_avg = int(round(sum(recent) / len(recent))) if recent else None
        entry: dict = {
            "date": p.get("date"),
            "close": close,
            "norm": round(100 * close / base, 4),
            "bbWidth": bb_width,
        }
        if vol_f is not None:
            entry["volume"] = int(vol_f)
            if vol_avg:
                entry["volAvg20"] = vol_avg
        out.append(entry)
    return out


def volume_from_flip_chart(data_ticker: str, charts_dir: Path) -> dict[str, int]:
    path = charts_dir / f"{data_ticker}.json"
    if not path.is_file():
        return {}
    raw = load_json(path)
    daily = raw.get("daily") or {}
    dates = daily.get("d") or []
    vols = daily.get("v") or []
    if len(dates) != len(vols):
        return {}
    out: dict[str, int] = {}
    for d, vol in zip(dates, vols):
        if not d or vol is None:
            continue
        try:
            v = int(float(vol))
        except (TypeError, ValueError):
            continue
        if v > 0:
            out[d] = v
    return out


def volume_from_rh_bars(data_ticker: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for bar in load_rh_daily_bars(data_ticker):
        if bar.get("interpolated"):
            continue
        d = str(bar.get("begins_at", ""))[:10]
        vol = bar.get("volume")
        if not d or vol is None:
            continue
        try:
            v = int(float(vol))
        except (TypeError, ValueError):
            continue
        if v > 0:
            out[d] = v
    return out


def enrich_points_with_volume(
    points: list[dict],
    data_ticker: str,
    charts_dir: Path,
) -> list[dict]:
    if not points or all(p.get("volume") for p in points):
        return points
    vol_map = volume_from_flip_chart(data_ticker, charts_dir)
    if not vol_map:
        vol_map = volume_from_rh_bars(data_ticker)
    if not vol_map:
        return points
    enriched: list[dict] = []
    for p in points:
        row = dict(p)
        d = p.get("date")
        if d and row.get("volume") is None and d in vol_map:
            row["volume"] = vol_map[d]
        enriched.append(row)
    return enriched


def load_timeline_flips(ticker: str, window_start: str | None, window_end: str | None) -> list[dict]:
    """Load Q/M/W/D flip walls from robinhood-agentic timeline JSON."""
    path = TIMELINES_DIR / f"{ticker}.json"
    if not path.is_file():
        return []
    raw = load_json(path)
    flips: list[dict] = []
    for group in raw.get("groups") or []:
        if group.get("id") != "timeframes":
            continue
        for branch in group.get("branches") or []:
            tf = branch.get("id")
            if tf not in TIMEFRAMES:
                continue
            for ev in branch.get("events") or []:
                iso = flip_sort_to_iso(ev.get("sort") or ev.get("date"))
                if not iso:
                    continue
                if window_start and iso < window_start:
                    continue
                if window_end and iso > window_end:
                    continue
                flip_type = ev.get("id") or "unknown"
                flips.append(
                    {
                        "ticker": ticker,
                        "timeframe": tf,
                        "sort": ev.get("sort") or ev.get("date"),
                        "date": iso,
                        "type": flip_type,
                        "label": flip_label(flip_type),
                    }
                )
    return flips


FORMATION_EVENT_TYPES = frozenset({"founding", "formation", "ipo", "incorporation"})


def year_to_iso_mid(year: int | str | None) -> str | None:
    if year is None:
        return None
    text = str(year).strip()
    m = re.match(r"^(\d{4})", text)
    if not m:
        return None
    y = int(m.group(1))
    if y < 1000 or y > 2100:
        return None
    return f"{y}-06-15"


def normalize_entity_ticker(ticker: str | None) -> str | None:
    if not ticker:
        return None
    return ticker.upper().strip()


def entity_id_for_ticker(
    ticker: str | None,
    entity_catalog: dict[str, dict],
    ticker_to_entity_id: dict[str, str],
) -> str | None:
    if not ticker:
        return None
    base = normalize_entity_ticker(ticker)
    if base in ticker_to_entity_id:
        return ticker_to_entity_id[base]
    for eid, ent in entity_catalog.items():
        if normalize_entity_ticker(ent.get("ticker")) == base:
            return eid
    return None


def build_ticker_entity_id_map(
    entity_catalog: dict[str, dict],
    tick_manifest: dict | None,
) -> dict[str, str]:
    out: dict[str, str] = {}
    for eid, ent in entity_catalog.items():
        ticker = normalize_entity_ticker(ent.get("ticker"))
        if ticker:
            out[ticker] = eid
    for sym in (tick_manifest or {}).get("symbols") or []:
        ticker = normalize_entity_ticker(sym.get("symbol"))
        eid = sym.get("entity_id")
        if ticker and eid:
            out[ticker] = eid
    return out


def merge_formation_record(existing: dict | None, incoming: dict) -> dict:
    """Merge formation fields; IPO beats founding; richer labels win ties."""
    if not existing:
        return dict(incoming)
    out = dict(existing)
    type_rank = {"ipo": 3, "founding": 2, "formation": 2, "incorporation": 1}
    inc_rank = type_rank.get(incoming.get("formationType") or "", 0)
    cur_rank = type_rank.get(out.get("formationType") or "", 0)
    if inc_rank > cur_rank:
        out.update(incoming)
    elif inc_rank == cur_rank:
        for key in ("formationDate", "formationLabel", "formationType", "foundedDate", "ipoDate"):
            if incoming.get(key) and not out.get(key):
                out[key] = incoming[key]
    for key in ("foundedDate", "ipoDate"):
        if incoming.get(key):
            out[key] = incoming[key]
    if out.get("ipoDate"):
        out["formationDate"] = out["ipoDate"]
        out["formationType"] = "ipo"
    elif out.get("foundedDate") and not out.get("formationDate"):
        out["formationDate"] = out["foundedDate"]
        out["formationType"] = out.get("formationType") or "founding"
    return out


def set_formation_for_ticker(index: dict[str, dict], ticker: str | None, payload: dict) -> None:
    base = normalize_entity_ticker(ticker)
    if not base:
        return
    index[base] = merge_formation_record(index.get(base), payload)


def build_formation_index(
    profiles: list[dict],
    entity_catalog: dict[str, dict],
    tick_manifest: dict | None = None,
) -> dict[str, dict]:
    """Map display ticker → founding / IPO / formation metadata from Forbes profiles."""
    index: dict[str, dict] = {}
    ticker_to_entity_id = build_ticker_entity_id_map(entity_catalog, tick_manifest)

    for ent in entity_catalog.values():
        ticker = normalize_entity_ticker(ent.get("ticker"))
        founded_iso = year_to_iso_mid(ent.get("founded"))
        if ticker and founded_iso:
            set_formation_for_ticker(
                index,
                ticker,
                {
                    "foundedDate": founded_iso,
                    "formationDate": founded_iso,
                    "formationType": "founding",
                    "formationLabel": f"Founded {ent.get('name') or ticker}",
                    "entityId": ent.get("id"),
                },
            )

    for profile in profiles:
        for ent in profile.get("entities") or []:
            ticker = normalize_entity_ticker(ent.get("ticker"))
            founded_iso = year_to_iso_mid(ent.get("founded"))
            if not ticker and ent.get("id"):
                cat = entity_catalog.get(ent["id"]) or {}
                ticker = normalize_entity_ticker(cat.get("ticker"))
                if not founded_iso:
                    founded_iso = year_to_iso_mid(cat.get("founded"))
            if ticker and founded_iso:
                set_formation_for_ticker(
                    index,
                    ticker,
                    {
                        "foundedDate": founded_iso,
                        "formationDate": founded_iso,
                        "formationType": "founding",
                        "formationLabel": f"Founded {ent.get('name') or ticker}",
                        "entityId": ent.get("id"),
                    },
                )

        for row in profile.get("wealthBreakdown") or []:
            ticker = normalize_entity_ticker(row.get("ticker"))
            entity_name = row.get("entity")
            eid = entity_id_for_ticker(ticker, entity_catalog, ticker_to_entity_id)
            cat = entity_catalog.get(eid or "", {})
            founded_iso = year_to_iso_mid(cat.get("founded"))
            if ticker and founded_iso:
                set_formation_for_ticker(
                    index,
                    ticker,
                    {
                        "foundedDate": founded_iso,
                        "formationDate": founded_iso,
                        "formationType": "founding",
                        "formationLabel": f"Founded {entity_name or cat.get('name') or ticker}",
                        "entityId": eid,
                    },
                )

        for ev in profile.get("timeline") or []:
            ev_type = (ev.get("type") or "").lower()
            if ev_type not in FORMATION_EVENT_TYPES:
                continue
            year_iso = year_to_iso_mid(ev.get("year"))
            if not year_iso:
                continue
            eid = ev.get("entityId")
            entity_name = None
            tickers: list[str] = []
            if eid:
                cat = entity_catalog.get(eid) or {}
                entity_name = cat.get("name")
                t = normalize_entity_ticker(cat.get("ticker"))
                if t:
                    tickers.append(t)
            for ent in profile.get("entities") or []:
                if eid and ent.get("id") != eid:
                    continue
                t = normalize_entity_ticker(ent.get("ticker"))
                if t:
                    tickers.append(t)
                if not entity_name:
                    entity_name = ent.get("name")
            for row in profile.get("wealthBreakdown") or []:
                row_entity = (row.get("entity") or "").lower()
                if entity_name and row_entity and row_entity not in (entity_name or "").lower():
                    if eid:
                        continue
                t = normalize_entity_ticker(row.get("ticker"))
                if t:
                    tickers.append(t)

            label = ev.get("title") or (
                f"IPO {year_iso[:4]}" if ev_type == "ipo" else f"Founded {entity_name or 'company'}"
            )
            payload: dict = {
                "formationLabel": label,
                "entityId": eid,
            }
            if ev_type == "ipo":
                payload["ipoDate"] = year_iso
                payload["formationDate"] = year_iso
                payload["formationType"] = "ipo"
            else:
                payload["foundedDate"] = year_iso
                payload["formationDate"] = year_iso
                payload["formationType"] = "founding"
            for ticker in sorted(set(tickers)):
                set_formation_for_ticker(index, ticker, payload)

    return index


def attach_formation_to_symbol(sym_entry: dict, formation_index: dict[str, dict]) -> None:
    ticker = normalize_entity_ticker(sym_entry.get("ticker"))
    if not ticker:
        return
    info = formation_index.get(ticker)
    if not info:
        return
    for key in ("foundedDate", "ipoDate", "formationDate", "formationType", "formationLabel", "entityId"):
        if info.get(key):
            sym_entry[key] = info[key]


def build_market_ticker_index(market: dict) -> dict[str, dict]:
    """Display ticker → Forbes rank metadata + embedded market chart."""
    idx: dict[str, dict] = {}
    for rank_row in market.get("ranks") or []:
        rank = rank_row.get("rank")
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            if not ticker:
                continue
            key = ticker.upper()
            prev = idx.get(key)
            if prev and (prev.get("forbesRank") or 999) <= (rank or 999):
                continue
            data_ticker = resolve_data_ticker(ticker) or ticker
            idx[key] = {
                "ticker": ticker,
                "dataTicker": data_ticker,
                "entity": sym.get("entity"),
                "forbesRank": rank,
                "forbesName": rank_row.get("name"),
                "sector": rank_row.get("sector"),
                "market_data": sym.get("market") or {},
            }
    return idx


def overlay_chart_points(
    display_ticker: str,
    data_ticker: str,
    market_idx: dict[str, dict],
    charts_dir: Path,
) -> tuple[list[dict], dict | None]:
    """Daily chart points since OVERLAY_WINDOW_START from market-crossover or flip-board."""
    market_row = market_idx.get(display_ticker.upper()) or market_idx.get(data_ticker.upper())
    chart = (market_row or {}).get("market_data", {}).get("chart") if market_row else None
    if not chart and charts_dir.is_dir():
        chart = compact_chart_payload(data_ticker, charts_dir, OVERLAY_WINDOW_START)
    if not chart:
        return [], None
    points = [
        p
        for p in (chart.get("points") or [])
        if (p.get("date") or "") >= OVERLAY_WINDOW_START
    ]
    points = enrich_points_with_volume(points, data_ticker, charts_dir)
    return points, chart


def _append_overlay_symbol(
    *,
    ticker: str,
    data_ticker: str,
    entity: str | None,
    forbes_rank: int | None,
    forbes_name: str | None,
    sector: str | None,
    points: list[dict],
    chart: dict,
    comp_by_ticker: dict[str, dict],
    formation_index: dict[str, dict],
    symbols: list[dict],
    walls: list[dict],
    seen_tickers: set[str],
) -> None:
    if ticker in seen_tickers:
        return
    series = normalize_series(points)
    if not series:
        return
    seen_tickers.add(ticker)
    window_start = series[0]["date"]
    window_end = series[-1]["date"]
    sym_entry: dict = {
        "ticker": ticker,
        "entity": entity,
        "forbesRank": forbes_rank,
        "forbesName": forbes_name,
        "sector": sector,
        "series": series,
    }
    for comp_key in (data_ticker, ticker):
        comp = comp_by_ticker.get(comp_key)
        if comp and comp.get("squeezeScore") is not None:
            sym_entry["squeezeScore"] = comp["squeezeScore"]
            break
    attach_formation_to_symbol(sym_entry, formation_index)
    symbols.append(sym_entry)
    walls.extend(load_timeline_flips(data_ticker, window_start, window_end))
    for f in chart.get("flips") or []:
        fd = f.get("date")
        if not fd or (window_start and fd < window_start) or (window_end and fd > window_end):
            continue
        ft = f.get("type") or "unknown"
        walls.append(
            {
                "ticker": ticker,
                "timeframe": "day",
                "sort": fd,
                "date": fd,
                "type": ft,
                "label": flip_label(ft),
                "source": "chart",
            }
        )


def build_flip_overlay(
    market: dict,
    row_by_id: dict[str, dict],
    compression: list[dict] | None = None,
    tick_manifest: dict | None = None,
    profiles: list[dict] | None = None,
    entity_catalog: dict[str, dict] | None = None,
) -> dict:
    """Bundle normalized Forbes chart series + multi-timeframe flip walls.

    Includes every Forbes tradable symbol with daily chart data from
    market-crossover and/or robinhood-agentic flip-board charts (not only
    symbols already embedded in market-crossover ranks).
    """
    comp_by_ticker = {c["ticker"]: c for c in (compression or []) if c.get("ticker")}
    market_idx = build_market_ticker_index(market)
    formation_index = build_formation_index(
        profiles or [],
        entity_catalog or {},
        tick_manifest,
    )
    symbols: list[dict] = []
    walls: list[dict] = []
    seen_tickers: set[str] = set()
    charts_dir = CHARTS_DIR

    manifest = tick_manifest or {"symbols": [], "skipped": []}
    manifest_entries: list[tuple[str, str, dict]] = []
    for sym in manifest.get("symbols") or []:
        if sym.get("status") == "skip":
            continue
        ticker = sym.get("symbol")
        if not ticker:
            continue
        data_ticker = resolve_data_ticker(ticker) or ticker
        manifest_entries.append((ticker, data_ticker, sym))
    manifest_entries.sort(key=lambda row: (row[2].get("entity") or row[0] or "").lower())

    for ticker, data_ticker, sym in manifest_entries:
        points, chart = overlay_chart_points(ticker, data_ticker, market_idx, charts_dir)
        if not points or not chart:
            continue
        market_row = market_idx.get(ticker.upper()) or market_idx.get(data_ticker.upper())
        _append_overlay_symbol(
            ticker=ticker,
            data_ticker=data_ticker,
            entity=(market_row or {}).get("entity") or sym.get("entity"),
            forbes_rank=(market_row or {}).get("forbesRank"),
            forbes_name=(market_row or {}).get("forbesName"),
            sector=(market_row or {}).get("sector") or sym.get("sector"),
            points=points,
            chart=chart,
            comp_by_ticker=comp_by_ticker,
            formation_index=formation_index,
            symbols=symbols,
            walls=walls,
            seen_tickers=seen_tickers,
        )

    for market_row in market_idx.values():
        ticker = market_row.get("ticker")
        if not ticker or ticker in seen_tickers:
            continue
        data_ticker = market_row.get("dataTicker") or ticker
        points, chart = overlay_chart_points(ticker, data_ticker, market_idx, charts_dir)
        if not points or not chart:
            continue
        _append_overlay_symbol(
            ticker=ticker,
            data_ticker=data_ticker,
            entity=market_row.get("entity"),
            forbes_rank=market_row.get("forbesRank"),
            forbes_name=market_row.get("forbesName"),
            sector=market_row.get("sector"),
            points=points,
            chart=chart,
            comp_by_ticker=comp_by_ticker,
            formation_index=formation_index,
            symbols=symbols,
            walls=walls,
            seen_tickers=seen_tickers,
        )

    # Dedupe walls by ticker + date + type + timeframe
    deduped: dict[str, dict] = {}
    for w in walls:
        key = f"{w['ticker']}::{w['timeframe']}::{w['date']}::{w['type']}"
        deduped[key] = w
    walls = sorted(deduped.values(), key=lambda w: (w.get("date") or "", w.get("ticker") or ""))

    window = {}
    if symbols:
        all_dates = [p["date"] for s in symbols for p in s["series"]]
        window = {"start": min(all_dates), "end": max(all_dates)}

    tf_counts = {tf: 0 for tf in TIMEFRAMES}
    type_counts: dict[str, int] = {}
    for w in walls:
        tf_counts[w.get("timeframe") or "day"] = tf_counts.get(w.get("timeframe") or "day", 0) + 1
        t = w.get("type") or "unknown"
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "asOf": market.get("asOf"),
        "window": window,
        "summary": {
            "symbolCount": len(symbols),
            "wallCount": len(walls),
            "timeframes": tf_counts,
            "flipTypes": type_counts,
        },
        "symbols": symbols,
        "walls": walls,
    }


NARRATIVE_MAX_PER_TICKER = 5
NARRATIVE_FLIP_SIGNAL_MIN = 2025


def alignment_proximity_score(days_apart: float | int | None, window_days: int = 90) -> float:
    if days_apart is None:
        return 0.0
    return max(0.0, 100.0 - (float(days_apart) / window_days) * 100.0)


def alignment_hit_key(hit: dict) -> tuple:
    return (
        hit.get("ticker") or "",
        hit.get("lifecycle") or "",
        hit.get("flipId") or "",
        hit.get("flipSort") or "",
    )


def collect_crossover_alignment_hits(crossover_index: dict | None) -> list[dict]:
    """Lifecycle↔flip proximity hits from forbes-crossover entities, symbols, and patterns."""
    if not crossover_index:
        return []
    seen: set[tuple] = set()
    hits: list[dict] = []

    def add(hit: dict, ticker: str | None, entity: str | None) -> None:
        row = {**hit, "ticker": ticker or hit.get("ticker"), "entity": entity or hit.get("entity")}
        key = alignment_hit_key(row)
        if key in seen:
            return
        seen.add(key)
        hits.append(row)

    for ent in crossover_index.get("entities") or []:
        ticker = ent.get("ticker")
        entity = ent.get("name")
        for hit in ent.get("nearFlips") or []:
            add(hit, ticker, entity)

    for profile in crossover_index.get("billionaires") or []:
        for sym in profile.get("symbols") or []:
            ticker = sym.get("ticker") or sym.get("yahoo")
            entity = sym.get("entity")
            for hit in sym.get("nearFlips") or []:
                add(hit, ticker, entity)

    patterns = crossover_index.get("patterns") or {}
    for hit in patterns.get("topAlignments") or []:
        add(hit, hit.get("ticker"), hit.get("entity"))

    hits.sort(key=lambda h: (h.get("daysApart", 9999), h.get("ticker") or ""))
    return hits


def market_symbol_index(
    market: dict,
    crossover_index: dict | None,
) -> dict[str, dict]:
    """Per-ticker Forbes ranks, market snapshot, and lifecycle labels."""
    idx: dict[str, dict] = {}
    entity_by_ticker: dict[str, dict] = {}
    for ent in (crossover_index or {}).get("entities") or []:
        ticker = ent.get("ticker")
        if ticker:
            entity_by_ticker[ticker] = ent

    for rank_row in market.get("ranks") or []:
        rank = rank_row.get("rank")
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            m = sym.get("market")
            if not ticker or not m:
                continue
            row = idx.setdefault(
                ticker,
                {
                    "ticker": ticker,
                    "entity": sym.get("entity"),
                    "forbesRanks": [],
                    "market": m,
                    "lifecycleEvents": [],
                },
            )
            if rank and rank not in row["forbesRanks"]:
                row["forbesRanks"].append(rank)
            if sym.get("entity"):
                row["entity"] = sym.get("entity")

    for ticker, ent in entity_by_ticker.items():
        row = idx.setdefault(
            ticker,
            {
                "ticker": ticker,
                "entity": ent.get("name"),
                "forbesRanks": [b.get("rank") for b in ent.get("billionaires") or [] if b.get("rank")],
                "market": ent.get("market"),
                "lifecycleEvents": ent.get("lifecycleEvents") or [],
            },
        )
        if ent.get("lifecycleEvents"):
            row["lifecycleEvents"] = ent.get("lifecycleEvents") or []
        if ent.get("market") and not row.get("market"):
            row["market"] = ent.get("market")

    for row in idx.values():
        row["forbesRanks"] = sorted(set(row.get("forbesRanks") or []))
    return idx


def best_lifecycle_label(lifecycle_events: list[dict]) -> tuple[str | None, str | None]:
    """Prefer recent Grok milestone, else latest Forbes lifecycle title."""
    lifecycle = [e for e in lifecycle_events if e.get("lifecycle")]
    if not lifecycle:
        return None, None
    grok = [e for e in lifecycle if e.get("source") == "grok"]
    pick = grok[-1] if grok else lifecycle[-1]
    return pick.get("title"), pick.get("type")


def forbes_rank_title(ranks: list[int], entity: str | None) -> str:
    name = entity or "Company"
    if not ranks:
        return name
    if len(ranks) == 1:
        return f"Forbes #{ranks[0]} · {name}"
    return f"Forbes #{ranks[0]}–#{ranks[-1]} · {name}"


def market_context_subtitle(market: dict) -> str:
    flip = market.get("lastFlip") or {}
    ft = flip.get("type")
    parts: list[str] = []
    if ft:
        price = flip.get("price")
        price_txt = f" · ${price:.2f}" if isinstance(price, (int, float)) else ""
        parts.append(f"{flip_label(ft)}{price_txt}")
    macd = market.get("macdBias")
    bb = market.get("bbPosition")
    if macd:
        parts.append(f"{macd} MACD")
    if bb:
        parts.append(f"BB {bb.replace('_', ' ')}")
    pot = market.get("potential") or {}
    wr = pot.get("winRate")
    if wr is not None:
        parts.append(f"{wr}% win")
    return " · ".join(parts)


def narrative_card(
    *,
    kind: str,
    title: str,
    subtitle: str,
    ticker: str | None,
    entity: str | None,
    alignment_score: float,
    forbes_ranks: list[int] | None = None,
    days_apart: int | None = None,
    lifecycle_source: str | None = None,
    lifecycle_type: str | None = None,
    macd_bias: str | None = None,
    bb_position: str | None = None,
    flip_type: str | None = None,
    flip_date: str | None = None,
) -> dict:
    ranks = sorted(set(forbes_ranks or []))
    tags = [t for t in [ticker, entity, "through-line"] if t]
    return {
        "kind": kind,
        "title": title,
        "subtitle": subtitle,
        "ticker": ticker,
        "entity": entity,
        "forbesRank": ranks[0] if ranks else None,
        "forbesRanks": ranks or None,
        "daysApart": days_apart,
        "alignmentScore": round(alignment_score, 1),
        "lifecycleSource": lifecycle_source,
        "lifecycleType": lifecycle_type,
        "macdBias": macd_bias,
        "bbPosition": bb_position,
        "flipType": flip_type,
        "flipDate": flip_date,
        "tags": tags,
    }


def build_narratives(
    crossover_index: dict | None,
    market: dict,
    stream: list[dict],
) -> list[dict]:
    """Narrative hooks for all Forbes crossover tickers — alignments first, then flip signals."""
    window_days = int(((crossover_index or {}).get("patterns") or {}).get("windowDays") or 90)
    symbol_index = market_symbol_index(market, crossover_index)
    alignment_hits = collect_crossover_alignment_hits(crossover_index)

    by_ticker: dict[str, list[dict]] = defaultdict(list)
    for hit in alignment_hits:
        ticker = hit.get("ticker")
        if not ticker:
            continue
        sym = symbol_index.get(ticker, {})
        ranks = sym.get("forbesRanks") or []
        days = hit.get("daysApart")
        score = alignment_proximity_score(days, window_days)
        title = hit.get("lifecycle") or forbes_rank_title(ranks, hit.get("entity") or sym.get("entity"))
        by_ticker[ticker].append(
            narrative_card(
                kind="alignment",
                title=title,
                subtitle=hit.get("flip") or "",
                ticker=ticker,
                entity=hit.get("entity") or sym.get("entity"),
                alignment_score=score,
                forbes_ranks=ranks,
                days_apart=days,
                lifecycle_source=hit.get("lifecycleSource"),
            )
        )

    for ticker, sym in symbol_index.items():
        market_snap = sym.get("market") or {}
        if not market_snap:
            continue
        existing = len(by_ticker.get(ticker) or [])
        remaining = max(0, NARRATIVE_MAX_PER_TICKER - existing)
        if remaining <= 0:
            continue

        ranks = sym.get("forbesRanks") or []
        entity = sym.get("entity")
        lifecycle_title, lifecycle_type = best_lifecycle_label(sym.get("lifecycleEvents") or [])
        base_title = lifecycle_title or forbes_rank_title(ranks, entity)
        flip_signals: list[dict] = []

        last_flip = market_snap.get("lastFlip") or {}
        last_type = last_flip.get("type")
        if last_type:
            flip_signals.append(
                narrative_card(
                    kind="flip_signal",
                    title=base_title,
                    subtitle=market_context_subtitle(market_snap),
                    ticker=ticker,
                    entity=entity,
                    alignment_score=float((market_snap.get("potential") or {}).get("winRate") or 0),
                    forbes_ranks=ranks,
                    lifecycle_type=lifecycle_type,
                    macd_bias=market_snap.get("macdBias"),
                    bb_position=market_snap.get("bbPosition"),
                    flip_type=last_type,
                    flip_date=last_flip.get("date"),
                )
            )

        seen_flip_keys: set[tuple] = set()
        if last_type and last_flip.get("date"):
            seen_flip_keys.add((last_type, last_flip.get("date")))
        chart_flips = (market_snap.get("chart") or {}).get("flips") or []
        for cf in reversed(chart_flips):
            fd = cf.get("date") or ""
            ft = cf.get("type")
            if not ft or not fd or fd[:4] < str(NARRATIVE_FLIP_SIGNAL_MIN):
                continue
            key = (ft, fd)
            if key in seen_flip_keys:
                continue
            seen_flip_keys.add(key)
            flip_signals.append(
                narrative_card(
                    kind="flip_signal",
                    title=base_title,
                    subtitle=f"{flip_label(ft)} · {fd}",
                    ticker=ticker,
                    entity=entity,
                    alignment_score=max(0.0, float((market_snap.get("potential") or {}).get("winRate") or 0) - 5),
                    forbes_ranks=ranks,
                    lifecycle_type=lifecycle_type,
                    macd_bias=market_snap.get("macdBias"),
                    bb_position=market_snap.get("bbPosition"),
                    flip_type=ft,
                    flip_date=fd,
                )
            )

        by_ticker[ticker].extend(flip_signals[:remaining])

    narratives: list[dict] = []
    for ticker in sorted(by_ticker.keys()):
        cards = by_ticker[ticker]
        cards.sort(key=lambda c: (-(c.get("alignmentScore") or 0), c.get("daysApart") or 9999))
        narratives.extend(cards[:NARRATIVE_MAX_PER_TICKER])

    narratives.sort(
        key=lambda n: (
            0 if n.get("kind") == "alignment" else 1,
            -(n.get("alignmentScore") or 0),
            n.get("ticker") or "",
        )
    )

    grok_recent = [e for e in stream if e.get("kind") == "grok_branch" and e.get("sortKey", "") >= "2024-01-01"]
    flip_recent = [e for e in stream if e.get("kind") == "flip" and e.get("sortKey", "") >= "2025-01-01"]
    if grok_recent and flip_recent:
        narratives.append(
            {
                "kind": "theme",
                "title": "AI infra buildout ↔ public-market volatility",
                "subtitle": f"{len(grok_recent)} Grok/cluster milestones since 2024 · {len(flip_recent)} Forbes-linked flips since 2025",
                "tags": ["colossus", "grok", "flip", "through-line"],
            }
        )
    return narratives


def main() -> int:
    rows_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROWS

    if not MARKET_PATH.is_file():
        print(f"Missing {MARKET_PATH} — run build_market_crossover.py first", file=sys.stderr)
        return 1

    market = load_json(MARKET_PATH)
    profiles = load_json(PROFILES_PATH) if PROFILES_PATH.is_file() else []
    entities = load_json(ENTITIES_PATH) if ENTITIES_PATH.is_file() else []
    grok = load_json(GROK_PATH) if GROK_PATH.is_file() else {}
    world = load_json(WORLD_PATH) if WORLD_PATH.is_file() else {}
    crossover_index = load_json(CROSSOVER_INDEX) if CROSSOVER_INDEX.is_file() else None

    row_by_id: dict[str, dict] = {}
    if rows_path.is_file():
        rows = load_json(rows_path)
        row_by_id = {r["id"]: r for r in rows if r.get("id")}

    compression: list[dict] = []
    seen_tickers: set[str] = set()
    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            if not ticker or ticker in seen_tickers:
                continue
            seen_tickers.add(ticker)
            for cand in ticker_lookup_ids(ticker):
                src = row_by_id.get(cand)
                if src:
                    comp = compression_row(src)
                    if comp:
                        comp["forbesRank"] = rank_row.get("rank")
                        comp["forbesName"] = rank_row.get("name")
                        comp["entity"] = sym.get("entity")
                        compression.append(comp)
                    break

    compression.sort(key=lambda c: (-(c.get("squeezeScore") or 0), c.get("ticker") or ""))

    stream: list[dict] = []
    stream.extend(grok_stream_events(grok))
    stream.extend(milestone_stream_events(profiles))
    stream.extend(flip_stream_events(market))
    stream.extend(world_stream_events(world))

    # Dedupe by id, sort newest first
    by_id: dict[str, dict] = {}
    for ev in stream:
        by_id[ev["id"]] = ev
    stream = sorted(by_id.values(), key=lambda e: e.get("sortKey") or "", reverse=True)

    interlinks = build_interlinks(market, entities, compression)
    interplay_summary = build_interplay_summary(interlinks)
    narratives = build_narratives(crossover_index, market, stream)
    compression_summary = build_compression_summary(compression)
    through_line_summary = build_through_line_summary(market, crossover_index, stream)
    entity_catalog = {e["id"]: e for e in entities if e.get("id")}
    tick_manifest = load_json(MANIFEST_PATH) if MANIFEST_PATH.is_file() else {"symbols": [], "skipped": []}
    ticker_to_entity_id = build_ticker_entity_id_map(entity_catalog, tick_manifest)
    rh_manifest = load_json(ROBINHOOD_YEAR_MANIFEST) if ROBINHOOD_YEAR_MANIFEST.is_file() else None
    through_line_universe = build_through_line_universe(
        tick_manifest,
        market,
        crossover_index,
        rh_manifest,
        row_by_id,
        entity_catalog,
        ticker_to_entity_id,
    )
    through_line_heatmap = build_through_line_heatmap(through_line_universe, rh_manifest, market)
    through_line_speed = build_through_line_speed(through_line_heatmap)
    universe_summary = through_line_universe_summary(through_line_universe)
    through_line_summary = {**through_line_summary, **universe_summary}
    private_earnings = load_json(PRIVATE_EARNINGS_PATH) if PRIVATE_EARNINGS_PATH.is_file() else None
    forbes_rankings = build_forbes_rankings(
        profiles, entity_catalog, market, compression, row_by_id, private_earnings, grok
    )
    forbes_rankings_summary = build_forbes_rankings_summary(forbes_rankings)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "marketCrossover": str(MARKET_PATH.relative_to(ROOT)),
            "grokBranches": str(GROK_PATH.relative_to(ROOT)) if GROK_PATH.is_file() else None,
            "flipBoardRows": "robinhood-agentic/data/flip-board/rows.json" if rows_path.is_file() else None,
            "forbesCrossover": str(CROSSOVER_INDEX) if crossover_index else None,
            "forbesTickManifest": str(MANIFEST_PATH) if MANIFEST_PATH.is_file() else None,
            "robinhoodYear": str(ROBINHOOD_YEAR_MANIFEST) if rh_manifest else None,
            "privateEarnings": str(PRIVATE_EARNINGS_PATH.relative_to(ROOT))
            if PRIVATE_EARNINGS_PATH.is_file()
            else None,
        },
        "asOf": market.get("asOf"),
        "summary": {
            "streamEvents": len(stream),
            "compressionSymbols": len(compression),
            "interlinks": len(interlinks),
            "narratives": len(narratives),
            "kinds": {
                "grok_branch": sum(1 for e in stream if e.get("kind") == "grok_branch"),
                "milestone": sum(1 for e in stream if e.get("kind") == "milestone"),
                "flip": sum(1 for e in stream if e.get("kind") == "flip"),
                "world": sum(1 for e in stream if e.get("kind") == "world"),
            },
        },
        "stream": stream,
        "compression": compression,
        "compressionSummary": compression_summary,
        "interlinks": interlinks,
        "interplaySummary": interplay_summary,
        "narratives": narratives,
        "throughLineSummary": through_line_summary,
        "throughLineUniverse": through_line_universe,
        "throughLineHeatmap": through_line_heatmap,
        "throughLineSpeed": through_line_speed,
        "forbesRankings": forbes_rankings,
        "forbesRankingsSummary": forbes_rankings_summary,
        "patterns": crossover_index.get("patterns") if crossover_index else None,
    }

    overlay = build_flip_overlay(
        market,
        row_by_id,
        compression,
        tick_manifest,
        profiles,
        entity_catalog,
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")

    with OVERLAY_PATH.open("w", encoding="utf-8") as f:
        json.dump(overlay, f, indent=2)
        f.write("\n")

    s = payload["summary"]
    tl = through_line_summary
    osum = overlay["summary"]
    frs = forbes_rankings_summary
    print(f"Wrote {OUT_PATH}")
    print(
        f"  {s['streamEvents']} stream events · {s['compressionSymbols']} compression rows · {s['interlinks']} interlinks"
    )
    print(
        f"  forbesRankings: {frs['people']} people · {frs['holdings']} holdings · "
        f"{frs['withChart']} charts · {frs['withCompression']} compression"
    )
    if tl.get("winner"):
        pct = tl.get("alignmentPct") or tl.get("winPct")
        print(f"  through-line: {pct}% · {tl['winner']} leads ({tl.get('winnerDetail')}) · {tl.get('totalFlips')} flips")
    narrative_tickers = sorted({n.get("ticker") for n in narratives if n.get("ticker")})
    print(f"  narratives: {len(narratives)} cards · {len(narrative_tickers)} tickers ({', '.join(narrative_tickers)})")
    print(f"Wrote {OVERLAY_PATH}")
    print(f"  {osum['symbolCount']} overlay symbols · {osum['wallCount']} flip walls")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
