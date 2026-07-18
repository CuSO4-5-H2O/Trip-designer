# VERSION 20260719b - Viewport Stability Guard

## Summary

This release adds a final lightweight viewport guard for inline itinerary editing.
It is aimed at the recurring visible shake/flicker issue when clicking the day `+` button or editing activity fields.

## Changes

- Added `viewport-stability.js`.
- The guard preserves `window.scrollX` / `window.scrollY` around inline day/activity editing clicks inside `#dayList`.
- Patched protected `focus()` calls to force `preventScroll: true` for itinerary-list editors.
- Patched protected `input.select()` / `textarea.select()` calls so selecting inline text does not move the viewport.
- Updated `index.html` to `render-20260719b` and loaded the guard after the existing stability scripts.

## Data Safety

- No room data or account data is modified by this release.
- No local/private data source is introduced.
- The change is UI-only and does not alter the GitHub-backed room store.

## Verification Target

After Render deploys this version, verify on production:

1. Open a room and scroll so a day card is visible.
2. Click the day `+` button.
3. Confirm a new activity row appears without the page jumping.
4. Click time/title/place/transport/budget fields.
5. Confirm inline editors open without viewport shake and no console errors appear.
