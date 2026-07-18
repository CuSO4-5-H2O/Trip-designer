# 2026-07-19a - Auth Gate Error Polish

## Summary

Polished the no-room login/account homepage flow so transient network failures no longer show raw English browser errors such as `Failed to fetch`.

## Changes

- Rewrote `auth-bootstrap.js` into a shorter account gate implementation while preserving the account homepage behavior.
- Added a shared `authFetch` helper for auth requests.
- Added `friendlyError` mapping for network failures, auth service startup, expired sessions, and generic login failures.
- Kept account homepage support for owner rooms, invited collaboration rooms, room creation, room join, refresh, logout, and room card navigation.
- Bumped `index.html` build marker and `auth-bootstrap.js` query string to `render-20260719a`.

## Expected Result

Opening `https://tripdesigner.onrender.com/` without `?room=` should show a polished login/register or account homepage flow. If automatic session restore fails, the page should show a Chinese retry/login prompt instead of raw `Failed to fetch`.
