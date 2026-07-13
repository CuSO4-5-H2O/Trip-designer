# 2026-07-14 B - Normalized activity chip alignment

## Change

- Unified the activity card chip controls for place, note, transport, and budget.
- Forced the chip controls to use the same height, radius, padding, line-height, transparent border reserve, and inline-flex alignment.
- Tightened the activity card title/chip spacing so chips align under the title consistently.
- Bumped the page build marker and `inline-polish.js` cache key to `render-20260714b`.

## Why

The chips came from different parts of the UI and inherited different button/link styles. This made them look uneven in height, radius, and vertical position.

## Validation

- The change is CSS-only for activity chip presentation.
- It does not mutate trip data or sync state.
