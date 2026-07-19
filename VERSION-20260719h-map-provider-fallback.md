# VERSION 20260719h - Map Provider Fallback

## Summary

- Fixed overseas map routing failures where AMap was selected by default and returned zero located points for non-China itineraries.
- Added provider comparison on the server so `auto` mode chooses the provider that locates the most itinerary points.
- Kept user-selectable map providers in the UI: Auto, AMap, and Google.

## Changes

- `map-runtime.js`
  - `defaultProvider` now prefers Google when a Google Maps key is configured, with AMap still available as an explicit option.
  - `/api/map/plan` now supports automatic provider fallback and records provider attempts in the response.
  - The chosen plan is the provider result with the most located points, then the most route segments, then Google as tie-breaker.
  - Failed geocoding points are retained as unlocated points instead of aborting the whole route.

- `map-providers.css`
  - Styled the actual `.map-provider-choice` selector class used by the frontend.
  - Mobile layout now treats the map provider selector and map toolbar buttons consistently.

- `index.html`
  - Bumped build marker and map asset URLs to `render-20260719h`.

## Verification

- GitHub main branch contains the new `providerOrder`, `buildPlanForProvider`, and `chooseBestPlan` map fallback logic.
- Render production deployed `render-20260719h` and serves `map-providers-lite.js?v=render-20260719h`.
- Production `/api/map/plan` test with:
  - `Nairobi Jomo Kenyatta International Airport`
  - `Nairobi National Museum`
  - `Giraffe Centre Nairobi`
- Result:
  - provider: `google`
  - located: `3 / 3`
  - route segments: `2`
  - summary distance: `35529 m`
  - summary duration: `3232 s`
- Browser page check for `?room=EBB7204B`:
  - title: `行程编辑器`
  - build: `render-20260719h`
  - map provider selector present
  - options: Auto, AMap, Google
  - calculate route button present
  - no console errors or warnings during load

## Notes

- `smoketest1` is not a GitHub Actions workflow in this repository. `.github/workflows` is absent, workflow runs for the latest main commit are zero, and local smoke scripts are disabled stubs. If `smoketest1` emails continue, the trigger is likely a Render dashboard monitor, cron job, uptime check, or another external integration.
