# VERSION 20260719f - Account Home Entry

## Summary

This release makes the account homepage reachable from the itinerary editor and verifies that the homepage shows both owned rooms and invited rooms.

## Changes

- Added `account-home-link.js`.
- Added a topbar icon button with `id="accountHomeBtn"` and title `账号主页`.
- Clicking the button removes the `room` query and returns to the account homepage route.
- Bumped `index.html` build marker to `render-20260719f` and loaded `ai-quick-plan.js?v=render-20260719f` plus `account-home-link.js?v=render-20260719f`.
- Updated `auth-bootstrap.js` so transient `/api/auth/me` restore failures no longer delete `tripdesigner:auth-token` and `tripdesigner:account`.
- Expired or invalid auth errors still clear the local login state.

## Account Homepage Behavior

- Without a `room` query, the app shows the login/register/account homepage flow.
- After login or registration, the homepage lists:
  - `我新建的房间`
  - `别人邀请的房间`
- Users can create a new room from the homepage.
- Users can enter a friend room code and save it to their account homepage as an invited room.
- Room cards show the cloud room summary from `/api/room-state`.

## Production Verification

Verified against Render production on 2026-07-19:

1. `https://tripdesigner.onrender.com/` returned `render-20260719f` and included `account-home-link.js?v=render-20260719f`.
2. Registered QA account `qa_home_ui_vzo1gap` through the rendered login/register page.
3. The account homepage rendered with `我新建的房间` count `1 个` and `别人邀请的房间` count `0 个`.
4. Joined room `47F10036` through the homepage join control.
5. The homepage then rendered `别人邀请的房间` count `1 个`, with room card `47F10036`.
6. Room page rendered `render-20260719f` and exposed the topbar `账号主页` button.
7. `/api/auth/status` reported GitHub account storage ready on branch `trip-data`, file `accounts.json`.
8. `/api/cloud-storage-status` reported room storage backend `github`, branch `trip-data`, file `rooms.json`, `allowDiskStorage: false`, and `cloudOnly: true`.
9. GitHub tree inspection showed no `.github/workflows/*` files on `main`, so `smoketest1` emails are not coming from GitHub Actions in this repository.

## Notes

- The in-app browser security policy blocked one room-card navigation attempt during verification. The account homepage DOM and production API persistence were still verified.
- No existing room or account data was deleted or migrated.
