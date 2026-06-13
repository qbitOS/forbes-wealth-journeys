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
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTIC = Path(os.environ.get("AGENTIC_REPO", str(ROOT.parent / "robinhood-agentic")))

MARKET_PATH = ROOT / "data/market-crossover.json"
PROFILES_PATH = ROOT / "data/forbes-billionaires.json"
ENTITIES_PATH = ROOT / "data/entities.json"
GROK_PATH = ROOT / "data/grok-branch-events.json"
WORLD_PATH = ROOT / "data/world-context-events.json"
CROSSOVER_INDEX = AGENTIC / "data/forbes-crossover/index.json"
DEFAULT_ROWS = AGENTIC / "data/flip-board/rows.json"
TIMELINES_DIR = AGENTIC / "data/flip-board/timelines"
OUT_PATH = ROOT / "data/industry-stream.json"
OVERLAY_PATH = ROOT / "data/flip-overlay.json"

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
    for p in points:
        close = p.get("close")
        if close is None:
            continue
        bb_u, bb_l, bb_m = p.get("bbU"), p.get("bbL"), p.get("bbM")
        bb_width = None
        if bb_u is not None and bb_l is not None and bb_m:
            bb_width = round((bb_u - bb_l) / bb_m, 6)
        out.append(
            {
                "date": p.get("date"),
                "close": close,
                "norm": round(100 * close / base, 4),
                "bbWidth": bb_width,
            }
        )
    return out


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


def build_flip_overlay(market: dict, row_by_id: dict[str, dict]) -> dict:
    """Bundle normalized Forbes chart series + multi-timeframe flip walls."""
    symbols: list[dict] = []
    walls: list[dict] = []
    seen_tickers: set[str] = set()

    for rank_row in market.get("ranks") or []:
        for sym in rank_row.get("symbols") or []:
            ticker = sym.get("ticker")
            if not ticker or ticker in seen_tickers:
                continue
            market_data = sym.get("market") or {}
            chart = market_data.get("chart") or {}
            points = chart.get("points") or []
            if not points:
                continue
            seen_tickers.add(ticker)
            series = normalize_series(points)
            if not series:
                continue
            window_start = series[0]["date"]
            window_end = series[-1]["date"]
            symbols.append(
                {
                    "ticker": ticker,
                    "entity": sym.get("entity"),
                    "forbesRank": rank_row.get("rank"),
                    "forbesName": rank_row.get("name"),
                    "sector": rank_row.get("sector") or market_data.get("sector"),
                    "series": series,
                }
            )
            walls.extend(load_timeline_flips(ticker, window_start, window_end))
            # Day flips from embedded chart (finer MACD/BB detection)
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


def build_narratives(crossover_index: dict | None, stream: list[dict]) -> list[dict]:
    narratives: list[dict] = []
    if crossover_index and crossover_index.get("patterns", {}).get("topAlignments"):
        for hit in crossover_index["patterns"]["topAlignments"][:12]:
            narratives.append(
                {
                    "kind": "alignment",
                    "title": hit.get("lifecycle"),
                    "subtitle": hit.get("flip"),
                    "daysApart": hit.get("daysApart"),
                    "ticker": hit.get("ticker"),
                    "entity": hit.get("entity"),
                    "lifecycleSource": hit.get("lifecycleSource"),
                    "tags": [hit.get("ticker") or "", hit.get("entity") or "", "through-line"],
                }
            )
    # Branch co-occurrence: grok cluster events near flips on linked tickers
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
    narratives = build_narratives(crossover_index, stream)
    compression_summary = build_compression_summary(compression)
    through_line_summary = build_through_line_summary(market, crossover_index, stream)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "marketCrossover": str(MARKET_PATH.relative_to(ROOT)),
            "grokBranches": str(GROK_PATH.relative_to(ROOT)) if GROK_PATH.is_file() else None,
            "flipBoardRows": "robinhood-agentic/data/flip-board/rows.json" if rows_path.is_file() else None,
            "forbesCrossover": str(CROSSOVER_INDEX) if crossover_index else None,
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
        "patterns": crossover_index.get("patterns") if crossover_index else None,
    }

    overlay = build_flip_overlay(market, row_by_id)

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
    print(f"Wrote {OUT_PATH}")
    print(f"  {s['streamEvents']} stream events · {s['compressionSymbols']} compression rows · {s['interlinks']} interlinks")
    if tl.get("winner"):
        pct = tl.get("alignmentPct") or tl.get("winPct")
        print(f"  through-line: {pct}% · {tl['winner']} leads ({tl.get('winnerDetail')}) · {tl.get('totalFlips')} flips")
    print(f"Wrote {OVERLAY_PATH}")
    print(f"  {osum['symbolCount']} overlay symbols · {osum['wallCount']} flip walls")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
