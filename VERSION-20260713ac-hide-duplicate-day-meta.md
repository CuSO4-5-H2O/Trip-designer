# 2026-07-13 AC - Hide duplicate day meta row

## Change

- Hid the lower duplicated day summary row (`.day-meta`) inside each day card.
- Kept the top day header summary visible so city, stay, and budget remain readable and clickable.
- Bumped the page build marker and `inline-polish.js` cache key to `render-20260713ac`.

## Why

The day card was showing the same city, stay, and budget information twice: once in the header and once as chips below the card controls. The lower row is redundant and makes the card feel cluttered.

## Validation

- Confirmed the CSS patch targets only `.day-card .day-meta`.
- Existing top summary fields remain available for inline editing.
