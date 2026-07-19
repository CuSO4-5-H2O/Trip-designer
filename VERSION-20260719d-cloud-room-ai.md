# VERSION 20260719d - Cloud Room Initialization and Quick Plan Fallback

## Summary

This release strengthens the account-room cloud persistence path and the AI quick-plan parser.
It is focused on preventing account rooms from existing only in account metadata while their room state has not yet been initialized in GitHub room data.

## Changes

### Account Room Persistence

- Updated `auth-runtime.js`.
- After account registration, the default owner room now calls the room-state persistence path.
- After creating a room, the new owner room now calls the room-state persistence path.
- After joining a shared room, the joined room now calls the room-state persistence path.
- The room initialization path uses `/api/room-state` GET + POST so existing server merge and GitHub save behavior remain the single room-state write mechanism.
- Existing room/list/day/activity data is not migrated, deleted, or overwritten.

### Quick Plan Parsing

- Updated `ai-plan-runtime.js`.
- DeepSeek remains the primary natural-language parser when `deepseek` or `DEEPSEEK_API_KEY` is configured.
- Added deterministic fallback parsing when DeepSeek is missing, unavailable, times out, or returns invalid JSON.
- The fallback parser enforces explicit day counts such as `内罗毕玩3天`.
- The fallback parser keeps `第一天` / `第二天` / `第三天` activities attached to the matching day.
- DeepSeek prompts now include a backend rule-based draft so the model is less likely to move day-specific activities to the wrong day.
- If DeepSeek returns empty activities for a day, the backend fills that day from the deterministic parser instead of returning an empty or inaccurate day.

## Data Safety

- No existing account data is deleted.
- No existing room data is deleted.
- No local or private browser-only data source is introduced.
- Room state still goes through the existing GitHub-backed `/api/room-state` merge and save path.

## Production Verification

Verified on Render production after deployment:

1. `/api/auth/status` exposes the new room initialization status fields: `lastRoomInitAt` and `lastRoomInitError`.
2. Registered QA account `qa_roominit_lvhhpk`.
3. Registration returned default room `595BC23F`.
4. `/api/room-state?room=595BC23F` returned revision `1` and one initialized list.
5. GitHub Contents API for `trip-data/rooms.json` showed `595BC23F` persisted with revision `1`.
6. `/api/ai/quick-plan` was tested with:

   `在内罗毕玩3天，第一天抵达内罗毕并入住酒店，第二天去基贝拉贫民窟和国家博物馆，第三天去长颈鹿中心和马赛市场，然后准备出发。`

7. The quick-plan API returned `ok: true`, source `deepseek`, exactly 3 days, and these parsed activities:
   - Day 1: `抵达内罗毕`, `入住酒店`
   - Day 2: `基贝拉贫民窟`, `国家博物馆`
   - Day 3: `长颈鹿中心`, `马赛市场`, `出发`

## Remaining Verification Target

- Continue full rendered browser validation of applying AI-generated days into the visible itinerary list once the browser automation surface is stable enough to perform clicks without storage-context limitations.
- Continue multi-device live editing validation for the same logged-in account and invited room.
