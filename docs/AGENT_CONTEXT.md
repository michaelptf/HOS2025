# HOS2025 Agent Handoff Context

## Project
- Name: Home Ownership Scheme 2025 Available Units Tracker
- Goal: Responsive website to filter/sort HOS 2025 units and show latest available units.
- Stack chosen: HTML + Tailwind CSS + vanilla JavaScript.

## Current Progress
- Frontend shell is implemented with:
  - desktop table view + mobile card view
  - filter panel
  - multi-sort controls
  - loading + empty states
  - dark/light mode
  - localStorage filter persistence
  - CSV export
- Parser implemented for the 5 local price-list PDFs.
- Parser outputs normalized dataset for frontend.

## Source Files (price lists)
- Price-List-YingFai.pdf
- Price-List-WuiHei.pdf
- Price-List-KaiYeung.pdf
- Price-List-YuFung.pdf
- Price-List-LongFung.pdf

## Data Pipeline Status
- Config: config/sources.json
- Parser script: scripts/parse_price_lists.py
- Output files:
  - data/price_lists.raw.json
  - data/units.latest.json
- Latest parsed total: 6926 units
  - Ying Fai: 1408
  - Wui Hei: 820
  - Kai Yeung: 1090
  - Yu Fung: 1878
  - Long Fung: 1730

## Frontend Data Binding
- Current app data path is data/units.latest.json.
- File: assets/js/app.js

## Key Commands
- Run parser:
  - python scripts/parse_price_lists.py
- Local preview server:
  - python -m http.server 8080

## Important Note
- Current dataset is from price lists (full inventory/pricing), not daily availability status.
- Next step is to parse daily status PDFs and merge with price-list data to show only currently available/unsold units.

## Suggested Next Task
1. Add daily status source links in config/sources.json.
2. Implement scripts/parse_daily_status.py.
3. Merge on normalized key (estate/block/floor/unit) into data/units.available.latest.json.
4. Switch UI data source to availability dataset.
5. Add last-update metadata from daily status parse run.
