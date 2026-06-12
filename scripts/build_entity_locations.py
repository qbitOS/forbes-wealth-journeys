#!/usr/bin/env python3
"""Merge known venture HQ coordinates into data/entity-locations.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "entity-locations.json"

# lat, lng, label — public HQ / operating HQs (approximate)
KNOWN_HQ: dict[str, tuple[float, float, str]] = {
    "access": (40.761, -73.975, "Access Industries · New York"),
    "aluminum_products": (40.441, -80.000, "Aluminum · Pittsburgh"),
    "america-movil": (19.432, -99.133, "América Móvil · Mexico City"),
    "antofagasta": (51.507, -0.128, "Antofagasta · London"),
    "arcelormittal": (49.611, 6.130, "ArcelorMittal · Luxembourg"),
    "asian-paints": (19.076, 72.878, "Asian Paints · Mumbai"),
    "aurobindo": (17.494, 78.399, "Aurobindo Pharma · Hyderabad"),
    "bajaj-finserv": (18.520, 73.857, "Bajaj Finserv · Pune"),
    "batteries": (30.274, -97.740, "Battery ops · Austin"),
    "blackstone": (40.761, -73.975, "Blackstone · New York"),
    "bloomberg": (40.753, -73.977, "Bloomberg · New York"),
    "bmw": (48.137, 11.575, "BMW · Munich"),
    "boring-co": (30.110, -97.320, "Boring Company · Bastrop TX"),
    "boring-company": (30.110, -97.320, "Boring Company · Bastrop TX"),
    "catl": (26.665, 119.547, "CATL · Ningde"),
    "cement": (19.076, 72.878, "Cement · Mumbai"),
    "chanel": (48.870, 2.305, "Chanel · Paris"),
    "cheese": (43.769, 11.256, "Food · Florence"),
    "chemicals": (51.050, 6.960, "Chemicals · Leverkusen"),
    "citadel": (25.761, -80.192, "Citadel · Miami"),
    "ck-hutchison": (22.279, 114.165, "CK Hutchison · Hong Kong"),
    "commodities": (51.507, -0.128, "Commodities · London"),
    "computer_hardware": (37.387, -122.083, "Hardware · Silicon Valley"),
    "cryptocurrency": (25.761, -80.192, "Crypto · Miami"),
    "cryptocurrency_exchange": (25.761, -80.192, "Crypto exchange · Miami"),
    "defense_contracting": (38.881, -77.102, "Defense · Washington DC"),
    "discount_brokerage": (42.360, -71.059, "Brokerage · Boston"),
    "diversified": (22.572, 88.364, "Conglomerate · Kolkata"),
    "divis-labs": (17.494, 78.399, "Divi's Labs · Hyderabad"),
    "dr-reddys": (17.494, 78.399, "Dr Reddy's · Hyderabad"),
    "e_commerce": (47.619, -122.349, "E-commerce · Seattle"),
    "fast-retailing": (35.695, 139.691, "Fast Retailing · Tokyo"),
    "fasteners": (19.076, 72.878, "Industrial · Mumbai"),
    "ferrero": (44.801, 8.035, "Ferrero · Alba"),
    "fidelity": (42.353, -71.055, "Fidelity · Boston"),
    "financial_software": (40.761, -73.975, "FinTech · New York"),
    "gas": (29.760, -95.370, "Energy · Houston"),
    "gold": (46.948, 7.447, "Gold · Bern"),
    "grupo-mexico": (19.432, -99.133, "Grupo México · Mexico City"),
    "gvk": (17.494, 78.399, "GVK · Hyderabad"),
    "hca": (36.162, -86.781, "HCA · Nashville"),
    "hedge_funds": (40.761, -73.975, "Hedge funds · New York"),
    "infrastructure": (28.613, 77.209, "Infrastructure · New Delhi"),
    "investments": (40.761, -73.975, "Investments · New York"),
    "jindal": (28.613, 77.209, "Jindal · New Delhi"),
    "koch": (37.687, -97.330, "Koch · Wichita"),
    "koch_inc": (37.687, -97.330, "Koch Industries · Wichita"),
    "kuehne-nagel": (47.173, 8.823, "Kuehne+Nagel · Schindellegi"),
    "luxury_goods": (45.464, 9.190, "Luxury · Milan"),
    "lvs": (36.114, -115.173, "Las Vegas Sands · Las Vegas"),
    "machinery": (52.520, 13.405, "Machinery · Berlin"),
    "marico": (19.076, 72.878, "Marico · Mumbai"),
    "mars-inc": (38.933, -77.177, "Mars · McLean VA"),
    "midea": (23.021, 113.122, "Midea · Foshan"),
    "msc": (46.204, 6.143, "MSC · Geneva"),
    "netease": (30.274, 120.155, "NetEase · Hangzhou"),
    "neuralink": (37.548, -122.059, "Neuralink · Fremont"),
    "nike": (45.520, -122.837, "Nike · Beaverton"),
    "nongfu": (30.274, 120.155, "Nongfu Spring · Hangzhou"),
    "norilsk-nickel": (55.755, 37.617, "Nornickel · Moscow"),
    "oil": (29.760, -95.370, "Oil & gas · Houston"),
    "openai": (37.792, -122.404, "OpenAI · San Francisco"),
    "pharmaceuticals": (40.058, -74.405, "Pharma · New Jersey"),
    "pidilite": (19.076, 72.878, "Pidilite · Mumbai"),
    "pinduoduo": (31.230, 121.474, "Pinduoduo · Shanghai"),
    "real_estate": (40.758, -73.985, "Real estate · New York"),
    "red_bull": (47.803, 13.300, "Red Bull · Fuschl am See"),
    "samsung": (37.566, 126.978, "Samsung · Seoul"),
    "schwarz-group": (49.193, 9.224, "Schwarz Group · Neckarsulm"),
    "serum-institute": (18.520, 73.857, "Serum Institute · Pune"),
    "shipping": (51.924, 4.478, "Shipping · Rotterdam"),
    "solarcity": (37.548, -121.989, "SolarCity · Fremont"),
    "spacex-hawthorne": (33.920, -118.328, "SpaceX · Hawthorne"),
    "steel": (40.441, -79.996, "Steel · Pittsburgh"),
    "sun-pharma": (19.076, 72.878, "Sun Pharma · Mumbai"),
    "transport": (52.367, 4.904, "Transport · Amsterdam"),
    "x-corp": (37.776, -122.417, "X Corp · San Francisco"),
    "xcorp": (37.776, -122.417, "X Corp · San Francisco"),
    "twitter": (37.776, -122.417, "X · San Francisco"),
    "zip2": (37.444, -122.149, "Zip2 · Palo Alto"),
    "paypal": (37.375, -121.964, "PayPal · San Jose"),
    "tesla": (30.267, -97.743, "Tesla · Austin"),
    "spacex": (25.997, -97.155, "SpaceX · Starbase"),
    "xai": (37.785, -122.406, "xAI · San Francisco"),
    "google": (37.422, -122.084, "Google · Mountain View"),
    "alphabet": (37.422, -122.084, "Alphabet · Mountain View"),
    "meta": (37.484, -122.148, "Meta · Menlo Park"),
    "facebook": (37.484, -122.148, "Meta · Menlo Park"),
    "amazon": (47.619, -122.338, "Amazon · Seattle"),
    "microsoft": (47.639, -122.134, "Microsoft · Redmond"),
    "nvidia": (37.371, -121.966, "NVIDIA · Santa Clara"),
    "apple": (37.331, -122.011, "Apple · Cupertino"),
    "oracle": (30.267, -97.743, "Oracle · Austin"),
    "dell": (30.395, -97.671, "Dell · Round Rock"),
    "berkshire": (41.256, -95.934, "Berkshire · Omaha"),
    "lvmh": (48.870, 2.305, "LVMH · Paris"),
    "loreal": (48.892, 2.238, "L'Oréal · Clichy"),
    "reliance": (19.017, 72.847, "Reliance · Mumbai"),
    "adani": (23.023, 72.571, "Adani · Ahmedabad"),
    "alibaba": (30.279, 120.020, "Alibaba · Hangzhou"),
    "tencent": (22.540, 114.059, "Tencent · Shenzhen"),
    "bytedance": (39.984, 116.312, "ByteDance · Beijing"),
    "softbank": (35.680, 139.769, "SoftBank · Tokyo"),
    "arm": (52.205, 0.121, "Arm · Cambridge"),
    "zara": (43.361, -5.849, "Inditex · Arteixo"),
    "inditex": (43.361, -5.849, "Inditex · Arteixo"),
    "walmart": (36.366, -94.217, "Walmart · Bentonville"),
    "saudi-aramco": (26.295, 50.114, "Aramco · Dhahran"),
    "tsmc": (24.784, 121.011, "TSMC · Hsinchu"),
}

COMPANY_ALIASES: dict[str, str] = {
    "the boring company": "boring-co",
    "boring company": "boring-co",
    "x corp": "x-corp",
    "x corp.": "x-corp",
    "x": "x-corp",
    "twitter": "x-corp",
    "xai": "xai",
    "x.ai": "xai",
    "google x": "alphabet",
    "facebook": "meta",
    "brk": "berkshire",
    "berkshire hathaway": "berkshire",
    "l'oréal": "loreal",
    "loreal": "loreal",
    "uniqlo": "fast-retailing",
    "mars": "mars-inc",
    "red bull": "red_bull",
    "america movil": "america-movil",
    "américa móvil": "america-movil",
    "las vegas sands": "lvs",
    "kuehne + nagel": "kuehne-nagel",
    "ck hutchison": "ck-hutchison",
    "grupo mexico": "grupo-mexico",
    "nongfu spring": "nongfu",
    "sun pharmaceutical": "sun-pharma",
    "norilsk nickel": "norilsk-nickel",
    "schwarz group": "schwarz-group",
    "serum institute": "serum-institute",
}


def slug(name: str) -> str:
    return name.lower().strip().replace(" ", "-").replace("_", "-")


def main() -> None:
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    entities: dict = dict(payload.get("entities") or {})

    for key, (lat, lng, label) in KNOWN_HQ.items():
        entities[key] = {"lat": lat, "lng": lng, "label": label}

    for alias, target in COMPANY_ALIASES.items():
        if target in KNOWN_HQ:
            lat, lng, label = KNOWN_HQ[target]
            entities[slug(alias)] = {"lat": lat, "lng": lng, "label": label}

    entities_path = ROOT / "data" / "entities.json"
    if entities_path.exists():
        catalog = json.loads(entities_path.read_text(encoding="utf-8"))
        for ent in catalog:
            eid = ent.get("id")
            if not eid or eid in entities:
                continue
            if eid in KNOWN_HQ:
                lat, lng, label = KNOWN_HQ[eid]
                entities[eid] = {"lat": lat, "lng": lng, "label": label}

    payload["entities"] = dict(sorted(entities.items()))
    payload["schemaVersion"] = 1
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['entities'])} entity locations to {OUT}")


if __name__ == "__main__":
    main()
