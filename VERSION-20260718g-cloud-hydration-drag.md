# 2026-07-18g Cloud Hydration And Drag Fixes

## What Changed

- Added `cloud-sync-guard.js` protection for both WebSocket and HTTP room-state writes.
  - WebSocket `join` messages no longer send local state.
  - WebSocket `state` writes are blocked until the room has been hydrated from GitHub-backed `/api/room-state`.
  - HTTP `POST /api/room-state` is blocked until the same cloud hydration mark exists.
- Added `cloud-ready-ui-guard.js` to disable itinerary editing controls while the room is still loading from cloud.
- Added `activity-drag-scope.js` so dragging an activity row does not bubble into the parent day-card drag handler.
- Scoped `entry-actions-lite.js` observers to stable containers and removed the injected quick-plan action row that duplicated controls.
- Updated `index.html` to `render-20260718g` and loaded the new guards.
- Kept `.github/workflows` empty so smoke-test emails do not restart.

## Why

These changes target the data-loss and UI instability reports:

- Local placeholder or stale room data must not write back before the GitHub-backed room state arrives.
- Users should not be able to edit a blank placeholder while the authoritative cloud room is still loading.
- Activity drag handles should reorder activities, not move the whole day.
- Extra MutationObservers and duplicated quick-plan controls were contributing to flicker and confusing UI.

## Verification

- GitHub raw `index.html` contains `render-20260718g`, `cloud-ready-ui-guard.js`, `activity-drag-scope.js`, and the updated `entry-actions-lite.js`.
- Render production `https://tripdesigner.onrender.com/?room=...` returns the same `render-20260718g` entrypoint.
- Syntax checks passed for:
  - `cloud-sync-guard.js`
  - `cloud-ready-ui-guard.js`
  - `activity-drag-scope.js`
  - `entry-actions-lite.js`
- Production API smoke passed against Render:
  - GitHub storage backend active, cloud-only, hydrated.
  - Account registration gives distinct default rooms.
  - Friend account can join owner room as editor.
  - Owner and friend writes are both preserved in the same room.
  - DeepSeek quick-plan sample produced exactly 3 days.
  - Generated 3-day plan saved to GitHub-backed room and read back.
  - Concurrent stale writes merged without conflict backups.
  - Deleted activity did not resurrect from stale state.

## Remaining Manual UI Check

A real browser click/drag check should still be done after Render is fully settled. The current Codex environment did not have a working Playwright browser package, so this version was verified by production API and static frontend checks rather than an automated visual click test.
