# 2026-07-12 Crash Recovery Hotfix

## Summary

This hotfix focuses on recovering the Render production page after the UI became unresponsive or appeared crashed.

## Changes

- `quick-plan.js` no longer observes the full `.app-shell` DOM with `MutationObserver`.
- `quick-plan.js` no longer opens its own BroadcastChannel or remote write path.
- Quick plan reads and writes through `window.TripPlanner` only, keeping the main app store as the only write channel.
- The legacy `trip-insights.js` script is temporarily removed from `index.html` because it still contains a full-app MutationObserver and can compete with the main render flow.
- `index.html` now loads `quick-plan.js?v=quick-20260712b`.
- `index.html` now loads `server-first.js?v=server-first-20260712a` before the main app so online room pages ignore stale local itinerary cache and start from the server room state.
- `seed-room-1075424A.js` syntax was repaired so the smoke test can parse the seed data again.
- Smoke test now asserts that production HTML does not load `trip-insights.js`, does load the safe quick-plan version, and does load the server-first cache guard.
- Smoke test endpoint checks now use real server endpoints: `/healthz`, `/api/ai/recommend`, and `/api/map-config`.

## 2026-07-13 Follow-up

- Production build marker moved to `render-20260713e`.
- `index.html` now loads `map-providers-lite.js` instead of the heavier `map-providers.js` startup script.
- `index.html` now loads `entry-actions-lite.js` instead of the heavier `entry-actions.js` startup script.
- `index.html` now loads `startup-cache-guard.js?v=render-20260713f` immediately before `app-collab.js`.
- `startup-cache-guard.js` ignores and removes old per-room local itinerary cache before the main app reads it. This prevents a stale or oversized local cache from blocking page startup.
- The lite scripts avoid full-page `MutationObserver` startup loops and only add small controls on a timer.
- The map panel no longer loads Google or AMap browser SDKs during page startup. It calls `/api/map/plan` only after the user clicks `计算路线`, then renders a lightweight location and route summary.
- The item `+` shortcut focuses the existing built-in activity form instead of mounting a second floating editor during startup.
- Smoke test now asserts `render-20260713e`, the lite script entry points, and `startup-cache-guard.js`.

## Data Safety

- No Render Persistent Disk data is changed.
- No room data, itinerary list, day, activity, member, or budget data is deleted or migrated.
- The startup cache guard only removes browser-local per-room cache on the device opening the page; the server room state remains authoritative.
- This change only affects frontend script loading, quick-plan behavior, stale browser cache handling, seed syntax, CI assertions, and startup-only UI helpers.
- Existing historical backup lists are not automatically deleted.

## Current Tradeoff

- The standalone legacy statistics/budget insight panel is temporarily disabled.
- The heavy floating activity editor and full browser-map renderer are bypassed in `render-20260713e` to prioritize page loading and sync recovery.
- Per-activity editing still works through the built-in right-side activity form.
- A safer full editor and visual map layer should be reintroduced later through the unified `TripPlanner` store without global DOM observers.

## Main Commits

- `049fbc7`: Stop quick plan DOM observer feedback loop.
- `2f2cd7b`: Disable legacy insights script and bump quick plan.
- `b9ea2a1`: Assert safe quick plan entry in smoke test.
- `1712885`: Add server-first stale local cache guard.
- `3362c5e`: Load server-first guard before app store.
- `7368a94`: Repair seeded room transport syntax.
- `68e200c`: Fix smoke test endpoint assertions.
- `72a6da3`: Add safe lite entry actions script.
- `e8da303`: Add safe lite map panel script.
- `0862129`: Switch production HTML to lite startup scripts.
- `6c76bc0`: Update smoke test for lite startup scripts.
- `b353ab0`: Add startup cache guard before app store.
- `16cb7e2`: Load startup cache guard before app store.
- `2d5b381`: Assert startup cache guard in smoke test.
