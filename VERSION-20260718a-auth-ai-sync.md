# VERSION 20260718a - auth, AI quick plan, and sync stability

## What changed

- Added account-backed entry support for the Render server path.
  - `/api/auth/status`, `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/join-room` are exposed from `server.js` as well as `runtime.js`.
  - Account data is stored in GitHub data storage on the `trip-data` branch, separate from room itinerary data.
  - Each registered account receives one default room; shared `?room=` links still open the same room directly for collaborators.
- Loaded the account gate and AI quick-plan UI from `index.html`.
  - Visiting without `?room=` shows login/register instead of silently creating a different room.
  - Visiting a shared `?room=` link continues to open that room for editing.
- Added `/api/ai/quick-plan` for DeepSeek-powered natural-language itinerary creation.
  - The server now infers explicit day counts from text and sends the target day count to DeepSeek.
  - After DeepSeek responds, the server enforces the parsed day count deterministically by padding or truncating days.
  - Ordinal labels such as `第一天`, `第二天`, `第三天` no longer get counted as extra duration.
- Fixed first-save behavior for brand-new rooms.
  - A pristine server-created placeholder room now adopts the first real client state instead of merging in an extra blank list.
  - Existing rooms still merge by entity ID and timestamp so collaborators do not overwrite each other.
- Removed the add-activity modal fight.
  - `interaction-hotfix.js` no longer overwrites `TripPlannerQuickAdd` with the old modal flow.
  - Day-card `+` now delegates to the inline activity template path; fallback creation is inline and does not open `quickActivityModal`.
  - `index.html` build marker was bumped to `render-20260718b` for cache busting.

## Verification

- GitHub Actions passed on the latest relevant commits:
  - `Smoke test` success on `3c89ee6`.
  - `WebSocket smoke test` success on `3c89ee6`.
- Render health checks verified:
  - `/healthz` reports GitHub storage enabled, ready, cloud-only, and hydrated.
  - `/api/auth/status` returns `ok: true` and GitHub account storage ready.
  - `/api/ai/quick-plan` rejects GET with 405, confirming the endpoint is mounted.
- Real DeepSeek quick-plan test verified:
  - Input: `在内罗毕玩3天，第一天抵达并逛市区，第二天去基贝拉贫民窟和博物馆，第三天去长颈鹿中心后出发去马赛马拉`.
  - Result: `expectedDays: 3`, exactly 3 days, all locations set to `内罗毕`, and activities assigned to the intended days.
- Account and room storage test verified:
  - Temporary account registration succeeded.
  - `/api/auth/me` returned the account and default room.
  - `/api/auth/join-room` added a shared room to the account.
- Room persistence test verified:
  - A brand-new temporary room saved one list with one activity.
  - A fresh GET returned the same single list and activity from the server.
- Browser interaction test verified:
  - A new test room loaded `render-20260718b` and `interaction-hotfix.js?v=render-20260718b`.
  - Clicking the day-card `+` created an inline activity row.
  - `quickActivityModal` did not open.
  - Editing the new row title and pressing Enter persisted the title to `/api/room-state`.

## Notes

- Existing user rooms and historical backup lists are not deleted or rewritten by this version.
- Test accounts and temporary test rooms were created only to verify the production GitHub-backed path end to end.
