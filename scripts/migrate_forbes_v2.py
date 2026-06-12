#!/usr/bin/env python3
"""Migrate forbes-billionaires.json to v2 schema (structured netWorth, entities, etc.)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "forbes-billionaires.json"
AS_OF = "2026-06-11"

# Grok-enriched profiles (match by name; rank in file may differ from Grok snapshot)
ENRICHED_BY_NAME: dict[str, dict[str, Any]] = {
    "Elon Musk": {
        "rank": 1,
        "name": "Elon Musk",
        "netWorth": {"value": 794.6, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "age": 55,
        "country": "United States",
        "sector": "Technology",
        "grokipediaLink": "https://grok.x.ai/wiki/elon-musk",
        "forbesProfile": "https://www.forbes.com/profile/elon-musk/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Elon_Musk",
        "wealthBreakdown": [
            {"entity": "Tesla", "ticker": "TSLA", "stakePct": 12.8, "valueUsdB": 120, "type": "public"},
            {"entity": "SpaceX", "stakePct": 42, "valueUsdB": 400, "type": "private"},
            {"entity": "xAI", "stakePct": 100, "valueUsdB": 50, "type": "private"},
            {"entity": "Neuralink", "stakePct": 100, "valueUsdB": 15, "type": "private"},
        ],
        "entities": [
            {"id": "spacex", "name": "SpaceX", "role": "founder_ceo", "founded": 2002, "status": "private", "valuationUsdB": 350},
            {"id": "tesla", "name": "Tesla", "role": "ceo", "founded": 2003, "status": "public", "ticker": "TSLA"},
            {"id": "xai", "name": "xAI", "role": "founder", "founded": 2023, "status": "private"},
        ],
        "summary": "Serial entrepreneur who built the world's most valuable car company and the leading private space program.",
        "timeline": [
            {"year": "1995", "type": "founding", "entityId": "zip2", "title": "Founded Zip2", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Zip2"},
            {"year": "1999", "type": "exit", "entityId": "paypal", "title": "Sold PayPal", "valuationUsdB": 1.5, "source": "https://www.forbes.com/profile/elon-musk/"},
            {"year": "2002", "type": "founding", "entityId": "spacex", "title": "Founded SpaceX", "valuationUsdB": 350, "source": "https://www.spacex.com"},
            {"year": "2004", "type": "investment", "entityId": "tesla", "title": "Led Tesla investment", "valuationUsdB": None, "source": "https://www.tesla.com"},
            {"year": "2023", "type": "founding", "entityId": "xai", "title": "Founded xAI", "valuationUsdB": 50, "source": "https://x.ai"},
            {"year": "2025", "type": "funding", "entityId": "xai", "title": "xAI $6B Series B", "valuationUsdB": 50, "source": "https://techcrunch.com"},
        ],
    },
    "Larry Page": {
        "rank": 2,
        "name": "Larry Page",
        "netWorth": {"value": 292.7, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "age": 53,
        "country": "United States",
        "sector": "Technology",
        "grokipediaLink": "https://grok.x.ai/wiki/larry-page",
        "forbesProfile": "https://www.forbes.com/profile/larry-page/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Larry_Page",
        "wealthBreakdown": [
            {"entity": "Alphabet", "ticker": "GOOGL", "stakePct": 6, "valueUsdB": 280, "type": "public"},
            {"entity": "Google X", "stakePct": 100, "valueUsdB": 12, "type": "private"},
        ],
        "entities": [{"id": "google", "name": "Google", "role": "co-founder", "founded": 1998, "status": "public"}],
        "summary": "Co-founder of Google; now focuses on moonshot projects at Alphabet.",
        "timeline": [
            {"year": "1998", "type": "founding", "entityId": "google", "title": "Co-founded Google", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Google"},
            {"year": "2004", "type": "ipo", "entityId": "google", "title": "Google IPO", "valuationUsdB": None, "source": "https://www.sec.gov"},
            {"year": "2015", "type": "restructuring", "entityId": "alphabet", "title": "Alphabet restructuring", "valuationUsdB": None, "source": "https://abc.xyz"},
        ],
    },
    "Sergey Brin": {
        "rank": 3,
        "name": "Sergey Brin",
        "netWorth": {"value": 270, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "age": 53,
        "country": "United States",
        "sector": "Technology",
        "grokipediaLink": "https://grok.x.ai/wiki/sergey-brin",
        "forbesProfile": "https://www.forbes.com/profile/sergey-brin/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Sergey_Brin",
        "wealthBreakdown": [{"entity": "Alphabet", "ticker": "GOOGL", "stakePct": 5.8, "valueUsdB": 260, "type": "public"}],
        "entities": [{"id": "google", "name": "Google", "role": "co-founder", "founded": 1998, "status": "public"}],
        "summary": "Co-founder of Google; leads Google X moonshot factory.",
        "timeline": [
            {"year": "1998", "type": "founding", "entityId": "google", "title": "Co-founded Google", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Google"},
            {"year": "2004", "type": "ipo", "entityId": "google", "title": "Google IPO", "valuationUsdB": None, "source": "https://www.sec.gov"},
        ],
    },
    "Jeff Bezos": {
        "rank": 4,
        "name": "Jeff Bezos",
        "netWorth": {"value": 251.5, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "age": 62,
        "country": "United States",
        "sector": "Retail / Technology",
        "grokipediaLink": "https://grok.x.ai/wiki/jeff-bezos",
        "forbesProfile": "https://www.forbes.com/profile/jeff-bezos/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Jeff_Bezos",
        "wealthBreakdown": [
            {"entity": "Amazon", "ticker": "AMZN", "stakePct": 9.5, "valueUsdB": 220, "type": "public"},
            {"entity": "Blue Origin", "stakePct": 100, "valueUsdB": 30, "type": "private"},
        ],
        "entities": [{"id": "amazon", "name": "Amazon", "role": "founder", "founded": 1994, "status": "public"}],
        "summary": "Founder of Amazon; transformed global retail and cloud computing.",
        "timeline": [
            {"year": "1994", "type": "founding", "entityId": "amazon", "title": "Founded Amazon", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Amazon"},
            {"year": "1997", "type": "ipo", "entityId": "amazon", "title": "Amazon IPO", "valuationUsdB": None, "source": "https://www.sec.gov"},
            {"year": "2024", "type": "liquidity", "entityId": "amazon", "title": "Bezos selling AMZN shares", "valuationUsdB": None, "source": "https://www.forbes.com"},
        ],
    },
    "Larry Ellison": {
        "rank": 5,
        "name": "Larry Ellison",
        "netWorth": {"value": 230.1, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "age": 82,
        "country": "United States",
        "sector": "Technology",
        "grokipediaLink": "https://grok.x.ai/wiki/larry-ellison",
        "forbesProfile": "https://www.forbes.com/profile/larry-ellison/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Larry_Ellison",
        "wealthBreakdown": [{"entity": "Oracle", "ticker": "ORCL", "stakePct": 42, "valueUsdB": 220, "type": "public"}],
        "entities": [{"id": "oracle", "name": "Oracle", "role": "co-founder", "founded": 1977, "status": "public"}],
        "summary": "Co-founder and chairman of Oracle Corporation.",
        "timeline": [
            {"year": "1977", "type": "founding", "entityId": "oracle", "title": "Founded Oracle", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Oracle_Corporation"},
        ],
    },
    "Mark Zuckerberg": {
        "name": "Mark Zuckerberg",
        "netWorth": {"value": 222, "unit": "B", "currency": "USD", "asOf": AS_OF},
        "grokipediaLink": "https://grok.x.ai/wiki/mark-zuckerberg",
        "forbesProfile": "https://www.forbes.com/profile/mark-zuckerberg/",
        "wikipediaLink": "https://en.wikipedia.org/wiki/Mark_Zuckerberg",
        "wealthBreakdown": [{"entity": "Meta", "ticker": "META", "stakePct": 13.5, "valueUsdB": 210, "type": "public"}],
        "entities": [{"id": "meta", "name": "Meta", "role": "founder_ceo", "founded": 2004, "status": "public"}],
        "summary": "Founder of Facebook / Meta Platforms.",
        "timeline": [
            {"year": "2004", "type": "founding", "entityId": "meta", "title": "Founded Facebook", "valuationUsdB": None, "source": "https://en.wikipedia.org/wiki/Meta_Platforms"},
            {"year": "2012", "type": "ipo", "entityId": "meta", "title": "Facebook IPO", "valuationUsdB": None, "source": "https://www.sec.gov"},
        ],
    },
}


def slugify(name: str) -> str:
    base = name.split("&")[0].strip()
    base = re.sub(r"\s+family$", "", base, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def parse_net_worth(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict) and "value" in raw:
        return raw
    s = str(raw).replace("$", "").strip()
    if s.endswith("B"):
        return {"value": float(s[:-1]), "unit": "B", "currency": "USD", "asOf": AS_OF}
    if s.endswith("M"):
        return {"value": float(s[:-1]), "unit": "M", "currency": "USD", "asOf": AS_OF}
    return {"value": float(s), "unit": "B", "currency": "USD", "asOf": AS_OF}


def infer_event_type(title: str) -> str:
    t = title.lower()
    if "ipo" in t:
        return "ipo"
    if any(w in t for w in ("founded", "co-founded", "launched", "started")):
        return "founding"
    if any(w in t for w in ("acquired", "acquires", "merger", "merged")):
        return "acquisition"
    if any(w in t for w in ("sold", "exit", "took private")):
        return "exit"
    if "restruct" in t or "rebrand" in t:
        return "restructuring"
    if any(w in t for w in ("series", "funding", "raised")):
        return "funding"
    if any(w in t for w in ("selling", "liquidity", "stake")):
        return "liquidity"
    return "milestone"


def entity_id_from_name(name: str) -> str:
    return slugify(name).replace("-", "_")[:32]


def migrate_timeline(events: list[dict[str, Any]], entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entity_ids = {e["name"].lower(): e["id"] for e in entities}
    out = []
    for ev in events:
        if ev.get("type") and "source" in ev:
            out.append(ev)
            continue
        title = ev.get("title", "")
        eid = None
        for name, eid_val in entity_ids.items():
            if name in title.lower():
                eid = eid_val
                break
        migrated = {
            "year": ev.get("year", "—"),
            "type": infer_event_type(title),
            "entityId": eid,
            "title": title,
            "valuationUsdB": ev.get("valuationUsdB"),
            "source": ev.get("source"),
        }
        if ev.get("description") and not migrated.get("source"):
            migrated["description"] = ev["description"]
        if ev.get("impact"):
            migrated["impact"] = ev["impact"]
        out.append(migrated)
    return out


def companies_to_entities(companies: list[str], source: str) -> list[dict[str, Any]]:
    names = companies or [p.strip() for p in source.split(",") if p.strip()]
    entities = []
    for name in names[:6]:
        eid = entity_id_from_name(name)
        entities.append(
            {
                "id": eid,
                "name": name,
                "role": "founder",
                "status": "private",
            }
        )
    return entities


def wealth_breakdown_from_source(source: str, net: dict[str, Any]) -> list[dict[str, Any]]:
    parts = [p.strip() for p in source.split(",") if p.strip()]
    if not parts:
        return []
    share = round(net["value"] / len(parts), 1) if net.get("value") else None
    return [
        {"entity": p, "stakePct": None, "valueUsdB": share, "type": "private"}
        for p in parts[:4]
    ]


def migrate_entry(entry: dict[str, Any]) -> dict[str, Any]:
    name = entry["name"]
    if name in ENRICHED_BY_NAME:
        merged = {**entry, **ENRICHED_BY_NAME[name]}
        merged["rank"] = entry["rank"]
        if entry.get("age") not in (None, "—") and ENRICHED_BY_NAME[name].get("age") is None:
            merged["age"] = entry["age"]
        return merged

    if isinstance(entry.get("netWorth"), dict) and entry.get("wealthBreakdown") is not None:
        return entry

    net = parse_net_worth(entry.get("netWorth", "0"))
    slug = slugify(name)
    companies = entry.get("companies") or []
    source = entry.get("sourceOfWealth", "")
    entities = companies_to_entities(companies, source)

    migrated = {
        "rank": entry["rank"],
        "name": name,
        "netWorth": net,
        "age": entry.get("age"),
        "country": entry.get("country"),
        "sector": entry.get("sector"),
        "grokipediaLink": f"https://grok.x.ai/wiki/{slug}",
        "forbesProfile": f"https://www.forbes.com/profile/{slug}/",
        "wikipediaLink": f"https://en.wikipedia.org/wiki/{name.replace(' ', '_')}",
        "wealthBreakdown": wealth_breakdown_from_source(source, net),
        "entities": entities,
        "summary": entry.get("summary", ""),
        "timeline": migrate_timeline(entry.get("timeline", []), entities),
    }
    if entry.get("firstFortuneDecade"):
        migrated["firstFortuneDecade"] = entry["firstFortuneDecade"]
    return migrated


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    migrated = [migrate_entry(e) for e in data]
    migrated.sort(key=lambda e: (e["rank"], e["name"].casefold()))
    DATA_PATH.write_text(json.dumps(migrated, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    v2 = sum(1 for e in migrated if isinstance(e.get("netWorth"), dict))
    enriched = sum(1 for e in migrated if e.get("wealthBreakdown") and e["wealthBreakdown"][0].get("stakePct"))
    print(f"Migrated {len(migrated)} entries -> {DATA_PATH}")
    print(f"v2 netWorth: {v2}/{len(migrated)} · detailed breakdown: {enriched}")


if __name__ == "__main__":
    main()
