# 2026-07-14 C - Reliable HTTP save

## Change

- Stopped throttling HTTP `POST /api/room-state` writes.
- Kept WebSocket state messages queued, but allowed the app's existing HTTP fallback to persist changes for real.
- Protected newer local cached room data during `GET /api/room-state`; if local data is newer than the server response, the client keeps the local copy and immediately flushes it back to the server.
- Bumped the page build marker and `sync-throttle.js` cache key to `render-20260714c`.

## Why

The previous throttle returned a fake queued success for HTTP saves. The UI could show saved before the server actually persisted the newest itinerary. If the page refreshed before the 60-second flush, the older server state could overwrite the user's latest edits.

## Validation

- HTTP room-state POSTs now pass through to the original fetch implementation.
- Local-newer protection compares timestamp fields before accepting a server GET response.
- Trip data is not mutated by the UI polish changes.
