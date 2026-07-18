# 2026-07-18j Stability And Debounced Sync

## What changed

- Updated `sync-throttle.js` so normal itinerary edits are queued and auto-saved after about 60 seconds instead of pushing every click/keypress immediately.
- Kept the top sync status pill as a manual save button for immediate GitHub cloud persistence.
- Added `final-stability-fixes.js` as the last-loaded browser hardening layer.
- Normalized the list `+` entry, single-click blank add-day zone, duplicate collapse buttons, hidden duplicate day meta chips, and activity-row layout.
- Bumped `index.html` to `render-20260718j` and loaded the new stability layer.

## Why

The editor still visibly shook when adding or editing activities because frequent save echoes and row template changes could trigger full-list layout churn. This version keeps the local edit immediate, queues cloud writes, and gives rows stable dimensions/styles while editing.

## Data note

No stored itinerary data was changed. The patch only updates client scripts and documentation.

## Verification target

- Static syntax check for `sync-throttle.js`, `final-stability-fixes.js`, and `activity-drag-scope.js`.
- Production browser check after Render deploy: click `+`, edit title/place/budget/transport, click blank add-day zone multiple times, manual-save via sync pill, reload and verify data remains.
