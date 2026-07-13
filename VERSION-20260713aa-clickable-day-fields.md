# render-20260713aa - Clickable Day and Activity Fields

## Changes

- Day card fields are now clickable:
  - City chip edits the day city/location inline.
  - Stay chip edits the stay/accommodation inline.
  - Budget chip opens the budget editor for the last activity of the day; if the day has no activities, it first creates a template activity because budgets belong to activities.
  - The empty `还没有事项` area creates a new inline activity template.
- Activity editing is more forceful and no longer lets old click handlers steal the action:
  - Uses `pointerdown` capture plus `click` capture.
  - The edit pencil opens inline title editing.
  - `添加交通` opens inline transport editing.
  - Existing transport chips open inline transport editing.
  - Time, title, place, note, budget, and transport fields are all edited in place.
- The inline editor reclaims `TripPlannerQuickAdd` periodically so older hotfix scripts cannot switch the `+` action back to the modal.

## Data Safety

This release does not seed, delete, or migrate itinerary data. It only changes clickable editing behavior and still saves through the unified `TripPlanner.saveExternalLibrary()` path.
