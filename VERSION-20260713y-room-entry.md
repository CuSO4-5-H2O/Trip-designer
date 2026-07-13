# render-20260713y - Room Entry Lock

## Changes

- Added an explicit room entry gate when the page is opened without a `?room=` parameter.
- The app now remembers the last valid room on the current device using `tripdesigner:last-room`.
- If a remembered room exists, opening the root site automatically restores that room in the URL before the editor starts.
- If no remembered room exists, the editor is not started; users must enter a room code or intentionally create a new room.
- `app-collab.js` is no longer loaded directly from `index.html`; `room-bootstrap.js` loads it only after a room is selected.

## Why

This prevents different devices from silently creating different random rooms when users open the bare domain. The same itinerary stays tied to the same room code, and sharing must use the full URL with `?room=...`.

## Data Safety

This release does not rewrite, seed, delete, or migrate any saved itinerary data. It only changes startup routing before the editor loads.

## User Rule

Use one canonical room link for collaborators, for example:

```text
https://tripdesigner.onrender.com/?room=1075424A
```

Opening the bare domain is now safe: it either restores this device's last room or shows the room entry screen.
