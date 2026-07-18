# 2026-07-18h Browser Verified Release

## What Changed

- Updated `index.html` to `render-20260718h`.
- Updated `room-bootstrap.js` so the dynamic app entry now loads:
  - `app-collab.js?v=render-20260718h`
  - `inline-activity-template.js?v=render-20260718h`
- Updated the no-room auth gate so it is exclusive and does not leave the editor shell visible behind the login/register page.
- Kept GitHub Actions workflows removed; `.github/workflows` remains empty.

## Why

A real browser check showed two remaining problems after the `g` release:

- The visible page was `render-20260718g`, but `room-bootstrap.js` still injected the older `app-collab.js?v=render-20260718d` and `inline-activity-template.js?v=render-20260718d`.
- Opening `https://tripdesigner.onrender.com/` without a room showed the login/register gate, but the editor app shell was still present behind it.

## Browser Verification

Verified on Render production with the in-app browser:

- No-room page now shows only the login/register gate:
  - `gateCount = 1`
  - `appShellCount = 0`
  - `dayListCount = 0`
  - no console errors
- Room page loads the expected h scripts:
  - `room-bootstrap.js?v=render-20260718h`
  - `app-collab.js?v=render-20260718h`
  - `inline-activity-template.js?v=render-20260718h`
  - `activity-drag-scope.js?v=render-20260718h`
- In a fresh production room, clicking the visible `+` add-item button created an activity row and opened the inline title editor.
- Editing the title and pressing Enter closed the editor and saved to cloud.
- Direct `GET /api/room-state` confirmed the saved activity title existed in the GitHub-backed room.
- Earlier browser verification in the same run also confirmed:
  - place chip opens inline editor and saves to cloud
  - budget chip saves amount/currency to cloud
  - transport chip saves car/from/to to cloud
  - AI quick-plan frontend generated exactly 3 preview days from the Nairobi text
  - applying the AI plan added 3 days to the list and saved to cloud
  - reloading the same room preserved all days and activities

## Production API Verification

The production API smoke script passed after the h deployment:

- GitHub room storage backend is active, cloud-only, and hydrated.
- Account registration creates distinct default rooms.
- A friend account can join the owner room as editor.
- Owner and friend writes are both preserved in the same room.
- DeepSeek quick-plan sample returns exactly 3 days.
- Generated 3-day AI plan saves to cloud and reads back.
- Concurrent stale writes merge without conflict backups.
- Tombstone deletion prevents stale clients from resurrecting deleted activities.

## Current Release Marker

`render-20260718h`
