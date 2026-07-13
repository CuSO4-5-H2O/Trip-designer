# 2026-07-14 A - Inline editor stability

## Change

- Fixed the inline restore guard so hidden chips are restored only after their adjacent temporary editor has closed.
- Added a MutationObserver-based safety pass to restore hidden anchors immediately after an editor node is removed.
- Bumped the page build marker and `inline-polish.js` cache key to `render-20260714a`.

## Why

The previous guard could restore the original chip while the temporary input was still open. This made the activity card briefly show both the original chip and the editor, causing visual duplication and layout jitter.

## Validation

- The guard now checks for an adjacent `.inline-activity-input`, `.inline-budget-editor`, `.inline-transport-editor`, or `.inline-day-input` before restoring the original element.
- The change is limited to inline editing layout stability and does not mutate trip data.
