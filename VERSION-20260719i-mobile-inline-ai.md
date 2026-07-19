# VERSION 20260719i - Mobile inline entry, AI insertion, and cloud startup primer

## Changes

- Loaded the inline activity editor through the room bootstrap path only, avoiding duplicate inline editor event handlers in the main entrypoint.
- Restored day `+`, empty day area, activity edit button, transport chip, budget chip, and inline field chips as direct add/edit entry points for the selected day.
- Moved the mobile visual order to show the timeline/day cards before sidebar/settings and before the map/AI smart panel.
- Made the quick planning panel collapsible and default-collapsed on mobile, with a mobile fallback that re-collapses it once after document-import enhancements finish.
- Removed the 1.5 second mobile layout polling loop. Mobile panel collapsing is now startup/mutation driven to reduce visible page shaking.
- Collapsed AI panels now hide the quick-plan body too, preventing large empty AI space on mobile.
- Added larger mobile hit targets and higher z-index for activity controls, day controls, plus menus, and add-day menus.
- AI quick-plan apply writes generated days at the selected date position: blank selected day is replaced; nonblank selected day inserts after it.
- Added `startup-cloud-primer.js` and loaded it before the room app boot path. It reads the current room from `/api/room-state` before `app-collab.js` initializes, then primes the guarded storage read so the app starts from the GitHub cloud room state instead of generating and displaying a default blank itinerary first.

## Verification Notes

- Production `index.html` was verified with `render-20260719j` and `startup-cloud-primer.js?v=render-20260719j` after Render deployment.
- Mobile QA used `390x844` on production room `QAMOB088`.
- Day `+` hit-testing passed: the plus button was visible and `elementFromPoint` returned `.day-card-add-floating`.
- Day `+` added one activity to the active day; inline title edit saved on Enter; transport chip opened the inline transport editor and saved `car` transport from `酒店` to `博物馆`.
- Cloud `/api/room-state` confirmed the mobile edit persisted at revision 6.
- AI quick-plan UI generated a DeepSeek plan and applied it after selected Day 1, producing order: original Day 1, AI generated Day 2, old Day 2, old Day 3.
- Cloud `/api/room-state` confirmed the AI insertion order at revision 10.
- Mobile screenshot check had no horizontal overflow: `documentElement.scrollWidth <= innerWidth`.
- Startup cloud primer QA used production room `QAPR3723`, seeded with one list named `云端保留测试`, 2 days, and 2 activities.
- Opening `QAPR3723` rendered `云端保留测试` immediately with both cloud days; the page did not show or save a default `新行程单1 天 · 0 项` state.
- Reloading `QAPR3723` preserved the same 2-day, 2-activity cloud data.
- Two-tab realtime QA on `QAPR3723` passed: adding `双端同步新增事项` in one tab appeared in the other tab and `/api/room-state` confirmed 3 cloud activities.
