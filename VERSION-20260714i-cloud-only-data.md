# VERSION 20260714i - Cloud-Only GitHub Data Authority

## Summary

- GitHub data storage is now the only production itinerary data authority.
- Browser localStorage/sessionStorage can no longer be read or written as an itinerary data source.
- WebSocket state writes are no longer held for 60 seconds; saves go to the server immediately and the server persists to GitHub.
- Server disk fallback is disabled by default. Disk storage is only allowed when `ALLOW_DISK_STORAGE=true` is explicitly set for local development.

## Frontend Changes

- Added `cloud-only-storage-guard.js` before all planner scripts.
- It blocks reads and writes for itinerary keys:
  - `trip-planner-library:*`
  - `trip-planner-recovery:*`
  - legacy `trip-planner:*` room data, while keeping non-itinerary keys like client id and member name.
- Removed automatic startup cache and local recovery scripts from `index.html`.
- `sync-throttle.js` no longer delays WebSocket state messages or prefers newer local cache over the cloud state.

## Server Changes

- `server.js` no longer falls back to `/var/data/rooms.json` unless `ALLOW_DISK_STORAGE=true` is explicitly configured.
- If GitHub storage is unavailable, POST/state writes return an error instead of saving into a private disk copy.
- `/api/cloud-storage-status` and `/api/room-state` expose storage metadata including `backend`, `cloudOnly`, `allowDiskStorage`, and GitHub path info.

## Important Safety Note

- Existing old browser-local caches are not deleted automatically in this version, because deleting them could destroy unsynced user data.
- They are ignored by the app and cannot become the visible or persisted itinerary source.
- A destructive cleanup button can be added only after explicit user approval.

## Required Render Environment

- `GITHUB_DATA_TOKEN` must be configured.
- Optional defaults:
  - `GITHUB_DATA_REPO=CuSO4-5-H2O/Trip-designer`
  - `GITHUB_DATA_BRANCH=trip-data`
  - `GITHUB_DATA_PATH=rooms.json`
- Do not set `ALLOW_DISK_STORAGE=true` on production Render.
