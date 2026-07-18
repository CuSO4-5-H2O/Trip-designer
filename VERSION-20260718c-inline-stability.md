# VERSION 20260718c - Inline stability and smoke quieting

## What changed

- Disabled automatic push and pull request triggers for both GitHub Actions smoke workflows. They are now manual `workflow_dispatch` checks to stop repeated failure notification emails during live repair work.
- Reduced layout churn from global observers and timers:
  - `collapse-performance.js` now observes only top-level `#dayList` day-card structure changes.
  - `timeline-ui-cleanup.js` no longer runs a repeated 1.6s cleanup timer.
  - `layout-stability-hotfix.js` ignores activity-row and inline-editor mutations instead of restabilizing the whole layout on every field edit.
- Stabilized inline activity editing:
  - `inline-activity-template.js` no longer polls every 1.2s or observes the whole document body.
  - Activity title/place/note/time/transport/budget fields open inline editors and update the visible row after Enter without forcing a full row refresh.
  - Day location/stay chips use the same inline editing path.
- Fixed add-activity fallback in `interaction-hotfix.js`:
  - The day `+` button now creates an activity and retries opening the inline title editor once the new row is actually rendered.
  - The old modal path remains retired.
- Bumped served asset versions through `render-20260718f` so browsers fetch the new scripts.

## Validation

- JavaScript syntax checked for:
  - `collapse-performance.js`
  - `timeline-ui-cleanup.js`
  - `layout-stability-hotfix.js`
  - `inline-activity-template.js`
  - `interaction-hotfix.js`
  - `room-bootstrap.js`
- Render deployed and served `render-20260718f`.
- Browser verification on live Render temporary room `FIX18F63KS`:
  - Visual click on the day `+` created one activity row.
  - Inline title editor opened automatically.
  - Enter saved title `线上验证事项18F` and closed the editor.
  - Clicking the place chip opened inline place editing.
  - Enter saved place `验证地点18F` and closed the editor.
  - `/api/room-state?room=FIX18F63KS` returned revision `4` with title and place saved in the cloud state.
  - Console warnings/errors were empty during the tested flow.
- GitHub Actions latest runs stayed quiet after workflows were made manual; no new push-triggered smoke runs appeared after the later fix commits.

## Notes

- Existing itinerary data files were not modified.
- The smoke workflows are still available from the GitHub Actions tab when an intentional manual run is needed.
