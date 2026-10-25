---
name: hos2025-maintainer
description: "Maintain the HOS2025 available-units tracker. Use when changing its vanilla JavaScript/Tailwind UI, estate and block filtering, availability matrix, unit data schema, PDF parsers, source configuration, or refresh workflow; prioritize the smallest complete change and verify the affected behavior."
argument-hint: "[frontend|data-pipeline|all]"
---

# HOS2025 Maintainer

Use this workflow for focused work on this repository's static housing-units tracker. Keep changes small, but complete every behavior the request requires.

## Before Editing

1. Read the relevant local code and project notes before assuming how a feature works. Start with the named file or behavior; inspect callers and nearby validation only as needed.
2. Identify the data contract or UI behavior the change must preserve. Current project surfaces include:
   - `index.html`, `assets/css/styles.css`, and `assets/js/app.js` for the static frontend.
   - `config/sources.json` and `scripts/parse_price_lists.py` for price-list inputs and the master unit dataset.
   - `scripts/parse_daily_status.py` for status PDFs and availability merging.
   - `data/units.latest.json` and `data/units.available.latest.json` for frontend datasets.
3. State a local hypothesis and one focused check that could disprove it before making the first change.
4. Inspect the current worktree version of any file before editing. Preserve manual or unrelated user changes.

## Implementation Rules

- Prefer the existing vanilla JavaScript, Tailwind utility classes, CSS, and parser patterns. Do not add dependencies or abstractions for a small change.
- Make the smallest change that fully satisfies the request. Do not add speculative options or unrelated cleanup.
- Keep available-unit semantics explicit: availability comes from the daily-status dataset, while price, area, and unit identity come from the price-list dataset. Do not infer that a unit is available merely because a status file failed to load or parse.
- Preserve stable unit identity (`unitId`) across parsing and merging. Treat estate, block, floor, and unit normalization as part of that merge contract.
- Keep frontend controls accessible: labels, keyboard-operable interactions, visible focus states, and readable light/dark contrast. Preserve mobile behavior when changing layout.
- Escape data-derived strings before inserting them into HTML. Keep fetch and parse failure states visible and actionable.
- Reuse existing filter, sort, theme, persistence, and modal behavior when extending the UI. Avoid leaving controls that look active but have no behavior.
- Keep edits scoped to the modules and documentation directly affected by the request.

## Validation

Run the narrowest check that covers the changed behavior, then expand only when needed:

- Frontend JavaScript: `node --check assets/js/app.js`.
- Parser or data-pipeline work: run `python scripts/parse_price_lists.py` when the master dataset must be refreshed, then `python scripts/parse_daily_status.py` for status parsing and merging.
- After parser runs, inspect per-estate parsed counts, price/status/merged counts, unmatched records, metadata timestamps, and whether the resulting available count is plausible. A non-zero result alone does not prove the merge is correct.
- For UI changes, start `python -m http.server 8080` from the repository root and verify the page and both JSON requests load. Check browser console errors and exercise the changed controls at desktop and mobile widths when browser tooling is available.
- If a remote PDF format or network failure prevents full parsing, report which sources failed, preserve the last known output rather than claiming fresh results, and document the fallback or limitation.

## Completion Report

Concisely state what changed, which focused checks passed, and any remaining risk or unverified behavior. Distinguish generated output from source-code changes; do not claim visual or browser validation unless it was actually performed.
