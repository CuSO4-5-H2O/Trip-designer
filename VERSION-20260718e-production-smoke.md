# VERSION 20260718e - Manual production smoke test

## What changed

- Added `production-api-smoke-test.js`.
- Added npm script `test:production`.
- Added manual-only GitHub Actions workflow `.github/workflows/production-api-smoke.yml`.

## What the production smoke test verifies

The script targets `https://tripdesigner.onrender.com` by default, or `TRIP_DESIGNER_BASE_URL` when provided.

It verifies:

- GitHub-backed cloud storage is active, hydrated, and cloud-only.
- Account registration creates distinct default rooms for different accounts.
- Login returns the same default room.
- A friend account can join the owner's room as editor.
- Owner and friend writes to the same room are both preserved.
- DeepSeek quick planning parses the Nairobi 3-day sample as exactly 3 days.
- The AI-generated plan can be saved to a cloud room and read back as 3 days.
- Concurrent stale writes merge activities instead of creating conflict backups.
- Deletion tombstones prevent stale clients from resurrecting deleted activities.

## How to run manually

Local command:

```bash
npm run test:production
```

Optional target override:

```bash
TRIP_DESIGNER_BASE_URL=https://tripdesigner.onrender.com npm run test:production
```

GitHub Actions:

- Open Actions.
- Select `Production API smoke test`.
- Click `Run workflow`.

The workflow is `workflow_dispatch` only and does not run on push, so it will not recreate the previous smoke-test email spam.

## Validation

- `production-api-smoke-test.js` syntax checked successfully with Node's VM parser.
- Latest GitHub Actions list still showed no new push-triggered smoke runs after adding this workflow.
