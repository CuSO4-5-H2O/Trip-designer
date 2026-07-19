# VERSION 20260719i - Mobile inline entry and AI insertion

## Changes

- Loaded `inline-activity-template.js` from `index.html` so the day `+`, empty day area, activity edit button, transport chip, budget chip, and inline field chips can add or edit itinerary items directly in the selected day.
- Moved the mobile visual order to show the timeline and day cards before sidebar/settings and before the map/AI smart panel.
- Removed the 1.5 second mobile layout polling loop. Mobile panel collapsing is now startup/mutation driven to reduce visible page shaking.
- Collapsed AI panels now hide the quick-plan body too, preventing large empty AI space on mobile.
- Added larger mobile hit targets and higher z-index for activity controls, day controls, plus menus, and add-day menus.
- AI quick-plan apply now writes generated days at the selected date position: blank selected day is replaced; nonblank selected day inserts after it.

## Verification Notes

- Requires Render to deploy this commit, then verify `index.html` contains `render-20260719i` script versions.
- Mobile QA target: `390x844`, same room on production, plus button adds an activity to the selected day, edit controls are clickable, and AI quick-plan inserts at the selected day position instead of the bottom.
