# 2026-07-18f Actions Smoke Stop

## What changed

- Removed `.github/workflows/smoke-test.yml`.
- Removed `.github/workflows/websocket-smoke-test.yml`.
- Removed `.github/workflows/production-api-smoke.yml`.

## Why

GitHub Actions smoke workflows were repeatedly notifying during active repair work. To stop further smoke-test emails immediately, the repository now has no workflow files under `.github/workflows`.

## Verification

- GitHub tree check returned an empty `.github/workflows` file list.
- Recent Actions runs remained the previous historical smoke runs; deleting the workflow files did not create a new run.

## Notes

- Render deployment is unaffected.
- If automated checks are needed later, recreate them only after the editor is stable, and keep them manual or scheduled deliberately.
