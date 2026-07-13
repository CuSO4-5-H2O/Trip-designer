# VERSION 20260714g - Explicit Room Login

## Summary

- Changed no-room startup behavior to show a login-style room gate instead of silently entering the last remembered room.
- This prevents different devices from accidentally opening different remembered rooms when users visit the bare domain.
- Kept the last room as a prefilled suggestion, not an automatic redirect.

## Behavior

- `https://tripdesigner.onrender.com/?room=1075424A` opens room `1075424A` directly.
- `https://tripdesigner.onrender.com/` shows `登录行程房间`.
- The room input is prefilled with this device's last room when available.
- Users must click `进入房间`, so the selected room is explicit.
- Inside the app, the new room switcher can copy the room link, switch rooms, or create a new room.

## Data Safety

- This change does not modify itinerary data.
- Existing room contents are not migrated, deleted, or merged.
- It only changes how a browser chooses which room to open.

## Recommended Usage

- Share the full URL containing `?room=...` with every collaborator.
- If someone opens the bare domain, ask them to input the same room code shown in the shared URL.
