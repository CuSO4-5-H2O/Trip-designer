# 2026-07-14 E - Redundant sync render guard

## Change

- Prevented successful HTTP save responses from triggering a full app render when the returned server state is visibly identical to the just-saved client state.
- Cleared the queued WebSocket state after a matching HTTP save succeeds, so the same state is not flushed again after 60 seconds.
- Added a visible-state comparison that ignores timestamp-only fields such as `updatedAt`, `createdAt`, and `orderUpdatedAt`.
- Bumped the page build marker and `sync-throttle.js` cache key to `render-20260714e`.

## Why

The one-minute queued WebSocket flush and timestamp-only server responses could make the app rebuild the whole itinerary list even though the visible trip content had not changed. This caused periodic page jitter.

## Validation

- HTTP POST writes still persist to the server.
- Redundant save responses omit `state`, so `app-collab.js` does not call `applyRemote()` and full `render()` for no-op sync acknowledgements.
- Remote updates with real visible changes still include `state` and continue to sync normally.
