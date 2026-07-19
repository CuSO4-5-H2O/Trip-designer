# VERSION 20260719g - Immediate Cloud Save and AI Exact-Day Apply

## Summary

This release fixes high-risk persistence issues found during production verification:

1. Structural itinerary changes could show as local pending even after the cloud had saved them.
2. Applying a 3-day AI quick plan into a blank list could resurrect the original blank placeholder day through server-side ID merge, resulting in 4 days instead of 3.
3. Committed inline edits could sync between same-browser tabs while still not being persisted to GitHub immediately, creating a refresh data-loss risk.

## Changes

### Immediate Cloud Save for Committed Changes

- Updated `sync-throttle.js`.
- These changes now bypass the 60-second debounce and persist immediately:
  - add/delete day
  - add/delete list
  - save/delete activity
  - reorder day/activity
  - inline template add activity
  - committed inline edits such as title, location, description, budget, and transport
  - AI add/apply actions
  - manual/retry/unload saves
- Ordinary live text-field typing can still be debounced to reduce UI churn.

### Saved Status Consistency

- Updated `mobile-sync-status-guard.js`.
- If the sync text is already a saved/synced state, the pending marker is cleared instead of forcing the UI back to `本地待同步 · 点击立即保存`.
- Updated `viewport-stability.js` so it loads the new mobile sync guard.

### AI Quick Plan Accuracy

- Updated `ai-quick-plan.js`.
- Applying an AI plan to a blank list now replaces all blank placeholder days.
- Replaced placeholder days are recorded in `library.deleted.days` tombstones, preventing the server merge layer from resurrecting them.
- Existing nonblank trips still append generated AI days instead of overwriting user content.

## Production Verification

Verified on Render production on 2026-07-19.

### Add Activity Save Test

1. Registered QA account `qa_save_ui_tqgb9l`.
2. Opened room `7DE6EED4` on Render production.
3. Clicked the empty-day add area in the rendered page.
4. Page rendered one activity row: `新事项`.
5. Sync label changed to `已保存到服务器` with class `sync-state connected`.
6. `/api/room-state?room=7DE6EED4` returned revision `3` and contained activity `新事项` with budget `{ amount: 0, currency: "CNY" }`.

### Shared Room Browser Test

1. Registered owner account `qa_share_owner_cp4jvd` and friend account `qa_share_friend_ntdbe3`.
2. Owner room was `4AD8AF43`.
3. Friend joined owner room as editor through `/api/auth/join-room`.
4. Opened two rendered pages for the same room `4AD8AF43`.
5. Owner page clicked the empty-day add area; friend page received the activity.
6. Friend page edited the activity title to `好友云端标题-ic6si` using the inline title editor and pressed Enter.
7. Owner page showed `好友云端标题-ic6si`.
8. `/api/room-state?room=4AD8AF43` returned revision `7` and contained title `好友云端标题-ic6si`, proving the edit reached GitHub-backed cloud state instead of only same-browser state.

### AI Quick Plan Exact-Day Test

1. Registered QA account `qa_ai_ui_2xwwx0`.
2. Opened room `EBB7204B` on Render production.
3. Entered text:

   `在内罗毕玩3天，第一天抵达内罗毕并入住酒店，第二天去基贝拉贫民窟和国家博物馆，第三天去长颈鹿中心和马赛市场，然后准备出发。`

4. AI preview returned 3 days from DeepSeek:
   - Day 1: `抵达内罗毕`, `入住酒店`
   - Day 2: `基贝拉贫民窟`, `国家博物馆`
   - Day 3: `长颈鹿中心`, `马赛市场`, `准备出发`
5. Clicked `应用到当前 list`.
6. Rendered page showed `3 / 30 天`, `7` activities, and sync state `已保存到云端`.
7. `/api/room-state?room=EBB7204B` returned exactly 3 days and the same 7 activities. No extra blank placeholder day remained.

### Syntax Check

Downloaded these deployed JS files from Render and ran `node --check` successfully:

- `sync-throttle.js`
- `mobile-sync-status-guard.js`
- `viewport-stability.js`
- `ai-quick-plan.js`
- `account-home-link.js`
- `auth-bootstrap.js`

Result: `syntax-ok`.

## Smoke Test Note

The repository main tree was previously inspected and contained no `.github/workflows/*` files, so recurring `smoketest1` emails are not emitted by GitHub Actions in this repository. They are likely from Render or an external monitor/test service.
