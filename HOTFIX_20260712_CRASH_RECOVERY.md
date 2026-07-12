# 2026-07-12 Crash Recovery Hotfix

## Summary

This hotfix focuses on recovering the Render production page after the UI became unresponsive or appeared crashed.

## Changes

- `quick-plan.js` no longer observes the full `.app-shell` DOM with `MutationObserver`.
- `quick-plan.js` no longer opens its own BroadcastChannel or remote write path.
- Quick plan reads and writes through `window.TripPlanner` only, keeping the main app store as the only write channel.
- The legacy `trip-insights.js` script is temporarily removed from `index.html` because it still contains a full-app MutationObserver and can compete with the main render flow.
- `index.html` now loads `quick-plan.js?v=quick-20260712b`.
- Smoke test now asserts that production HTML does not load `trip-insights.js` and does load the safe quick-plan version.

## Data Safety

- No Render Persistent Disk data is changed.
- No room data, itinerary list, day, activity, member, or budget data is deleted or migrated.
- This change only affects frontend script loading and quick-plan behavior.

## Current Tradeoff

- The standalone legacy statistics/budget insight panel is temporarily disabled.
- Per-activity budget input still exists in the fixed floating activity editor.
- A safer stats panel should be reintroduced later through the unified `TripPlanner` store without global DOM observers.

## Main Commits

- `049fbc7`: Stop quick plan DOM observer feedback loop.
- `2f2cd7b`: Disable legacy insights script and bump quick plan.
- `b9ea2a1`: Assert safe quick plan entry in smoke test.
