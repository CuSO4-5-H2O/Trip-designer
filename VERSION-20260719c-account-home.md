# VERSION 20260719c - Account Room Dashboard

## Summary

This release upgrades the no-room entry page into an account homepage.
The homepage is designed to keep users from accidentally entering different random rooms on different devices.

## Changes

- Updated `auth-bootstrap.js`.
- Updated `index.html` build metadata to `render-20260719c` and cache-busted `auth-bootstrap.js`.
- When the page is opened without `?room=...`, logged-in users now see an account homepage instead of a bare room gate.
- The homepage shows two separate room groups:
  - `我新建的房间` for rooms owned by the account.
  - `别人邀请的房间` for rooms joined through a shared room ID or invite link.
- Each room card reads the current GitHub-backed room state and shows the active list name, day count, and activity count.
- Users can create a new room from the homepage.
- Users can join a friend's room by entering the shared room ID; joined rooms appear under `别人邀请的房间`.
- Clicking a room card opens that exact `?room=` URL so all devices can use the same cloud data source.

## Data Safety

- No room data is modified by this release.
- No account data is migrated or deleted.
- The change only affects the account homepage UI and entry routing.
- Existing `accounts.json` and `rooms.json` data remain on the GitHub data branch.

## Production Verification

Verified on Render production after deployment:

1. Fetched `https://tripdesigner.onrender.com/` and confirmed `trip-build=render-20260719c` plus `auth-bootstrap.js?v=render-20260719c`.
2. Opened `/` without a `room` query and confirmed the page renders the login/account entry instead of silently entering a random room.
3. Created a production QA account through `/api/auth/register`.
4. Called `/api/auth/create-room` and confirmed the new room is returned as an owned room.
5. Called `/api/auth/join-room` for shared room `34910250` and confirmed it is returned as an editor/invited room.
6. Called `/api/auth/me` and confirmed the account room list contains both owned rooms and the invited room.

QA account used for API verification: `qa_home_api_8jeobd`.
Owned rooms observed: `BB25E3D0`, `59E3B49A`.
Invited room observed: `34910250`.

## Manual Test Targets

- Open `/` while logged out: login/register screen appears.
- Register or login: account homepage appears.
- Create room: the new room appears under `我新建的房间`.
- Join a shared room ID: the room appears under `别人邀请的房间`.
- Click a room card: browser navigates to `/?room=<ROOM_ID>` and opens that room.
- Open the same account on another device: the same owned and joined room groups are listed after login.
