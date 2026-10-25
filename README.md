# HOS2025 Available Units Tracker

Mobile-first web app for tracking available units from HOS 2025, with filter and multi-sort support.

## Current status

- Responsive UI scaffold complete (desktop table + mobile cards)
- Client-side filter/sort/search/export + localStorage persistence
- Source config for 5 price-list PDFs added
- Structured parser added for local price-list PDF extraction
- Daily status parser + merge pipeline added (available units only dataset)

## Run frontend locally

1. Open this folder in VS Code.
2. Start a local static server from project root:

```powershell
python -m http.server 8080
```

3. Open http://localhost:8080 in browser.

## Data source config

See config/sources.json for the official PDF URLs and expected local file names.

## Parser bootstrap

Install dependencies:

```powershell
pip install -r requirements.txt
```

Parse price list PDFs:

```powershell
python scripts/parse_price_lists.py
```

Parse daily status PDFs and merge with price-list data:

```powershell
python scripts/parse_daily_status.py
```

Output files:
- data/price_lists.raw.json
- data/units.latest.json
- data/units.available.latest.json

The frontend now reads `data/units.available.latest.json` first, and falls back to `data/units.latest.json`.

## Data flow

1. `scripts/parse_price_lists.py` parses all priced units into `data/units.latest.json`.
2. `scripts/parse_daily_status.py` parses daily status PDFs and merges by normalized unit key (`unitId`).
3. Merged output `data/units.available.latest.json` contains only currently available/unsold units.

## Next implementation steps

1. Add GitHub Actions workflow for daily refresh and manual trigger.
2. Improve block/name normalization and orientation/unit type enrichment when available.
