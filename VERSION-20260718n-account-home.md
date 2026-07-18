# 2026-07-18n - Account Home Room List

## Summary

Adds an account homepage for logged-in users so they can see rooms attached to their account instead of relying on manually remembered URLs.

## Changes

- Added `/api/auth/create-room` to create account-owned rooms.
- Login and register now land on an account homepage when no `?room=` is present.
- The account homepage lists both owner rooms and editor rooms joined by invitation.
- Room cards show room id, role, active trip title, day count, and activity count by reading the existing GitHub-backed room state endpoint.
- Users can create a new room, join a shared room id, refresh room cards, enter any room, or log out from the homepage.
- Bumped `index.html` build marker and `auth-bootstrap.js` query string to `render-20260718n` so Render/browser cache pulls the new login flow.

## Smoke/Notification Note

The repository also adds `vercel.json` to disable Vercel auto deployments. Render remains the deployment target; Vercel should stop attempting production deployments from Git pushes.

## Verification Targets

- Open `https://tripdesigner.onrender.com/` without a room while logged out: login/register screen appears.
- Register or log in: account homepage appears and shows owned/default room.
- Click `新建房间`: a new owner room appears.
- Enter a friend's room id through `加入房间`: it appears as a collaboration room.
- Click a room card: browser opens the same room via `?room=`.
