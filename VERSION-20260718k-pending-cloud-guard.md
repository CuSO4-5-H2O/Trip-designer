# 2026-07-18k Pending Cloud Guard

## What changed

- Updated `cloud-authority-refresh.js` so server refreshes do not overwrite local edits while the page has pending local changes.
- Updated `sync-throttle.js` to expose `window.__TripPendingLocalSave`, allowing cloud refresh logic to detect unsaved local edits.
- Bumped `index.html` to `render-20260718k` for `sync-throttle.js` and `cloud-authority-refresh.js`.

## Why

During browser testing, adding an activity and pressing Enter could briefly keep the row, then a delayed cloud authority refresh would broadcast the older cloud state and remove the newly added activity. This matched the user's report that edited itineraries could be swallowed. The fix makes pending local edits authoritative until they are saved or retried.

## Production verification

Room `KD33054B` on `https://tripdesigner.onrender.com`:

- Loaded `render-20260718k`.
- Clicked day `+`, typed `不会被吞的事项`, pressed Enter, waited past the cloud refresh window, and the activity remained.
- Edited place chip to `内罗毕国家博物馆`.
- Edited budget chip to `CNY 42`.
- Edited transport chip to `车 · 酒店 → 博物馆`.
- Clicked the sync pill to save immediately.
- `/api/room-state?room=KD33054B` returned 3 days and the edited activity with place, budget, and transport intact.
- Reloaded the same room; the saved row and fields were restored from cloud.
- Opened a second tab in the same room, added `好友添加事项`, saved, and the first tab updated to show both activities.

Room `QPF57151`:

- Used the AI text quick-add panel with `在内罗毕玩3天，第一天抵达并逛市区，第二天去基贝拉贫民窟和博物馆，第三天去长颈鹿中心后出发去马赛马拉`.
- Generated exactly 3 preview days.
- Applied to the current list.
- Saved to cloud; `/api/room-state` returned 3 days with activity counts `[2, 2, 2]`.

## Notes

- No stored itinerary data was edited by this patch.
- GitHub Actions workflows remain absent. Smoke scripts remain disabled/no-op.
