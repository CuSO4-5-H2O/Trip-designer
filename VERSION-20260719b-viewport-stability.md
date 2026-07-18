# VERSION 20260719b - Viewport Stability Guard

## Summary

This release adds a final lightweight viewport guard for inline itinerary editing.
It is aimed at the recurring visible shake/flicker issue when clicking the day `+` button or editing activity fields.

## Changes

- Added `viewport-stability.js`.
- The guard preserves `window.scrollX` / `window.scrollY` around inline day/activity editing clicks inside `#dayList`.
- Patched protected `focus()` calls to force `preventScroll: true` for itinerary-list editors.
- Patched protected `input.select()` / `textarea.select()` calls so selecting inline text does not move the viewport.
- Wrapped `TripPlanner.saveExternalLibrary()` so inline edits mark `window.__TripPendingLocalSave` before saving.
- Pending inline edits now resist stale cloud refreshes during the 1-minute autosave window.
- Added viewport preservation for Enter/Escape/focusout while closing inline editors.
- Updated `index.html` to `render-20260719b` and loaded the guard after the existing stability scripts.

## Data Safety

- No room data or account data is modified by this release.
- No local/private data source is introduced.
- The change does not alter the GitHub-backed room store format.

## Production Verification

Verified on Render production room `0F9A81A6` after deployment:

1. Opened the room at build `render-20260719b` and confirmed `viewport-stability.js` loaded.
2. Scrolled to a visible day card and clicked the day `+` button by coordinate.
3. Confirmed the activity count increased by 1, `scrollY` stayed unchanged, and no console warnings/errors appeared.
4. Confirmed the newly added activity remained after the stale-refresh window that previously swallowed it.
5. Edited a new activity title and confirmed it later appeared in both the UI and `/api/room-state` cloud data.
6. Edited the activity place chip to `测试地点`, clicked the sync status to flush, and confirmed `/api/room-state` revision `12` contained the updated place.
7. Opened a second browser tab to the same room and confirmed it displayed `测试地点`, `生产验证事项-保留`, 3 days, and 10 activities from cloud data.
8. Edited the transport chip to `车 · 测试地点 → 酒店`, clicked sync, and confirmed `/api/room-state` revision `14` stored `transport.type=car`, `from=测试地点`, `to=酒店`.
9. Edited the budget chip to `预算 CNY 123`, clicked sync, and confirmed `/api/room-state` revision `17` stored `budget.amount=123`, `currency=CNY`.

## Remaining Verification Target

Continue verifying:

1. Mobile viewport interaction after the stability guard.
2. Longer multi-device concurrent editing beyond the tested second-tab cloud reload path.
