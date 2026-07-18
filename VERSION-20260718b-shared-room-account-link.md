# VERSION 20260718b - shared room account linking

## What changed

- `room-login.js` now links shared rooms to signed-in accounts.
  - When a signed-in user opens a URL with `?room=...`, the client calls `/api/auth/join-room` in the background.
  - The room dialog now shows the current account state and whether the current room has been added to the account room list.
  - Entering or creating a room from the dialog also attempts to remember that room on the signed-in account before navigation.
- The room dialog now includes an account action.
  - Signed-in users can jump back to the account entry page.
  - Signed-out users see a clear `登录 / 注册` entry.
- `index.html` build marker was bumped to `render-20260718c` and now loads `room-login.js?v=render-20260718c`.

## Why

The app already allowed collaborators to edit a shared `?room=` link, but a logged-in collaborator who opened a shared room did not have that room recorded in their account. This made the account room model incomplete. Now each account still has one default owner room, while shared rooms can be attached as editor rooms when opened or entered.

## Verification

- JavaScript syntax checked for `room-login.js`, `server.js`, and `auth-runtime.js` from GitHub raw.
- GitHub Actions passed on commit `1e5131b`:
  - `Smoke test` success.
  - `WebSocket smoke test` success.
- Production Render verified:
  - Served `index.html` contains `render-20260718c`.
  - Served `index.html` loads `./room-login.js?v=render-20260718c`.
  - `/api/auth/status` reports account storage ready at `accounts.json`.
- Production account-room API test verified:
  - Temporary account registration returned one default room.
  - `/api/auth/join-room` added a separate shared room.
  - `/api/auth/me` then returned both rooms and included the shared room.

## Notes

- This does not change itinerary room data or delete any existing lists.
- Shared room links remain editable without login; login only makes the shared room easier to recover from the account.
