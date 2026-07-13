# 2026-07-13 AD - Smooth inline activity editing

## Change

- Made activity cards more compact and calmer visually.
- Changed inline budget and transport editors from full-width grid controls to compact in-place controls.
- Added a small restore guard so the original chip or text is immediately restored after an inline editor closes, preventing the list from jumping while the main app re-renders.
- Bumped the page build marker and `inline-polish.js` cache key to `render-20260713ad`.

## Why

Clicking a field inserted a large editing row inside the activity card. When the user finished or canceled editing, the card height changed abruptly, making the list feel shaky and unsmooth.

## Validation

- The lower duplicated day meta row remains hidden.
- Budget and transport editors no longer force a full-width row on desktop.
- The restore guard targets only elements marked with `data-inline-original-display`, so it does not affect normal app layout.
