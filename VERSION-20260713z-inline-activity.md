# render-20260713z - Inline Activity Template

## Changes

- Clicking the day `+` now adds a real activity template directly at the end of that day's activity list.
- The new activity is saved through the unified `TripPlanner.saveExternalLibrary()` store path, so it still syncs through the existing cloud room state.
- The quick-add modal is bypassed by the inline editor layer.
- Activity fields are editable in place:
  - Click time to edit time.
  - Click title to edit title.
  - Click location to edit location.
  - Click description to edit notes.
  - Click budget to edit amount and currency.
  - Click transport to edit transport type, origin, and destination.
- Missing location, description, and budget chips are added to activity rows so they can be edited without going to the side form.

## Data Safety

This release does not seed, delete, migrate, or rewrite existing itinerary lists. It only changes how new activities and activity fields are edited in the UI.

## Notes

The existing side detail form remains as a fallback, but the primary day-card `+` and field-click workflow now uses inline editing.
