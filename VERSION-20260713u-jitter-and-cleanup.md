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
- Updated `interaction-hotfix.js` so it no longer scans and mutates the page every 900ms.
- Updated `layout-stability-hotfix.js` so it no longer scans and mutates the page every 3000ms.
- Replaced periodic layout fixes with lightweight MutationObserver-based fixes.
- Removed forced `scrollIntoView()` calls from the add-activity shortcut to stop page jumping.
- Hid the duplicate lower add-day button; the top add-day button and blank timeline add zone remain.
- Bumped the page build marker to `render-20260713u`.

## Data safety

This change only touches static frontend files and GitHub Actions smoke-test checks. It does not modify room data, GitHub room storage, `/var/data`, or any saved itinerary lists.

## Why

The page could shake or freeze because multiple hotfix scripts were periodically changing DOM structure and panel layout while the main app was rendering. The new behavior only reacts when relevant DOM nodes actually change.
