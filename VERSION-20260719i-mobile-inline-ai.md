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
- Hardened AI quick-plan target detection: applying a generated plan now prioritizes the last clicked day card, then the selected/active day in the DOM, then the trip's saved `selectedDayId`. This prevents generated AI days from falling to the bottom when the UI selection state is stale.
- Bumped the production entrypoint to `render-20260719l` and loaded `ai-quick-plan.js?v=render-20260719l`, forcing browsers to pick up the selected-day insertion fix instead of a cached older quick-plan script.
- Improved AI quick-plan normalization so compound text such as `长颈鹿中心后出发去马赛马拉` is split into a visit activity and a travel activity with car transport.
- Cleaned AI quick-plan city parsing so phrases such as `在内罗毕安排1天` produce location `内罗毕` rather than `内罗毕安排`.
- Converted `cloud-authority-refresh.js` into a passive cloud-readiness marker. It no longer writes cloud state into `localStorage`, no longer posts a `BroadcastChannel` library update, and no longer runs the 1.8 second settle refresh that could visibly replace the day list after startup.
- Bumped the production entrypoint to `render-20260719m` and loaded `cloud-authority-refresh.js?v=render-20260719m` so browsers pick up the passive refresh script.
- Added a server-side blank overwrite guard: if a room already has real content, a startup/default blank `新行程单` state is ignored instead of being merged as newer data.
- Added `startup-cloud-primer.js` and loaded it before the room app boot path. It reads the current room from `/api/room-state` before `app-collab.js` initializes, then primes the guarded storage read so the app starts from the GitHub cloud room state instead of generating and displaying a default blank itinerary first.

## Verification Notes

- Production `index.html` was verified with `render-20260719j` and `startup-cloud-primer.js?v=render-20260719j` after Render deployment.
- Mobile QA used `390x844` on production room `QAMOB088`.
- Day `+` hit-testing passed: the plus button was visible and `elementFromPoint` returned `.day-card-add-floating`.
- Day `+` added one activity to the active day; inline title edit saved on Enter; transport chip opened the inline transport editor and saved `car` transport from `酒店` to `博物馆`.
- Cloud `/api/room-state` confirmed the mobile edit persisted at revision 6.
- AI quick-plan UI generated a DeepSeek plan and applied it after selected Day 1, producing order: original Day 1, AI generated Day 2, old Day 2, old Day 3.
- Cloud `/api/room-state` confirmed the AI insertion order at revision 10.
- Follow-up hardening commit `9fd0b8c9d1f2ce43e68f04dc0e0213be361e6ec2` fixed stale selection fallback by recording the last touched day card before applying AI generated days.
- Follow-up entrypoint commit `59c2ba7f500fc76415f890b1700a4b410ae3836a` bumps `ai-quick-plan.js` to `render-20260719l`, ensuring the browser no longer keeps the old bottom-insertion script from cache.
- Follow-up AI runtime QA called production `/api/ai/quick-plan` with a 3-day Nairobi prompt. It returned exactly 3 days; Day 2 contained `基贝拉贫民窟` and `国家博物馆`; Day 3 split `长颈鹿中心` and `出发去马赛马拉` with `car` transport from `长颈鹿中心` to `马赛马拉`.
- Follow-up AI parser commit `ece0263438fe4b65ee8ea88d28ef692135d3cfb0` cleaned planning suffixes from city names.
- Production AI parser QA after that commit called `/api/ai/quick-plan` with `在内罗毕安排1天，上午去国家博物馆，下午去咖啡馆休息`; it returned location `内罗毕` and activities `国家博物馆 / 咖啡馆休息`.
- Production 3-day parser regression still passed after the cleanup: it returned `内罗毕` for all 3 days, kept Day 2 `基贝拉贫民窟 / 国家博物馆`, and split Day 3 into `长颈鹿中心` plus `出发去马赛马拉` with car transport.
- Passive cloud refresh commit `51ae88119ef4872fb2c351cb3f90eb91ae4713a8` removed `BroadcastChannel`, `localStorage.setItem`, and the delayed settle refresh from `cloud-authority-refresh.js`.
- Production asset QA for `cloud-authority-refresh.js?v=render-20260719m` confirmed `hasBroadcastChannel=false`, `hasLocalStorageWrite=false`, `hasSettleTimer=false`, and `hasMarkCloudReady=true`.
- Production stability QA used room `QAPASABE3`: after opening `render-20260719m`, 8 DOM samples over 5.6 seconds kept one unique day order, `云端第一天 / 云端第二天`, with no delayed replacement of the day list.
- Production storage status returned `backend=github`, `cloudOnly=true`, `allowDiskStorage=false`, `dataFile=disabled`, `repo=CuSO4-5-H2O/Trip-designer`, `branch=trip-data`, `path=rooms.json`, and `ready=true`.
- Production auth status returned `ready=true`, `repo=CuSO4-5-H2O/Trip-designer`, `branch=trip-data`, and `path=accounts.json`.
- Remote-device sync QA used room `QAPASABE3`: an external `/api/room-state` write from client `codex-remote-device` added `远端同步测试事项`; the already-open page saw it automatically and the cloud state contained the same activity under `云端第二天`.
- Account sharing QA registered owner `qaowner_0df9fb` with owner room `64213E19`, registered friend `qafriend_0df9fb` with own room `AB14178F`, then joined the friend to `64213E19` as `editor`; `/api/auth/me` returned both rooms for the friend.
- Follow-up server commit `c632f46e98ed7d12b70781da8597218838a1a95d` restored the full server file and added protection against blank startup state overwrites; commit `f26f9d86da081bc9b2d691592346f35860c6d707` documents this guard.
- Production blank-overwrite QA used room `QAGDB93B`: after seeding three real days, a deliberate blank `新行程单` write was ignored and the cloud still returned `真实一 / 真实二 / 真实三`.
- Production AI selected-day QA used room `QAGDB93B`: with Day 2 selected, DeepSeek generated a one-day Nairobi plan and applying it produced cloud order `真实一 / 真实二 / 内罗毕 / 真实三`, confirming it inserted after the selected day instead of at the bottom.
- Mobile screenshot check had no horizontal overflow: `documentElement.scrollWidth <= innerWidth`.
- Startup cloud primer QA used production room `QAPR3723`, seeded with one list named `云端保留测试`, 2 days, and 2 activities.
- Opening `QAPR3723` rendered `云端保留测试` immediately with both cloud days; the page did not show or save a default `新行程单1 天 · 0 项` state.
- Reloading `QAPR3723` preserved the same 2-day, 2-activity cloud data.
- Two-tab realtime QA on `QAPR3723` passed: adding `双端同步新增事项` in one tab appeared in the other tab and `/api/room-state` confirmed 3 cloud activities.