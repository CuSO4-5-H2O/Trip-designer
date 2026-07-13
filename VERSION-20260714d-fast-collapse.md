# 2026-07-14 D - Fast day collapse

## Change

- Added `collapse-performance.js` to handle day-card expand/collapse without calling the app's full `render()` path.
- The script intercepts plain day-header clicks in the capture phase and toggles only the clicked card's DOM classes.
- Added a small max-height/opacity animation for smoother collapse and expand.
- Stored collapsed day IDs per room in localStorage so the visual state survives app re-renders.
- Bumped the page build marker to `render-20260714d`.

## Why

The main day-card click handler rebuilt the entire day list on every expand/collapse action. For long lists this caused visible jank and made the interface feel unsmooth.

## Validation

- Expand/collapse does not save data and does not trigger a full list re-render.
- Inline day field clicks, delete buttons, drag handles, and form controls are excluded from the fast toggle handler.
