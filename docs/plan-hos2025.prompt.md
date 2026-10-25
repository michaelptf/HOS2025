## Plan: HOS 2025 Units Tracker

Build a mobile-first static web app (Vanilla JS + Tailwind) that loads normalized JSON data and provides fast client-side filtering/sorting, while a scheduled parser pipeline extracts daily status PDFs and merges one-off price-list data. This approach gives quick UI delivery first, then reliable daily freshness with low-cost free hosting.

1. Phase 1: Project Bootstrap and UI Skeleton
- Build responsive shell with header, last-update badge, theme toggle, filter panel, result area.
- Add loading, empty, and error states.
- Wire sample dataset for rapid frontend iteration.

2. Phase 2: Filter, Sort, and UX Logic
- Required filters: estate, block multi-select, floor range, area range, price range, orientation, unit type, search.
- Multi-sort priority controls (e.g., size then floor then price).
- Persist filter preferences via localStorage.
- CSV export for filtered results.

3. Phase 3: Data Contract and Integration
- Freeze normalized schema for unit records and metadata.
- Build adapter so UI handles missing fields safely.
- Validate filtering/sorting edge cases.

4. Phase 4: PDF Parsing Pipeline
- Parse daily status PDFs.
- Parse one-off price list PDFs.
- Merge datasets with stable unit IDs.
- Add validation checks and parser fallback.
- Output latest JSON, CSV, and metadata timestamp.

5. Phase 5: Automation and Publishing
- Daily scheduled refresh (HKT-aligned cron).
- Manual refresh trigger with optional URL override.
- Deploy static app + data artifacts to free hosting.

6. Phase 6: Final Verification
- Test responsiveness on mobile/tablet/desktop.
- Verify filter and multi-sort correctness.
- Verify update timestamp freshness.
- Verify CSV export and recovery states.

## Decisions
- Frontend: Vanilla JS + Tailwind.
- Data freshness: daily + on-demand refresh.
- Parsing: primary status parser + separate price-list parser merged by normalized key.
- Initial deployment target: free static hosting with automated data updates.
