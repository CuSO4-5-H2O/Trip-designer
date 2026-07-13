# VERSION 20260714h - Inline Editor Stability

## Summary

- Stabilized inline editing for activity fields such as place, note, transport, and budget.
- Place and note editors now stay in the same chip row style as transport and budget controls.
- Pressing Enter saves and closes the inline editor.
- Closing an editor temporarily freezes the current row height to avoid visible list jumps.

## Root Cause

- The old note editor used a textarea and some field editors changed the flex layout height while opening or closing.
- Save/close could immediately trigger a rerender while the hidden chip had not been restored, causing the activity row to collapse and then expand.

## Fixes

- Replaced note editing with a single-line pill input for consistent row height.
- Added one-save guards to prevent blur and Enter from saving twice.
- Restored hidden anchors before removing the editor.
- Added a short row-height lock during editor open/close and rerender handoff.
- Bumped the dynamically loaded inline editor script to `render-20260714h`.

## Verification Checklist

- Click `地点`: editor appears in the same row as `描述 / 添加交通 / 预算`.
- Press Enter after editing: editor closes and saves.
- Click `描述`, `添加交通`, and `预算`: controls keep consistent pill shape.
- Opening and closing an editor should not make the full activity list jump.
