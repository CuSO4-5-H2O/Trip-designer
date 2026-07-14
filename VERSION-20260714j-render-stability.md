# VERSION 20260714j - render stability wiring

## What changed

- Bumped the main app bundle loaded by `room-bootstrap.js` to `render-20260714j` so Render and browsers no longer keep using the older `app-collab.js` bundle.
- Bumped the visible page build marker in `index.html` to `render-20260714j`.
- Added `inline-anchor-preview.js` to `index.html` so inline edits update the existing chip/text anchor before the inline editor closes.
- This version depends on the preceding `app-collab.js` render-stability change:
  - server acknowledgements with no visible data change no longer rebuild the whole day list;
  - inline edit saves avoid full timeline re-render and only refresh statistics/detail state;
  - volatile timestamps are ignored when deciding whether the UI actually needs to rerender.

## Why

Clicking `+` or editing an item was causing the day list to be recreated, then recreated again when the server acknowledgement arrived. That produced the visible flash/jump reported in the app. The fix keeps the current DOM in place for inline edits and ignores duplicate same-state server echoes.

## Verification targets

- `index.html` should show `trip-build=render-20260714j` and load `room-bootstrap.js?v=render-20260714j`.
- `room-bootstrap.js` should load `app-collab.js?v=render-20260714j`.
- `inline-anchor-preview.js?v=render-20260714j` should be loaded after `inline-polish.js`.
- Clicking a chip or pressing Enter in an inline editor should not rebuild the full `#dayList` for that edit.
