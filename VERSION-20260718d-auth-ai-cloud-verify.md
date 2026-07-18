# VERSION 20260718d - Auth, AI quick plan, and cloud data verification

## What changed

- `ai-quick-plan.js` no longer installs itself through a long-lived `document.body` MutationObserver.
- The AI panel now uses bounded retries until `.ai-panel` exists, reducing page-wide observer churn while preserving the quick-plan UI.

## Production verification

### GitHub cloud storage

- `/api/cloud-storage-status` returned backend `github`, cloudOnly `true`, hydrated `true`, and empty lastError.

### Account and shared room flow

- Registered owner account with default room `3EE355B7`.
- Registered friend account with default room `17ECC3B1`.
- The two default rooms were distinct.
- Friend joined owner room `3EE355B7` as editor.
- Owner wrote activity `房主事项` to room `3EE355B7`.
- Friend wrote activity `好友事项` to the same room.
- Final room state contained both activities and storage backend `github`.

### DeepSeek quick plan

Input:

```text
在内罗毕玩3天，第一天抵达并逛市区，第二天去基贝拉贫民窟和博物馆，第三天去长颈鹿中心后出发去马赛马拉
```

Production `/api/ai/quick-plan` returned expectedDays `3` and planDays `3`.

Returned activities:

- Day 1: `抵达内罗毕`, `逛市区`
- Day 2: `参观基贝拉贫民窟`, `参观博物馆`
- Day 3: `去长颈鹿中心`, `出发去马赛马拉`

The generated plan was then saved to a temporary cloud room and read back with exactly 3 days and the same activity titles.

## Validation notes

- GitHub Actions smoke workflows remain manual; no new automatic smoke runs were observed after the latest commits.
- Existing user itinerary data files were not edited directly.
