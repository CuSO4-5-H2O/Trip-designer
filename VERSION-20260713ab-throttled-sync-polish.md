# render-20260713ab - Throttled Sync and Inline Polish

## Changes

- Added `sync-throttle.js` before app startup.
- High-frequency itinerary state writes are now queued locally and sent to the server at most once every 60 seconds.
- The sync status pill is now a manual save control: click it to push queued changes to the server immediately.
- When leaving the page, queued changes are flushed with `sendBeacon` or `fetch(..., keepalive: true)` where supported.
- Local edits still update the current browser immediately through the existing store and localStorage path.
- Added `inline-polish.js` to make inline activity templates cleaner:
  - tighter grid layout,
  - less noisy chips,
  - smaller selection outline,
  - cleaner mobile layout.

## Data Safety

This release does not seed, delete, or migrate itinerary data. It changes save timing and presentation only. Existing room data remains untouched.

## User Behavior

- Edit fields freely without waiting on the server after every click.
- Click the top sync status pill when you want to save to cloud immediately.
- Otherwise the latest queued state is pushed automatically after about 60 seconds.
