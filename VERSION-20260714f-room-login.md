# VERSION 20260714f - Room Login Switcher

## Summary

- Added a visible room login/switcher entry inside the app.
- Users can now enter the same room code, copy the current room link, or generate a new room from one dialog.
- The change does not touch trip data, room data, sync payloads, or saved itineraries.

## User Behavior

- Top bar now shows a room button such as `房间 1075424A`.
- Clicking it opens `进入同一个房间`.
- Same room code means the same cloud itinerary data.
- The sidebar room code is also clickable and opens the same dialog.
- Nickname is stored locally and reused by the collaboration member input.

## Data Safety

- No migration is performed.
- No local cache is uploaded automatically.
- No existing list/day/activity/member data is rewritten by this feature.
- Switching room only changes the URL room parameter and reloads that room.

## Verification Targets

- Render page includes `render-20260714f`.
- Render page loads `room-login.js?v=render-20260714f`.
- Existing room data remains unchanged after the deployment.
