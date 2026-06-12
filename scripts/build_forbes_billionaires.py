#!/usr/bin/env python3
"""Build Forbes billionaire dataset from live API + Grok overrides."""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

def _events(*rows: tuple[str, str, str, str]) -> list[dict[str, str]]:
    return [
        {"year": y, "title": t, "description": d, "impact": i}
        for y, t, d, i in rows
    ]


TIMELINES: dict[str, list[dict[str, str]]] = {
    "Elon Musk": _events(
        ("1995", "Founded Zip2", "Online city guide software sold for $307M in 1999.", "First major exit"),
        ("1999", "Founded X.com → PayPal", "Sold to eBay for $1.5B in 2002.", "$180M personal stake"),
        ("2002", "Founded SpaceX", "First reusable rocket landings; Starlink constellation.", "NASA contracts"),
        ("2004", "Led Tesla investment & CEO", "Turned Tesla into the world's most valuable car company.", "Trillion-dollar valuation peaks"),
    ),
    "Larry Page": _events(
        ("1998", "Co-founded Google", "With Sergey Brin at Stanford.", "Search engine revolution"),
        ("2004", "Google IPO", "Public offering at $85/share; dual-class structure preserved control.", "Created two multi-billionaires"),
        ("2015", "Alphabet restructuring", "Moved to parent company structure.", "Moonshot focus"),
    ),
    "Sergey Brin": _events(
        ("1998", "Co-founded Google", "PageRank algorithm with Larry Page at Stanford.", "Search engine revolution"),
        ("2004", "Google IPO", "Public offering alongside Page; retained super-voting shares.", "Multi-billionaire status"),
        ("2015", "Alphabet restructuring", "Google X and Other Bets under Alphabet umbrella.", "Moonshot focus"),
    ),
    "Jeff Bezos": _events(
        ("1994", "Founded Amazon", "Started in garage selling books online.", "E-commerce empire"),
        ("1997", "Amazon IPO", "Raised $54M at $18/share; survived dot-com bust.", "Public market foundation"),
        ("2006", "Launched AWS", "Cloud computing became Amazon's profit engine.", "Dominant cloud platform"),
        ("2018", "Blue Origin milestones", "New Shepard suborbital tourism and heavy-lift rockets.", "Space tourism"),
    ),
    "Larry Ellison": _events(
        ("1977", "Founded Oracle", "Relational database software for enterprise clients.", "Database giant"),
        ("1986", "Oracle IPO", "Went public one day before Microsoft.", "Enterprise software wealth base"),
        ("2010", "Acquired Sun Microsystems", "Expanded into hardware and Java ecosystem.", "Diversified Oracle stack"),
    ),
    "Michael Dell": _events(
        ("1984", "Founded Dell", "Started PC company from University of Texas dorm room.", "Direct-to-consumer PCs"),
        ("1988", "Dell IPO", "One of fastest-growing PC makers of the 1990s.", "Public market scale"),
        ("2013", "Took Dell private", "$24.9B leveraged buyout to reshape company.", "Enterprise pivot"),
        ("2016", "Merged with EMC", "Created Dell Technologies; storage and cloud expansion.", "IT infrastructure giant"),
    ),
    "Mark Zuckerberg": _events(
        ("2004", "Launched Facebook", "Started at Harvard; expanded to global social network.", "Social media dominance"),
        ("2012", "Facebook IPO", "Largest tech IPO at the time at $38/share.", "Multi-billionaire at 28"),
        ("2014", "Acquired WhatsApp & Instagram", "Consolidated messaging and photo sharing.", "Billions of daily users"),
        ("2021", "Rebranded to Meta", "Pivoted company toward metaverse and AI.", "Next computing platform bet"),
    ),
    "Jensen Huang": _events(
        ("1993", "Co-founded NVIDIA", "Graphics chips for gaming and professional visualization.", "GPU pioneer"),
        ("1999", "Invented the GPU", "GeForce brand defined consumer 3D graphics.", "Gaming hardware leader"),
        ("2012", "CUDA platform", "General-purpose GPU computing for AI and HPC.", "AI infrastructure foundation"),
        ("2023", "AI chip boom", "Data-center GPUs became essential for LLM training.", "Trillion-dollar market cap"),
    ),
    "Bernard Arnault & family": _events(
        ("1984", "Acquired Boussac", "Bought textile group including Christian Dior.", "Luxury empire seed"),
        ("1987", "Created LVMH", "Merged Louis Vuitton with Moët Hennessy.", "World's largest luxury group"),
        ("1990s", "Brand acquisitions", "Added Givenchy, Sephora, TAG Heuer, and more.", "Portfolio diversification"),
        ("2019", "Tiffany acquisition", "$15.8B deal for iconic jeweler.", "Luxury market consolidation"),
    ),
    "Warren Buffett": _events(
        ("1956", "Founded Buffett Partnership", "Investment partnership in Omaha.", "Value investing track record"),
        ("1965", "Took control of Berkshire Hathaway", "Transformed textile firm into conglomerate.", "Compounding machine"),
        ("1988", "Major Coca-Cola stake", "Long-term consumer brand holding.", "Iconic portfolio position"),
        ("2008", "Goldman Sachs investment", "Deployed capital during financial crisis.", "Crisis-era opportunism"),
    ),
    "Amancio Ortega": _events(
        ("1975", "Opened first Zara store", "Fast-fashion model in La Coruña, Spain.", "Retail innovation"),
        ("1985", "Founded Inditex", "Parent company for Zara and related brands.", "Global fashion group"),
        ("2001", "Inditex IPO", "One of largest fashion IPOs in Europe.", "Wealth crystallization"),
        ("2010s", "Global expansion", "Thousands of stores across 90+ markets.", "Fast-fashion dominance"),
    ),
    "Rob Walton & family": _events(
        ("1962", "Sam Walton opened first Walmart", "Family retail dynasty began in Arkansas.", "Discount retail revolution"),
        ("1970", "Walmart went public", "Walton family retained controlling stake.", "Generational wealth"),
        ("1992", "Sam Walton died", "Fortune passed to Helen Walton and children.", "Family inheritance"),
        ("2010s", "Dividend dynasty", "Walmart dividends and share appreciation sustained fortune.", "Largest U.S. retail fortune"),
    ),
    "Jim Walton & family": _events(
        ("1962", "Walmart founded", "Youngest son of Sam Walton joined family business.", "Retail empire roots"),
        ("1970", "Walmart IPO", "Family retained majority economic interest.", "Long-term compounding"),
        ("2005", "Chaired Arvest Bank", "Regional banking arm of Walton interests.", "Diversified family holdings"),
        ("2010s", "Walton family fortune", "Among largest shareholders of Walmart.", "Inherited billionaire status"),
    ),
    "Alice Walton": _events(
        ("1962", "Walmart origins", "Daughter of Sam Walton; family built discount retail giant.", "Inherited stake"),
        ("1970", "Walmart public listing", "Walton siblings became among richest Americans.", "Generational wealth"),
        ("2011", "Opened Crystal Bridges", "World-class American art museum in Bentonville.", "Philanthropic legacy"),
        ("2020s", "Art and philanthropy", "Major arts patron; Walton family governance.", "Cultural impact"),
    ),
    "Carlos Slim Helu & family": _events(
        ("1960s", "Early investments", "Bought distressed Mexican businesses after crises.", "Contrarian investing"),
        ("1990", "Privatization wave", "Acquired Telmex and other state assets.", "Telecom monopoly"),
        ("2000", "América Móvil expansion", "Built Latin America's largest mobile carrier.", "Regional telecom dominance"),
        ("2007", "Brief world's richest", "Surpassed Bill Gates during commodities boom.", "Peak global wealth rank"),
    ),
    "Steve Ballmer": _events(
        ("1980", "Joined Microsoft", "30th employee; first business manager hired by Gates.", "Early Microsoft growth"),
        ("1998", "President of Microsoft", "Led sales and operations through dot-com era.", "Enterprise scale"),
        ("2000", "CEO of Microsoft", "Succeeded Bill Gates; Windows and Office era.", "Peak Microsoft dominance"),
        ("2014", "Bought LA Clippers", "Retired from Microsoft; purchased NBA team for $2B.", "Sports ownership"),
    ),
    "Michael Bloomberg": _events(
        ("1981", "Founded Bloomberg LP", "Financial data terminals after Salomon Brothers.", "Terminal monopoly"),
        ("1990", "Global expansion", "Bloomberg terminals became Wall Street standard.", "Data empire"),
        ("2001", "Elected NYC mayor", "Three terms focusing on finance and public health.", "Political influence"),
        ("2019", "Presidential campaign", "Self-funded run; continued philanthropy.", "Media and policy reach"),
    ),
    "Changpeng Zhao": _events(
        ("2013", "Joined Blockchain.info", "Early crypto wallet and exchange experience.", "Crypto industry entry"),
        ("2017", "Founded Binance", "Crypto exchange launched in Shanghai, later global.", "Largest exchange by volume"),
        ("2018", "Rapid global growth", "Binance expanded to 100+ countries.", "Crypto trading dominance"),
        ("2023", "Pleaded guilty to violations", "Stepped down; paid fines related to compliance failures.", "Regulatory reckoning"),
    ),
    "Bill Gates": _events(
        ("1975", "Founded Microsoft", "With Paul Allen; BASIC for Altair 8800.", "PC software revolution"),
        ("1980", "IBM PC DOS deal", "Licensed MS-DOS for IBM personal computer.", "Operating system standard"),
        ("1986", "Microsoft IPO", "Became youngest billionaire at the time.", "Software fortune"),
        ("2000", "Bill & Melinda Gates Foundation", "Shifted focus to global health and education philanthropy.", "Philanthropic legacy"),
    ),
    "Thomas Peterffy": _events(
        ("1977", "Founded Timber Hill", "Pioneered handheld trading devices on exchanges.", "Electronic trading pioneer"),
        ("1993", "Founded Interactive Brokers", "Discount brokerage with global reach.", "Low-cost trading leader"),
        ("2007", "IBKR IPO", "Took Interactive Brokers public on NASDAQ.", "Automated trading wealth"),
        ("2010s", "Algorithmic trading scale", "IB served millions of accounts worldwide.", "Fintech billionaire"),
    ),
    "Francoise Bettencourt Meyers & family": _events(
        ("1909", "L'Oréal founded", "Grandfather Eugène Schueller created cosmetics giant.", "Family dynasty origin"),
        ("1957", "Inherited L'Oréal stake", "Mother Liliane Bettencourt held controlling interest.", "Generational transfer"),
        ("2017", "Inherited fortune", "Became world's richest woman after mother's death.", "Cosmetics empire heiress"),
        ("2020s", "L'Oréal growth", "Beauty brands thrived in global markets.", "Sustained family wealth"),
    ),
    "Giancarlo Devasini": _events(
        ("1990s", "Medical supply trading", "Built businesses in Italy before crypto.", "Entrepreneurial background"),
        ("2012", "Joined Bitfinex", "Early crypto exchange operations.", "Digital asset markets"),
        ("2014", "Co-founded Tether", "Stablecoin USDT launched for crypto liquidity.", "Stablecoin dominance"),
        ("2020s", "Tether scale", "USDT became most-traded crypto dollar proxy.", "Crypto infrastructure wealth"),
    ),
    "Mukesh Ambani": _events(
        ("1981", "Joined Reliance", "Son of founder Dhirubhai Ambani.", "Petrochemicals dynasty"),
        ("2002", "Led Reliance after split", "Took refining and petrochemicals businesses.", "Industrial conglomerate"),
        ("2016", "Launched Jio", "Disrupted Indian telecom with cheap 4G data.", "Digital India platform"),
        ("2020", "Jio Platforms investments", "Raised billions from Facebook, Google, others.", "Tech conglomerate pivot"),
    ),
    "Gautam Adani": _events(
        ("1988", "Founded Adani Enterprises", "Commodity trading in Ahmedabad.", "Trading house origins"),
        ("1995", "Mundra Port development", "Built India's largest private port.", "Infrastructure empire"),
        ("2008", "Adani Power IPO", "Expanded into energy generation.", "Energy diversification"),
        ("2020s", "Green energy push", "Solar, wind, and hydrogen investments at scale.", "India infrastructure titan"),
    ),
    "Julia Koch & family": _events(
        ("1940", "Fred Koch founded oil business", "Family engineering and refining roots.", "Koch Industries origin"),
        ("1967", "Charles and David Koch expanded", "Built conglomerate across energy and chemicals.", "Private conglomerate scale"),
        ("2019", "Inherited David Koch stake", "Julia Koch and children received 42% after David's death.", "Billionaire inheritance"),
        ("2020s", "Koch Industries growth", "Diversified manufacturing, ranching, and investments.", "Family fortune"),
    ),
    "Masayoshi Son": _events(
        ("1981", "Founded SoftBank", "Software distribution in Tokyo.", "Japanese tech investor"),
        ("1996", "Yahoo Japan stake", "Early internet bet in Japan.", "Portal dominance"),
        ("2000", "Alibaba investment", "$20M bet became one of history's best VC returns.", "Legendary venture return"),
        ("2017", "Vision Fund launched", "$100B fund backed Uber, WeWork, ARM.", "Global tech investing"),
    ),
    "Charles Koch & family": _events(
        ("1967", "Took over Koch Industries", "With brother David after father's death.", "Conglomerate leadership"),
        ("1970s", "Libertarian philosophy", "Market-based management and advocacy.", "Political influence"),
        ("2005", "Georgia-Pacific acquisition", "$21B deal expanded paper and building products.", "Industrial scale"),
        ("2010s", "Koch network", "Major donor to policy and educational institutions.", "Institutional influence"),
    ),
    "Zhang Yiming": _events(
        ("2012", "Founded ByteDance", "News aggregator Toutiao launched in Beijing.", "Algorithmic content"),
        ("2016", "Launched Douyin / TikTok", "Short-video app exploded globally.", "Global social phenomenon"),
        ("2018", "Musical.ly acquisition", "Merged into TikTok for U.S. expansion.", "Teen platform dominance"),
        ("2021", "Stepped down as CEO", "ByteDance valued over $300B at peak.", "AI content empire"),
    ),
    "Tadashi Yanai & family": _events(
        ("1984", "Opened first Uniqlo store", "Unique Clothing Warehouse in Hiroshima.", "Fast retail basics"),
        ("1991", "Renamed to Uniqlo", "Affordable quality casual wear model.", "Brand identity"),
        ("2005", "Global expansion", "Stores in London, New York, and across Asia.", "International fashion"),
        ("2019", "Fast Retailing scale", "Parent of Uniqlo, GU, and Theory brands.", "Asia's top retailer"),
    ),
    "Jeff Yass": _events(
        ("1987", "Co-founded Susquehanna", "Options trading firm in Philadelphia.", "Quantitative trading"),
        ("1990s", "Options market making", "Pioneered electronic options trading.", "Market structure influence"),
        ("2000s", "Global expansion", "Offices in Dublin, Sydney, Hong Kong.", "International quant firm"),
        ("2010s", "TikTok stake via ByteDance", "Early investor in parent of TikTok.", "Tech investment gains"),
    ),
    "Germán Larrea Mota Velasco & family": _events(
        ("1976", "Grupo México origins", "Mining and infrastructure conglomerate in Mexico.", "Mining dynasty"),
        ("1990", "Acquired mining assets", "Consolidated copper and railroad holdings.", "Resource empire"),
        ("2005", "Southern Copper control", "Among world's largest copper producers.", "Commodity wealth"),
        ("2010s", "Infrastructure expansion", "Railroads and transport under Grupo México.", "Mexican industrial titan"),
    ),
    "Dieter Schwarz": _events(
        ("1930", "Father founded Lidl", "Josef Schwarz started discount grocery in Germany.", "Discount retail roots"),
        ("1977", "Took over Lidl", "Dieter Schwarz expanded discount supermarket chain.", "European grocery scale"),
        ("1970s", "Kaufland hypermarkets", "Built second retail banner under Schwarz Group.", "Dual-brand strategy"),
        ("2010s", "Schwarz Group scale", "Lidl and Kaufland across 30+ countries.", "Europe's largest retailer"),
    ),
    "Zhong Shanshan": _events(
        ("1996", "Founded Nongfu Spring", "Bottled water brand in Hangzhou.", "China's top water brand"),
        ("2000s", "Beverage expansion", "Tea drinks and juice under Nongfu portfolio.", "Consumer staples leader"),
        ("2020", "Nongfu Spring IPO", "Hong Kong listing made him briefly China's richest.", "Bottled water fortune"),
        ("2021", "Beijing Wantai stake", "Vaccine and diagnostics biotech holdings.", "Healthcare diversification"),
    ),
    "Robin Zeng": _events(
        ("1999", "Founded ATL", "Amperex Technology Limited for lithium batteries.", "Battery pioneer"),
        ("2011", "Founded CATL", "Contemporary Amperex Technology for EV cells.", "EV battery leader"),
        ("2018", "CATL IPO", "Shenzhen listing funded global expansion.", "Battery giant public"),
        ("2020s", "EV supply dominance", "Supplied BMW, Tesla, Volkswagen, and others.", "Clean energy infrastructure"),
    ),
    "Ken Griffin": _events(
        ("1987", "Founded Citadel", "Started trading from Harvard dorm room.", "Quant hedge fund"),
        ("1990", "Citadel growth", "Multi-strategy hedge fund in Chicago.", "Trading empire"),
        ("2002", "Founded Citadel Securities", "Market-making arm became top U.S. equity trader.", "Market structure power"),
        ("2022", "Citadel record year", "Fund and market-maker posted record revenues.", "Top hedge fund fortune"),
    ),
    "Ma Huateng": _events(
        ("1998", "Co-founded Tencent", "With college friends in Shenzhen.", "Chinese internet giant"),
        ("1999", "Launched QQ", "Instant messaging captured China's youth.", "Social platform base"),
        ("2011", "Launched WeChat", "Super-app combining messaging, payments, and services.", "One billion users"),
        ("2010s", "Gaming and investments", "Riot Games, Epic, and mobile gaming revenue.", "Digital entertainment empire"),
    ),
    "Li Ka-shing": _events(
        ("1950", "Founded Cheung Kong", "Plastic flower factory grew into property.", "Hong Kong property tycoon"),
        ("1979", "Acquired Hutchison Whampoa", "Ports, retail, and telecom conglomerate.", "Global diversification"),
        ("1987", "Expanded globally", "Ports in Europe, Canada, and Asia.", "Infrastructure investor"),
        ("2015", "CK Hutchison restructuring", "Consolidated ports, retail, and infrastructure.", "Asia's Superman"),
    ),
    "Giovanni Ferrero": _events(
        ("1946", "Ferrero company founded", "Father Pietro created Nutella predecessor in Alba.", "Confectionery dynasty"),
        ("1997", "Took leadership", "After brother Pietro's death; led global expansion.", "Family business succession"),
        ("2011", "Acquired Thorntons", "British chocolate chain added to portfolio.", "Global confectionery"),
        ("2018", "Acquired Nestlé U.S. candy", "Bought Butterfinger and other brands for $2.8B.", "World's candy leader"),
    ),
    "Iris Fontbona & family": _events(
        ("1950s", "Andrónico Luksic mining", "Husband built mining and beverages fortune in Chile.", "Family dynasty origin"),
        ("2005", "Inherited Luksic Group", "After Andrónico's death; children took control.", "Mining and banking wealth"),
        ("2010s", "Antofagasta Minerals", "Copper mining operations across Chile.", "Commodity fortune"),
        ("2020s", "Beverages and banking", "Quiñenco diversified holdings sustained wealth.", "Chile's richest family"),
    ),
    "Lukas Walton": _events(
        ("1962", "Walmart founded", "Grandson of Sam Walton; family retail dynasty.", "Inherited fortune"),
        ("2005", "Inherited after father's death", "John Walton died; stake passed to Lukas.", "Generational transfer"),
        ("2010s", "Sustainable investing", "Focus on environment through Walton Family Foundation.", "Impact investing"),
        ("2020s", "Walton heir", "Among youngest billionaires on Forbes list.", "Inherited retail wealth"),
    ),
    "Gianluigi Aponte": _events(
        ("1970", "Founded MSC", "Bought first ship with wife Rafaela; Mediterranean Shipping.", "Shipping origins"),
        ("1980s", "Container shipping growth", "Expanded fleet across Europe and beyond.", "Global cargo network"),
        ("2000s", "Second-largest container line", "MSC rivaled Maersk in global shipping.", "Logistics empire"),
        ("2020s", "Port investments", "Terminals and logistics infrastructure worldwide.", "Shipping billionaire"),
    ),
    "Rafaela Aponte-Diamant": _events(
        ("1970", "Co-founded MSC", "With husband Gianluigi; single-ship start in Naples.", "Shipping dynasty"),
        ("1980s", "Fleet expansion", "Built MSC into major container carrier.", "Maritime logistics"),
        ("2000s", "Global shipping scale", "MSC became industry leader by capacity.", "Container shipping wealth"),
        ("2020s", "MSC Group", "Cruise, logistics, and port operations diversified.", "Co-founder fortune"),
    ),
    "Jacqueline Mars": _events(
        ("1911", "Mars founded", "Frank Mars created candy company in Tacoma.", "Candy dynasty origin"),
        ("1941", "M&M's launched", "Forrest Mars Sr. created iconic chocolate.", "Global confectionery"),
        ("1999", "Inherited Mars stake", "With brother John after family generations.", "Private company wealth"),
        ("2017", "Acquired VCA pet care", "Mars expanded into veterinary services.", "Diversified family business"),
    ),
    "John Mars": _events(
        ("1911", "Mars company origins", "Third generation of Mars candy family.", "Inherited stake"),
        ("1941", "M&M's and Snickers scale", "Iconic brands built global presence.", "Candy empire"),
        ("1999", "Mars Inc. ownership", "Private company; no public listing.", "Stealth billionaire"),
        ("2017", "Pet care expansion", "Mars Petcare became largest division.", "Consumer goods fortune"),
    ),
    "Mark Mateschitz": _events(
        ("1987", "Red Bull founded", "Father Dietrich created energy drink in Austria.", "Beverage innovation"),
        ("2012", "Inherited Red Bull stake", "After Dietrich Mateschitz died at 78.", "Energy drink heir"),
        ("2020s", "Red Bull global brand", "Sports marketing and F1 team ownership.", "Inherited fortune"),
        ("2023", "Red Bull GmbH control", "Co-owns with Thai Yoovidhya family.", "Billionaire heir"),
    ),
    "Andrea Pignataro": _events(
        ("1996", "Founded ION Trading", "Financial software for trading desks.", "Fintech entrepreneur"),
        ("2000s", "ION acquisitions", "Bought Wall Street Systems and other vendors.", "Trading tech consolidation"),
        ("2019", "Cerved acquisition", "Italian business data and credit services.", "European data empire"),
        ("2020s", "ION Group scale", "Back-office software across finance and energy.", "Italian tech billionaire"),
    ),
    "Klaus-Michael Kuehne": _events(
        ("1933", "Kuehne family logistics", "Grandfather founded freight forwarder in Bremen.", "Logistics dynasty"),
        ("1958", "Joined Kuehne + Nagel", "Expanded international freight forwarding.", "Global logistics"),
        ("1990", "Majority stake", "Became controlling shareholder of K+N.", "Shipping fortune"),
        ("2010s", "Hapag-Lloyd investment", "Stake in container shipping line.", "Integrated logistics wealth"),
    ),
    "William Ding": _events(
        ("1997", "Founded NetEase", "Internet portal and gaming in Guangzhou.", "Chinese gaming pioneer"),
        ("2001", "Blizzard partnership", "Distributed World of Warcraft in China.", "Gaming distribution"),
        ("2014", "Mobile gaming hits", "Fantasy Westward Journey and Onmyoji.", "Mobile revenue leader"),
        ("2020s", "NetEase global push", "Studios in U.S. and Japan; music streaming.", "Diversified tech fortune"),
    ),
    "Abigail Johnson": _events(
        ("1946", "Fidelity founded", "Grandfather Edward Johnson II started mutual fund firm.", "Finance dynasty"),
        ("1988", "Joined Fidelity", "Abigail Johnson started in customer service.", "Family business path"),
        ("2014", "CEO of Fidelity", "Succeeded father Ned Johnson III.", "Asset management leader"),
        ("2020s", "Crypto and fintech", "Fidelity launched Bitcoin custody and trading.", "Modernized family firm"),
    ),
    "Stephen Schwarzman": _events(
        ("1985", "Co-founded Blackstone", "With Pete Peterson; private equity and advisory.", "PE pioneer"),
        ("2007", "Blackstone IPO", "Largest PE firm public offering.", "Alternative asset giant"),
        ("2015", "Real estate scale", "Acquired Hilton and large property portfolios.", "Diversified alternatives"),
        ("2020s", "Infrastructure investing", "Major data-center and energy investments.", "Wall Street billionaire"),
    ),
    "Eric Schmidt": _events(
        ("1983", "Joined Sun Microsystems", "Led software engineering at workstation maker.", "Silicon Valley career"),
        ("1997", "CEO of Novell", "Turned around networking software company.", "Enterprise software"),
        ("2001", "CEO of Google", "Hired to provide 'adult supervision' with founders.", "Google scale era"),
        ("2011", "Executive chairman", "Oversaw Android, Chrome, and acquisitions.", "Alphabet wealth"),
    ),
    "Alain Wertheimer": _events(
        ("1920s", "Chanel founded", "Family partnered with Coco Chanel in Paris.", "Luxury dynasty"),
        ("1974", "Took control of Chanel", "Alain and Gerard revived dormant fashion house.", "Luxury revival"),
        ("1983", "Hired Karl Lagerfeld", "Revitalized Chanel haute couture.", "Global fashion icon"),
        ("2010s", "Chanel private empire", "No public listing; boutiques worldwide.", "Luxury fortune"),
    ),
    "Gerard Wertheimer": _events(
        ("1920s", "Chanel partnership", "Family has owned Chanel since 1920s.", "Inherited luxury stake"),
        ("1974", "Chanel revival", "With brother Alain; rebuilt fashion house.", "Private luxury giant"),
        ("2000s", "Global boutiques", "Chanel expanded in Asia and Americas.", "Fashion wealth"),
        ("2010s", "Watch and beauty", "Diversified beyond haute couture.", "Brother co-owner fortune"),
    ),
    "Jean-Louis van der Velde": _events(
        ("2012", "Joined Bitfinex", "CEO of crypto exchange during growth phase.", "Digital asset trading"),
        ("2014", "Tether operations", "Linked to stablecoin USDT issuance.", "Crypto liquidity"),
        ("2018", "Market leadership", "Bitfinex among top crypto exchanges.", "Trading platform scale"),
        ("2020s", "Stablecoin scrutiny", "Navigated regulatory attention on Tether reserves.", "Crypto infrastructure"),
    ),
    "Paolo Ardoino": _events(
        ("2014", "Joined Bitfinex", "Technical leadership at crypto exchange.", "Exchange engineering"),
        ("2021", "CTO of Bitfinex", "Led technology and Tether integration.", "Stablecoin tech"),
        ("2023", "CEO of Tether", "Succeeded van der Velde at stablecoin issuer.", "USDT leadership"),
        ("2024", "Tether profits", "Stablecoin issuer reported record earnings.", "Crypto fortune"),
    ),
    "Savitri Jindal & family": _events(
        ("1952", "O.P. Jindal founded steel", "Husband built Jindal steel empire in India.", "Industrial dynasty"),
        ("2005", "Inherited after O.P. Jindal died", "Savitri Jindal became family matriarch.", "Steel fortune"),
        ("2010s", "JSW Steel growth", "Sajjan Jindal led expansion and acquisitions.", "India steel leader"),
        ("2020s", "Diversified Jindal Group", "Power, cement, and infrastructure holdings.", "Family industrial wealth"),
    ),
    "Alexey Mordashov & family": _events(
        ("1991", "Joined Cherepovets steel", "Father's mill during Soviet privatization.", "Russian steel origins"),
        ("2000", "Consolidated Severstal", "Built Russia's largest steel company.", "Metals oligarch"),
        ("2006", "Arcelor battle", "Bid for Arcelor; later sold foreign assets.", "Global steel player"),
        ("2010s", "Gold and telecom", "Nordgold mining and Tele2 Russia investments.", "Diversified Russian fortune"),
    ),
    "Jay Y. Lee": _events(
        ("1968", "Samsung Group scale", "Grandson of founder Lee Byung-chul.", "Korean chaebol heir"),
        ("2014", "De facto Samsung leader", "After father Lee Kun-hee's illness.", "Conglomerate control"),
        ("2017", "Legal challenges", "Convicted and pardoned in bribery scandal.", "Corporate governance scrutiny"),
        ("2022", "Chairman of Samsung Electronics", "Led chip and smartphone divisions.", "Tech manufacturing fortune"),
    ),
    "Henry Samueli": _events(
        ("1991", "Co-founded Broadcom", "With Henry Nicholas; semiconductor chips.", "Chip pioneer"),
        ("1998", "Broadcom IPO", "Networking chips for cable and ethernet.", "Silicon Valley wealth"),
        ("2016", "Acquired by Avago", "Merged into Broadcom Inc.; continued as chairman.", "Semiconductor consolidation"),
        ("2020s", "Broadcom scale", "AI networking chips and VMware acquisition.", "Infrastructure chips"),
    ),
    "Miriam Adelson & family": _events(
        ("1988", "Married Sheldon Adelson", "Physician became partner in casino empire.", "Casino dynasty"),
        ("1989", "Las Vegas Sands", "Sheldon built Venetian and Macau casinos.", "Gaming empire"),
        ("2018", "Inherited controlling stake", "After Sheldon Adelson died; largest shareholder.", "Casino fortune heir"),
        ("2020s", "Las Vegas Sands scale", "Sold Las Vegas assets; focused on Asia.", "Inherited billionaire"),
    ),
    "He Xiangjian & family": _events(
        ("1968", "Founded Midea", "Started with bottle caps in Guangdong.", "Appliance dynasty"),
        ("1980s", "Electric fans and AC", "Midea became China's appliance leader.", "Manufacturing scale"),
        ("2013", "Midea global acquisitions", "Bought Kuka robotics and Toshiba appliances.", "Global appliance brand"),
        ("2020s", "Midea Group", "Air conditioners and smart home devices worldwide.", "China manufacturing fortune"),
    ),
    "Eyal Ofer": _events(
        ("1950s", "Sammy Ofer shipping", "Father built global shipping empire.", "Maritime dynasty"),
        ("1990", "Expanded Ofer Global", "Shipping, real estate, and energy investments.", "Diversified holdings"),
        ("2010s", "Zodiac Maritime", "Major tanker and bulk carrier operator.", "Global shipping"),
        ("2020s", "Real estate and art", "London and New York property; major art collector.", "Israeli billionaire"),
    ),
    "Len Blavatnik": _events(
        ("1986", "Founded Access Industries", "Industrial and media holding company.", "Conglomerate builder"),
        ("2003", "TNK-BP oil venture", "Russian oil partnership with BP.", "Energy fortune"),
        ("2011", "Acquired Warner Music", "Major music label portfolio.", "Media empire"),
        ("2018", "LyondellBasell stake", "Chemicals and refining investments.", "Diversified billionaire"),
    ),
    "Idan Ofer": _events(
        ("1950s", "Ofer family shipping", "Son of Sammy Ofer; maritime dynasty.", "Inherited shipping"),
        ("2000s", "Quantum Pacific", "Holding company for shipping and energy.", "Conglomerate structure"),
        ("2010s", "Drilling and LNG", "Pacific Drilling and gas investments.", "Energy diversification"),
        ("2020s", "Shipping and tech", "Stake in AI and fintech ventures.", "Israeli fortune"),
    ),
    "Aliko Dangote": _events(
        ("1977", "Founded Dangote Group", "Trading business in Lagos, Nigeria.", "African industrialist"),
        ("1990s", "Cement expansion", "Built plants across Nigeria and Africa.", "Cement monopoly"),
        ("2010", "Dangote Cement IPO", "Largest listing on Nigerian Stock Exchange.", "Africa's richest man"),
        ("2020s", "Refinery project", "Massive oil refinery in Lekki, Nigeria.", "Industrial diversification"),
    ),
    "Marilyn Simons & family": _events(
        ("1982", "Jim Simons founded Renaissance", "Quant hedge fund using math models.", "Quant revolution"),
        ("2000s", "Medallion Fund returns", "Legendary returns for employees and Simons.", "Quant fortune"),
        ("2010", "Retired from Renaissance", "Marilyn and family inherited wealth.", "Philanthropic focus"),
        ("2024", "Inherited after Jim died", "Marilyn Simons became billionaire heiress.", "Math philanthropy legacy"),
    ),
    "Andreas von Bechtolsheim & family": _events(
        ("1982", "Co-founded Sun Microsystems", "Workstations that powered Silicon Valley.", "Sun co-founder"),
        ("1998", "First Google investor", "Wrote $100K check to Larry and Sergey.", "Legendary angel bet"),
        ("2004", "Founded Arista Networks", "Cloud networking switches.", "Networking billionaire"),
        ("2008", "Google stake value", "Early Google shares compounded for decades.", "Serial tech investor"),
    ),
    "Chen Tianshi": _events(
        ("2008", "Founded Cambricon", "AI chip startup spun from Chinese Academy of Sciences.", "AI silicon pioneer"),
        ("2016", "Cambricon founded formally", "Neural network processors for AI inference.", "China AI chips"),
        ("2020", "STAR Market IPO", "Listed on Shanghai tech board.", "Public AI chip company"),
        ("2020s", "Edge AI processors", "Chips for smartphones and data centers.", "Semiconductor fortune"),
    ),
    "Lyndal Stephens Greth & family": _events(
        ("1934", "Cargill founded roots", "Family agribusiness giant in Minnesota.", "Commodity dynasty"),
        ("1990s", "Cargill private ownership", "Family descendants hold stake in Cargill.", "Private conglomerate"),
        ("2010s", "Food and agriculture", "Grain trading, animal feed, and food processing.", "Global agribusiness"),
        ("2020s", "Inherited Cargill wealth", "Among largest private companies in U.S.", "Family fortune"),
    ),
    "Robert Pera": _events(
        ("2005", "Founded Ubiquiti", "Wireless networking equipment maker.", "Networking entrepreneur"),
        ("2011", "Ubiquiti IPO", "Affordable Wi-Fi for enterprises and consumers.", "Tech IPO wealth"),
        ("2015", "Bought Memphis Grizzlies", "NBA team ownership at age 36.", "Sports investor"),
        ("2020s", "Ubiquiti scale", "UniFi ecosystem for home and business networks.", "Wireless billionaire"),
    ),
    "Eduardo Saverin": _events(
        ("2004", "Co-founded Facebook", "With Mark Zuckerberg at Harvard.", "Social network origins"),
        ("2005", "Left Facebook operations", "Settlement retained significant equity stake.", "Co-founder stake"),
        ("2009", "Moved to Singapore", "Renounced U.S. citizenship; tax planning.", "International investor"),
        ("2010s", "B Capital founded", "Venture fund investing across Asia.", "Venture capital fortune"),
    ),
    "Lakshmi Mittal": _events(
        ("1976", "Founded Mittal Steel", "Steel operations in Indonesia and Trinidad.", "Global steel roll-up"),
        ("1989", "Expanded in Mexico", "Acquired steel plants in developing markets.", "Emerging market steel"),
        ("2006", "Merged with Arcelor", "Created ArcelorMittal; world's largest steelmaker.", "Steel empire"),
        ("2010s", "India and Europe plants", "Integrated mining and steel production.", "Steel magnate"),
    ),
    "MacKenzie Scott": _events(
        ("1992", "Married Jeff Bezos", "Early Amazon employee and novelist.", "Amazon early stake"),
        ("1994", "Amazon founded", "Helped start company; early accounting.", "E-commerce origins"),
        ("2019", "Divorced Jeff Bezos", "Received 25% of Amazon shares (~$36B).", "Major stake transfer"),
        ("2020", "Philanthropic giving", "Donated billions to nonprofits via Yield Giving.", "Record philanthropy"),
    ),
    "Elaine Marshall & family": _events(
        ("1898", "Koch family origins", "Related to Koch Industries through marriage.", "Industrial dynasty link"),
        ("1967", "E. Pierce Marshall inheritance", "Husband's stake in Koch Industries.", "Family wealth transfer"),
        ("2006", "Legal battles over estate", "Protracted Koch family inheritance disputes.", "Fortune consolidation"),
        ("2020s", "Koch Industries stake", "Among largest private company shareholders.", "Inherited fortune"),
    ),
    "Thomas Frist Jr & family": _events(
        ("1968", "Founded HCA Healthcare", "With father Thomas Frist Sr. in Nashville.", "Hospital chain pioneer"),
        ("1990s", "HCA expansion", "Largest for-profit hospital operator in U.S.", "Healthcare scale"),
        ("2006", "HCA taken private", "Private equity buyout; later re-IPO.", "Healthcare investing"),
        ("2020s", "Frist family fortune", "Generations lead HCA and healthcare ventures.", "Hospital billionaire dynasty"),
    ),
    "Pham Nhat Vuong": _events(
        ("1993", "Founded Technocom", "Instant noodles in Ukraine; first Vietnamese billionaire abroad.", "Food entrepreneur"),
        ("2000s", "Returned to Vietnam", "Sold Technocom; invested in homeland.", "Repats wealth"),
        ("2010", "Founded Vingroup", "Real estate, retail, and hospitality conglomerate.", "Vietnam conglomerate"),
        ("2018", "VinFast auto brand", "Electric vehicles and manufacturing.", "Vietnam industrialist"),
    ),
    "Michal Strnad": _events(
        ("1990s", "CSG Group origins", "Family ammunition and defense business in Czechia.", "Defense industry"),
        ("2010s", "Expanded CSG aerospace", "Aircraft parts and defense systems.", "European defense"),
        ("2020", "Acquired Colt CZ Group", "Merged firearms brands globally.", "Firearms consolidation"),
        ("2020s", "Defense exports", "NATO supplier amid European rearmament.", "Czech defense fortune"),
    ),
    "Melinda French Gates": _events(
        ("1987", "Joined Microsoft", "Product manager; met Bill Gates at company.", "Tech career start"),
        ("1994", "Married Bill Gates", "Co-led philanthropy and family foundation.", "Foundation partnership"),
        ("2000", "Bill & Melinda Gates Foundation", "Co-chaired world's largest private foundation.", "Global health philanthropy"),
        ("2021", "Divorced Bill Gates", "Retained foundation role; independent Pivotal Ventures.", "Independent philanthropy"),
    ),
    "Vladimir Potanin": _events(
        ("1989", "Founded Interros", "Investment company during Soviet privatization.", "Russian oligarch era"),
        ("1995", "Norilsk Nickel stake", "Acquired metals giant in loans-for-shares.", "Nickel and palladium"),
        ("2010s", "Nornickel leadership", "World's largest palladium producer.", "Metals fortune"),
        ("2020s", "Sanctions and divestment", "Navigated Western sanctions on Russian assets.", "Commodity oligarch"),
    ),
    "Vagit Alekperov": _events(
        ("1979", "Joined Soviet oil ministry", "Engineer in Caspian oil fields.", "Oil career start"),
        ("1991", "Founded Lukoil", "Russia's largest private oil company.", "Oil major founder"),
        ("1995", "Lukoil privatization", "Consolidated Soviet oil assets.", "Energy oligarch"),
        ("2000s", "Global Lukoil expansion", "Refineries and gas stations across Europe.", "Russian oil fortune"),
    ),
    "Wang Weixiu & family": _events(
        ("2000", "Founded Longi Green Energy", "Solar wafer and module manufacturer.", "Solar industry pioneer"),
        ("2012", "Monocrystalline focus", "Bet on single-crystal silicon technology.", "Solar tech leader"),
        ("2018", "Longi global expansion", "Largest monocrystalline silicon producer.", "Clean energy scale"),
        ("2020s", "Solar manufacturing", "Supplied panels worldwide amid energy transition.", "China solar fortune"),
    ),
    "Colin Huang": _events(
        ("2004", "Founded Ouku", "Early e-commerce venture in China.", "Serial entrepreneur"),
        ("2015", "Founded Pinduoduo", "Social group-buying e-commerce platform.", "E-commerce disruptor"),
        ("2018", "Pinduoduo IPO", "NASDAQ listing; rivaled Alibaba and JD.", "Rapid user growth"),
        ("2020", "Stepped down as chairman", "Pinduoduo reached hundreds of millions of users.", "E-commerce fortune"),
    ),
    "Leonid Mikhelson & family": _events(
        ("1987", "Joined Novafininvest", "Gas processing during Soviet transition.", "Energy career"),
        ("1993", "Founded Novatek", "Russia's largest independent gas producer.", "LNG pioneer"),
        ("2010s", "Yamal LNG project", "Arctic liquefied natural gas export facility.", "Gas export giant"),
        ("2020s", "Novatek expansion", "Major stake in Russian energy sector.", "Gas oligarch fortune"),
    ),
    "Huang Shilin": _events(
        ("1999", "Joined CATL early team", "Co-builder of battery giant with Robin Zeng.", "Battery industry"),
        ("2011", "CATL formation", "Key executive in Contemporary Amperex Technology.", "EV supply chain"),
        ("2018", "CATL IPO wealth", "Executive stake at public listing.", "Battery billionaire"),
        ("2020s", "EV battery demand", "CATL supplied global automakers.", "Clean energy wealth"),
    ),
    "John Tu": _events(
        ("1987", "Co-founded Kingston Technology", "Memory modules with David Sun.", "Memory pioneer"),
        ("1996", "Sold 80% to Softbank", "Then bought back company for $450M.", "Employee-owned model"),
        ("2010s", "Kingston dominance", "World's largest independent memory maker.", "Hardware fortune"),
        ("2020s", "Private company wealth", "No public listing; global memory sales.", "Taiwanese-American billionaire"),
    ),
    "David Sun": _events(
        ("1987", "Co-founded Kingston Technology", "With John Tu; PC memory modules.", "Memory modules"),
        ("1996", "Bought back Kingston", "Repurchased from Softbank; employee ownership.", "Unique corporate structure"),
        ("2000s", "USB drives and SSDs", "Expanded beyond DRAM modules.", "Storage products"),
        ("2020s", "Kingston scale", "Billions in annual revenue privately held.", "Co-founder fortune"),
    ),
    "Peter Thiel": _events(
        ("1998", "Co-founded PayPal", "With Max Levchin and Elon Musk.", "Online payments"),
        ("2004", "First Facebook investor", "$500K angel bet for 10% stake.", "Legendary VC return"),
        ("2004", "Founded Palantir", "Data analytics for government and enterprise.", "Defense tech"),
        ("2010s", "Founders Fund", "Backed SpaceX, Airbnb, and Stripe.", "Silicon Valley kingmaker"),
    ),
    "Vinod Adani": _events(
        ("1980s", "Adani family trading", "Brother Gautam built Adani Group.", "Family business"),
        ("1990s", "Overseas trading operations", "Managed international commodity flows.", "Global trading arm"),
        ("2000s", "Adani Group expansion", "Ports, power, and logistics growth.", "Infrastructure sibling"),
        ("2020s", "Adani stake wealth", "Significant holdings in group companies.", "Indian billionaire"),
    ),
    "François Pinault & family": _events(
        ("1963", "Founded Pinault timber", "Wood and building materials in Brittany.", "Retail origins"),
        ("1988", "Shifted to luxury", "Acquired CFAO and luxury brands.", "Luxury pivot"),
        ("1999", "Created Kering", "Gucci, Saint Laurent, and Bottega Veneta.", "Luxury conglomerate"),
        ("2013", "Christie's ownership", "Auction house added to holdings.", "Art and luxury empire"),
    ),
    "Zheng Shuliang & family": _events(
        ("1990s", "Founded Weiqiao Pioneering", "Aluminum and textiles in Shandong.", "Industrial conglomerate"),
        ("2000s", "Aluminum smelting scale", "Among world's largest aluminum producers.", "Commodity processing"),
        ("2010s", "Power self-sufficiency", "Own power plants for smelting operations.", "Vertical integration"),
        ("2020s", "Weiqiao Group", "Aluminum, textiles, and power diversified.", "Chinese industrial fortune"),
    ),
    "Reinhold Wuerth & family": _events(
        ("1945", "Wuerth screw business", "Father Adolf started wholesale fasteners.", "Hardware dynasty"),
        ("1954", "Took over at 19", "Reinhold Wuerth expanded sales force model.", "Direct sales innovation"),
        ("1980s", "Global Wuerth expansion", "Assembly and fastening materials worldwide.", "B2B distribution"),
        ("2010s", "Wuerth Group scale", "400+ companies in 80 countries.", "German billionaire"),
    ),
    "Jack Ma": _events(
        ("1999", "Founded Alibaba", "B2B marketplace connecting Chinese suppliers.", "E-commerce pioneer"),
        ("2003", "Launched Taobao", "Competed with eBay in China; won market.", "Consumer e-commerce"),
        ("2014", "Alibaba IPO", "Largest IPO in history at $25B.", "China tech icon"),
        ("2020", "Stepped back from Ant Group IPO", "Regulatory scrutiny ended Ant listing.", "Fintech and cloud empire"),
    ),
    "Cyrus Poonawalla": _events(
        ("1966", "Founded Serum Institute", "Vaccine production in Pune, India.", "Vaccine dynasty"),
        ("1990s", "Affordable vaccines", "Supplied UNICEF and developing nations.", "Global immunization"),
        ("2020", "COVID-19 vaccines", "Produced AstraZeneca and Novavax doses at scale.", "Pandemic response"),
        ("2020s", "World's largest vaccinemaker", "Billions of doses annually.", "Healthcare fortune"),
    ),
    "Phil Knight & family": _events(
        ("1964", "Founded Blue Ribbon Sports", "Imported Onitsuka Tiger shoes; became Nike.", "Athletic footwear"),
        ("1971", "Nike brand launched", "Swoosh logo and waffle sole innovation.", "Global sportswear"),
        ("1988", "Just Do It campaign", "Iconic marketing with Michael Jordan line.", "Brand dominance"),
        ("2016", "Stepped down as chairman", "Nike surpassed $30B annual revenue.", "Sportswear billionaire"),
    ),
    "Emmanuel Besnier": _events(
        ("1933", "Lactalis founded", "Grandfather André Besnier started cheese dairy.", "Dairy dynasty"),
        ("1955", "Father expanded Lactalis", "Michel Besnier grew Président brand.", "French cheese leader"),
        ("2000", "CEO of Lactalis", "Emmanuel led global acquisitions.", "Dairy consolidation"),
        ("2017", "Acquired Parmalat", "Became world's largest dairy group.", "Global dairy fortune"),
    ),
    "Susanne Klatten": _events(
        ("1953", "Quandt family BMW stake", "Mother Johanna Quandt held BMW shares.", "Auto dynasty"),
        ("1978", "Inherited Quandt fortune", "After father Herbert Quandt's BMW rescue.", "German auto wealth"),
        ("1997", "Altana pharmaceutical", "Built and sold specialty chemicals firm.", "Diversified holdings"),
        ("2020s", "BMW and SKW", "Major BMW shareholder and investor.", "Germany's richest woman"),
    ),
    "Israel Englander": _events(
        ("1989", "Founded Millennium Management", "Hedge fund after collapse of previous firm.", "Quant hedge fund"),
        ("2000s", "Pod shop model", "Hired multiple independent trading teams.", "Multi-manager pioneer"),
        ("2008", "Survived financial crisis", "Millennium posted gains while peers fell.", "Crisis resilience"),
        ("2020s", "Record AUM", "Among top-performing hedge funds globally.", "Trading billionaire"),
    ),
    "Suleiman Kerimov & family": _events(
        ("1980s", "Started in business", "Economist turned investor in Russia.", "Oligarch era entry"),
        ("1990s", "Polyus Gold stake", "Invested in Russia's largest gold miner.", "Mining fortune"),
        ("2000s", "Nafta Moscow", "Financial and energy investments.", "Diversified holdings"),
        ("2010s", "FC Krasnodar and politics", "Senator and football club owner.", "Russian billionaire"),
    ),
    "Vladimir Lisin": _events(
        ("1992", "Acquired steel mills", "Privatization of Russian steel assets.", "Steel consolidation"),
        ("1995", "Founded NLMK", "Novolipetsk Steel became top producer.", "Russian steel leader"),
        ("2000s", "NLMK global expansion", "Plants in Russia, Europe, and U.S.", "Steel exports"),
        ("2010s", "Transport and ports", "UCL Holding logistics and shipping.", "Industrial oligarch"),
    ),
    "Dilip Shanghvi": _events(
        ("1983", "Founded Sun Pharma", "Psychiatry drugs in Mumbai garage.", "Pharma entrepreneur"),
        ("1997", "Sun Pharma IPO", "Expanded generic drug manufacturing.", "India pharma leader"),
        ("2014", "Acquired Ranbaxy", "$4B deal made Sun India's top drugmaker.", "Generic consolidation"),
        ("2020s", "Global generics", "Markets in U.S., India, and emerging economies.", "Pharmaceutical fortune"),
    ),
}


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "data" / "forbes-billionaires.json"
FORBES_API = (
    "https://www.forbes.com/forbesapi/person/rtb/0/position/true.json"
    "?fields=rank,personName,age,source,countryOfCitizenship,industries,finalWorth"
    "&limit=100"
)
GROK_OVERRIDE_RANKS = frozenset(range(1, 101))  # preserve full Grok paste in data/forbes-billionaires.json


def format_net_worth(final_worth: float | int | None) -> str:
    if final_worth is None:
        return "0.0B"
    billions = float(final_worth) / 1000.0
    return f"{billions:.1f}B"


def parse_companies(source: str | None) -> list[str]:
    if not source:
        return []
    parts = re.split(r",|\band\b", source, flags=re.IGNORECASE)
    companies: list[str] = []
    seen: set[str] = set()
    for part in parts:
        name = re.sub(r"\s+", " ", part.strip(" \t-&"))
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        companies.append(name)
    return companies


def format_sector(industries: list[str] | None) -> str:
    if not industries:
        return "Diversified"
    cleaned = [item.strip() for item in industries if item and item.strip()]
    return " / ".join(cleaned) if cleaned else "Diversified"


def decade_from_year(year_text: str) -> str:
    digits = re.sub(r"\D", "", year_text)
    if len(digits) < 4:
        return "2000s"
    year = int(digits[:4])
    if year < 1970:
        return "1960s"
    bucket = (year // 10) * 10
    return f"{bucket}s"


def first_fortune_decade(timeline: list[dict[str, str]]) -> str:
    if not timeline:
        return "2000s"
    years = [event.get("year", "") for event in timeline if event.get("year")]
    if not years:
        return "2000s"
    earliest = min(years, key=lambda value: int(re.sub(r"\D", "", value) or "9999"))
    return decade_from_year(earliest)


def build_summary(name: str, source: str | None, sector: str) -> str:
    wealth_source = (source or "diversified holdings").strip().rstrip(".")
    return f"Billionaire whose fortune stems primarily from {wealth_source} in {sector.lower()}."


def select_timeline(person_name: str) -> list[dict[str, str]]:
    events = TIMELINES.get(person_name)
    if not events:
        raise KeyError(f"Missing curated timeline for '{person_name}'")
    if len(events) < 2:
        raise ValueError(f"Timeline for '{person_name}' must have at least 2 events")
    return events[:4]


def load_existing_dataset() -> list[dict[str, Any]]:
    if not DATA_PATH.is_file():
        return []
    text = DATA_PATH.read_text(encoding="utf-8").lstrip("\ufeff")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        data, _ = decoder.raw_decode(text)
    if not isinstance(data, list):
        raise ValueError(f"{DATA_PATH} must contain a JSON array")
    return data


def load_grok_overrides() -> dict[tuple[int, str], dict[str, Any]]:
    overrides: dict[tuple[int, str], dict[str, Any]] = {}
    for entry in load_existing_dataset():
        rank = entry.get("rank")
        name = entry.get("name")
        if isinstance(rank, int) and isinstance(name, str) and rank in GROK_OVERRIDE_RANKS:
            overrides[(rank, name.casefold())] = entry
    return overrides


def fetch_forbes_list() -> list[dict[str, Any]]:
    request = urllib.request.Request(
        FORBES_API,
        headers={"User-Agent": "forbes-wealth-journeys/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Failed to fetch Forbes API: {exc}") from exc

    people = payload.get("personList", {}).get("personsLists", [])
    if not people:
        raise RuntimeError("Forbes API returned no billionaire records")
    return people


def build_entry(person: dict[str, Any]) -> dict[str, Any]:
    name = person["personName"]
    timeline = select_timeline(name)
    source = person.get("source") or ""
    sector = format_sector(person.get("industries"))

    return {
        "rank": person["rank"],
        "name": name,
        "netWorth": format_net_worth(person.get("finalWorth")),
        "age": person.get("age"),
        "country": person.get("countryOfCitizenship") or "Unknown",
        "sector": sector,
        "companies": parse_companies(source),
        "sourceOfWealth": source,
        "firstFortuneDecade": first_fortune_decade(timeline),
        "summary": build_summary(name, source, sector),
        "timeline": timeline,
    }


def sort_key(entry: dict[str, Any]) -> tuple[int, str]:
    return (int(entry["rank"]), str(entry["name"]).casefold())


def build_dataset() -> list[dict[str, Any]]:
    grok_overrides = load_grok_overrides()
    forbes_people = fetch_forbes_list()

    forbes_names = {person["personName"] for person in forbes_people}
    missing_timelines = sorted(forbes_names - TIMELINES.keys())
    if missing_timelines:
        raise RuntimeError(
            "TIMELINES missing Forbes names: " + ", ".join(missing_timelines)
        )

    entries: list[dict[str, Any]] = []
    for person in forbes_people:
        rank = person["rank"]
        name_key = (rank, person["personName"].casefold())
        if name_key in grok_overrides:
            entries.append(grok_overrides[name_key])
        else:
            entries.append(build_entry(person))

    entries.sort(key=sort_key)
    return entries


def main() -> None:
    try:
        entries = build_dataset()
    except (RuntimeError, KeyError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DATA_PATH.open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Wrote {len(entries)} entries -> {DATA_PATH}")


if __name__ == "__main__":
    main()
