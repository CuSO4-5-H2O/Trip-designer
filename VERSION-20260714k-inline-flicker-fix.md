# VERSION 20260714k - inline flicker fix

## What changed

- Removed the full timeline `render()` call from `loadActivity()`.
  - Clicking an activity edit button now only updates the side/detail state, smart panel state, and selected outline.
  - The day list DOM is not rebuilt just because the user opens an existing item for editing.
- Treated `inline-template-*` saves as lightweight timeline refreshes instead of full app rerenders.
  - Adding an inline template still inserts the new activity row, but it no longer rebuilds sidebar/list/member panels at the same time.
- Bumped `room-bootstrap.js` to load `app-collab.js?v=render-20260714k`.
- Bumped `index.html` build marker and script query strings to `render-20260714k`.

## Why

The user reported that clicking `+` or editing an activity caused the page to flash/jump. One remaining cause was `loadActivity()` calling the full `render()` even though opening an editor does not change trip data. Another cause was inline template creation being routed through the generic full-render external save path.

## Expected behavior

- Clicking the edit pencil should not recreate every day card.
- Clicking an inline `+` should add one row and open it for editing with less surrounding page movement.
- Server acknowledgements for unchanged visible data should not trigger a second rerender.
