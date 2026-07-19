# VERSION 20260719i - Mobile inline entry and AI insertion

## Changes

- Loaded the inline activity editor through the room bootstrap path only, avoiding duplicate inline editor event handlers in the main entrypoint.
- Restored day `+`, empty day area, activity edit button, transport chip, budget chip, and inline field chips as direct add/edit entry points for the selected day.
- Moved the mobile visual order to show the timeline/day cards before sidebar/settings and before the map/AI smart panel.
- Made the quick planning panel collapsible and default-collapsed on mobile, with a mobile fallback that re-collapses it once after document-import enhancements finish.
- Removed the 1.5 second mobile layout polling loop. Mobile panel collapsing is now startup/mutation driven to reduce visible page shaking.
- Collapsed AI panels now hide the quick-plan body too, preventing large empty AI space on mobile.
- Added larger mobile hit targets and higher z-index for activity controls, day controls, plus menus, and add-day menus.
- AI quick-plan apply writes generated days at the selected date position: blank selected day is replaced; nonblank selected day inserts after it.

## Verification Notes

- Production `index.html` was verified with `render-20260719i` asset versions after Render deployment.
- Mobile QA used `390x844` on production room `QAMOB088`.
- Day `+` hit-testing passed: the plus button was visible and `elementFromPoint` returned `.day-card-add-floating`.
- Day `+` added one activity to the active day; inline title edit saved on Enter; transport chip opened the inline transport editor and saved `car` transport from `酒店` to `博物馆`.
- Cloud `/api/room-state` confirmed the mobile edit persisted at revision 6.
- AI quick-plan UI generated a DeepSeek plan and applied it after selected Day 1, producing order: original Day 1, AI generated Day 2, old Day 2, old Day 3.
- Cloud `/api/room-state` confirmed the AI insertion order at revision 10.
- Mobile screenshot check had no horizontal overflow: `documentElement.scrollWidth <= innerWidth`.
