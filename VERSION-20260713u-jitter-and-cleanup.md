# VERSION 20260713u - Jitter fix and legacy cleanup

## What changed

- Removed unused legacy frontend files that were no longer loaded by `index.html`:
  - `imported-itinerary.js`
  - `inline-edit.js`
  - `inline-edit.css`
  - `layout-fix.css`
  - `transport-multiselect.js`
  - `transport-multiselect.css`
  - `entry-actions.js`
  - `map-providers.js`
- Added these removed files to the smoke-test legacy guard so they cannot silently return.
- Removed the old startup seed dependency from `prepare-seed.js` and `server.js`.
- New empty rooms now initialize as a blank `新行程单` instead of loading any preset itinerary.
- Updated `interaction-hotfix.js` so it no longer scans and mutates the page every 900ms.
- Updated `layout-stability-hotfix.js` so it no longer scans and mutates the page every 3000ms.
- Replaced periodic layout fixes with lightweight MutationObserver-based fixes.
- Removed forced `scrollIntoView()` calls from the add-activity shortcut to stop page jumping.
- Hid the duplicate lower add-day button; the top add-day button and blank timeline add zone remain.
- Bumped the page build marker to `render-20260713u`.

## Data safety

This change does not modify existing room data, GitHub room storage content, `/var/data`, or any saved itinerary lists. It only removes obsolete code paths and changes what happens when a brand-new empty room is created.

## Verification

- GitHub Actions `Smoke test` passed on commit `5e8c11b`.
- GitHub Actions `WebSocket smoke test` passed on commit `5e8c11b`.
- Live room `1075424A` still reports 1 list, 21 days, and 47 activities after deployment of `render-20260713u`.

## Why

The page could shake or freeze because multiple hotfix scripts were periodically changing DOM structure and panel layout while the main app was rendering. The new behavior only reacts when relevant DOM nodes actually change.

The old seed file also caused startup and WebSocket smoke failures after cleanup, and it was one source of preset itinerary flashes. The server no longer depends on it.
