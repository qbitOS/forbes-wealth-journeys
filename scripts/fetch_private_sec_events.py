#!/usr/bin/env python3
"""Fetch SEC EDGAR events for Forbes private entities (free, no API key).

Prototype fetcher for Form D / S-1 / 10-K / 10-Q hits. Output merges with
existing Forbes/Grok proxy events in data/private-earnings-events.json.

Usage:
  python3 scripts/fetch_private_sec_events.py
  python3 scripts/fetch_private_sec_events.py --entity spacex --entity xai

SEC full-text search: https://efts.sec.gov/LATEST/search-index
Rate limit: include descriptive User-Agent per SEC fair-access policy.
"""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "data/private-earnings-events.json"

USER_AGENT = "forbes-wealth-journeys research contact@example.com"

# entity_id → SEC search query (company name fragment)
ENTITY_QUERIES: dict[str, str] = {
    "spacex": "SPACE EXPLORATION TECHNOLOGIES",
    "xai": "xAI",
    "bytedance": "ByteDance",
    "neuralink": "Neuralink",
    "citadel": "Citadel",
    "koch": "Koch Industries",
}

FORMS = "D,S-1,S-1/A,10-K,10-Q,8-K"


def sec_search(query: str, start: str = "2020-01-01", end: str = "2026-12-31") -> list[dict]:
    q = urllib.parse.quote(f'"{query}"')
    url = (
        f"https://efts.sec.gov/LATEST/search-index?q={q}"
        f"&forms={FORMS}&dateRange=custom&startdt={start}&enddt={end}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    hits: list[dict] = []
    for h in data.get("hits", {}).get("hits", []):
        src = h.get("_source") or {}
        names = src.get("display_names") or []
        # Keep hits that mention our query entity (reduce noise)
        blob = " ".join(names).lower()
        if query.lower().split()[0] not in blob and query.lower() not in blob:
            continue
        hits.append(
            {
                "form": src.get("form"),
                "fileDate": src.get("file_date"),
                "displayNames": names[:2],
                "ciks": src.get("ciks"),
            }
        )
    return hits


def filing_to_event(entity_id: str, filing: dict) -> dict:
    form = filing.get("form") or "FILING"
    date = filing.get("fileDate") or "0000-00-00"
    names = filing.get("displayNames") or []
    title = f"{form} · {names[0][:60]}" if names else form
    event_type = {
        "D": "funding",
        "S-1": "ipo_filing",
        "S-1/A": "ipo_filing",
        "10-K": "annual_report",
        "10-Q": "quarterly_report",
        "8-K": "material_event",
    }.get(form, "sec_filing")
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:40]
    return {
        "id": f"{entity_id}-sec-{date}-{slug}",
        "date": date,
        "sortKey": date,
        "eventType": event_type,
        "kind": "sec_filing",
        "title": title,
        "form": form,
        "secCiks": filing.get("ciks"),
        "source": "sec-edgar",
        "confidence": "high",
    }


def load_existing() -> dict:
    if OUT_PATH.is_file():
        return json.loads(OUT_PATH.read_text(encoding="utf-8"))
    return {"version": 1, "entities": []}


def merge_events(existing_events: list[dict], fetched: list[dict]) -> list[dict]:
    by_id = {e["id"]: e for e in existing_events}
    for ev in fetched:
        by_id[ev["id"]] = ev
    return sorted(by_id.values(), key=lambda e: e.get("sortKey") or "")


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch SEC events for private Forbes entities")
    ap.add_argument("--entity", action="append", help="entity_id (default: spacex xai bytedance)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    entity_ids = args.entity or ["spacex", "xai", "bytedance"]

    doc = load_existing()
    entity_by_id = {e["entityId"]: e for e in doc.get("entities") or []}

    for eid in entity_ids:
        query = ENTITY_QUERIES.get(eid)
        if not query:
            print(f"skip {eid}: no query mapping")
            continue
        filings = sec_search(query)
        sec_events = [filing_to_event(eid, f) for f in filings[:12]]
        print(f"{eid}: {len(filings)} SEC hits → {len(sec_events)} events kept")
        if eid not in entity_by_id:
            entity_by_id[eid] = {
                "entityId": eid,
                "name": eid,
                "status": "private",
                "events": [],
            }
        entity_by_id[eid]["events"] = merge_events(
            entity_by_id[eid].get("events") or [], sec_events
        )
        entity_by_id[eid]["secFetchedAt"] = datetime.now(timezone.utc).isoformat()

    doc["generatedAt"] = datetime.now(timezone.utc).isoformat()
    doc["entities"] = sorted(entity_by_id.values(), key=lambda e: e.get("entityId") or "")

    if args.dry_run:
        print(json.dumps(doc, indent=2)[:2000])
        return

    OUT_PATH.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
