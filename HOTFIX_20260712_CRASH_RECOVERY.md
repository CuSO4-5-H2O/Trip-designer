# 2026-07-12 Crash Recovery Hotfix

## Summary

This hotfix focuses on recovering the Render production page after the UI became unresponsive or appeared crashed.

## Changes

- `quick-plan.js` no longer observes the full `.app-shell` DOM with `MutationObserver`.
- `quick-plan.js` no longer opens its own BroadcastChannel or remote write path.
- Quick plan reads and writes through `window.TripPlanner` only, keeping the main app store as the only write channel.
- The legacy `trip-insights.js` script is temporarily removed from `index.html` because it still contains a full-app MutationObserver and can compete with the main render flow.
- `index.html` now loads `quick-plan.js?v=quick-20260712b`.
- `seed-room-1075424A.js` syntax was repaired so the smoke test can parse the seed data again.
- Smoke test endpoint checks now use real server endpoints: `/healthz`, `/api/ai/recommend`, and `/api/map-config`.

## 2026-07-13 Follow-up

- Production build marker moved to `render-20260713g`.
- `index.html` now loads `map-providers-lite.js` instead of the heavier `map-providers.js` startup script.
- `index.html` now loads `entry-actions-lite.js` instead of the heavier `entry-actions.js` startup script.
- `index.html` now loads `startup-cache-guard.js?v=render-20260713g` immediately before `app-collab.js`.
- `startup-cache-guard.js` is now non-destructive: it backs up old per-room local itinerary cache and temporarily hides it from startup, instead of deleting it.
- `local-recovery.js` adds a `恢复本机行程` button when a local/session recovery backup exists. Restoring creates new `本机恢复 - ...` lists and does not overwrite the server list.
- The lite scripts avoid full-page `MutationObserver` startup loops and only add small controls on a timer.
- The map panel no longer loads Google or AMap browser SDKs during page startup. It calls `/api/map/plan` only after the user clicks `计算路线`, then renders a lightweight location and route summary.
- The item `+` shortcut focuses the existing built-in activity form instead of mounting a second floating editor during startup.
- Smoke test now asserts `render-20260713g`, the lite script entry points, `startup-cache-guard.js`, and `local-recovery.js`.

## Data Safety

- No Render Persistent Disk data is changed.
- No room data, itinerary list, day, activity, member, or budget data is deleted or migrated automatically.
- The startup cache guard preserves recoverable browser-local cache under `trip-planner-recovery:*` where quota allows.
- The recovery helper restores local backups only after the user clicks the recovery button, and it appends them as new lists.
- Existing historical backup lists are not automatically deleted.

## Current Tradeoff

- The standalone legacy statistics/budget insight panel is temporarily disabled.
- The heavy floating activity editor and full browser-map renderer are bypassed in `render-20260713g` to prioritize page loading and sync recovery.
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
- `2f83403`: Make startup cache guard non-destructive.
- `f6c65a7`: Add local itinerary recovery helper.
- `4e16ba2`: Load local recovery helper.
- `980e72f`: Assert local recovery helper in smoke test.
