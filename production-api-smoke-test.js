"use strict";

const crypto = require("crypto");

const baseUrl = (process.env.TRIP_DESIGNER_BASE_URL || "https://tripdesigner.onrender.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.TRIP_DESIGNER_SMOKE_TIMEOUT_MS || 90000);
const startedAt = Date.now();

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

async function main() {
  const report = {};
  report.storage = await verifyStorage();
  report.accounts = await verifyAccountsAndSharedRoom();
  report.ai = await verifyAiQuickPlan();
  report.cloud = await verifyCloudSaveRead(report.ai.plan);
  report.merge = await verifyMergeAndTombstone();
  console.log(JSON.stringify({ ok: true, baseUrl, report }, null, 2));
}

async function verifyStorage() {
  const payload = await requestJson("/api/cloud-storage-status");
  const storage = payload.storage || {};
  assert(storage.backend === "github", `expected github backend, got ${storage.backend}`);
  assert(storage.cloudOnly === true, "expected cloudOnly storage");
  assert(storage.hydrated === true, "expected hydrated GitHub storage");
  assert(!storage.lastError, `storage lastError should be empty, got ${storage.lastError}`);
  return pick(storage, ["backend", "cloudOnly", "hydrated", "repo", "branch", "path"]);
}

async function verifyAccountsAndSharedRoom() {
  const suffix = Date.now().toString(36).slice(-7);
  const password = `Pass${crypto.randomBytes(5).toString("hex")}`;
  const owner = `owner${suffix}`;
  const friend = `friend${suffix}`;

  const ownerSession = await requestJson("/api/auth/register", postJson({ username: owner, password }));
  const friendSession = await requestJson("/api/auth/register", postJson({ username: friend, password }));
  assert(ownerSession.ok && ownerSession.token, "owner registration failed");
  assert(friendSession.ok && friendSession.token, "friend registration failed");
  const ownerRoom = ownerSession.account?.defaultRoomId;
  const friendRoom = friendSession.account?.defaultRoomId;
  assert(ownerRoom && friendRoom && ownerRoom !== friendRoom, "accounts must receive distinct default rooms");

  const ownerLogin = await requestJson("/api/auth/login", postJson({ username: owner, password }));
  assert(ownerLogin.ok && ownerLogin.account?.defaultRoomId === ownerRoom, "owner login did not return default room");

  const joined = await requestJson("/api/auth/join-room", postJson({ roomId: ownerRoom }, friendSession.token));
  const friendRooms = joined.account?.rooms || [];
  assert(friendRooms.some((room) => room.roomId === ownerRoom && room.role === "editor"), "friend did not join owner room as editor");

  const ownerState = makeLibrary("共享room验证", [{ location: "共享验证", activities: [{ title: "房主事项", place: "owner" }] }]);
  const ownerSave = await requestJson(`/api/room-state?room=${encodeURIComponent(ownerRoom)}`, postJson({ clientId: "smoke-owner", roomId: ownerRoom, state: ownerState, reason: "smoke-owner", baseRevision: 0 }));
  assert(ownerSave.ok, "owner room save failed");

  const friendState = clone(ownerSave.state || ownerState);
  addActivity(friendState, "好友事项", "friend");
  const friendSave = await requestJson(`/api/room-state?room=${encodeURIComponent(ownerRoom)}`, postJson({ clientId: "smoke-friend", roomId: ownerRoom, state: friendState, reason: "smoke-friend", baseRevision: ownerSave.revision }));
  assert(friendSave.ok, "friend room save failed");

  await sleep(1200);
  const finalRoom = await requestJson(`/api/room-state?room=${encodeURIComponent(ownerRoom)}`);
  const titles = finalRoom.state?.lists?.[0]?.trip?.days?.[0]?.activities?.map((activity) => activity.title) || [];
  assert(titles.includes("房主事项") && titles.includes("好友事项"), `shared room missing edits: ${titles.join(",")}`);
  assert(finalRoom.storage?.backend === "github", "shared room did not report github backend");

  return { ownerRoom, friendRoom, friendRooms: friendRooms.map((room) => `${room.roomId}:${room.role}`), finalTitles: titles };
}

async function verifyAiQuickPlan() {
  const text = "在内罗毕玩3天，第一天抵达并逛市区，第二天去基贝拉贫民窟和博物馆，第三天去长颈鹿中心后出发去马赛马拉";
  const payload = await requestJson("/api/ai/quick-plan", postJson({ text, trip: { tripTitle: "新行程单", originCity: "上海" } }));
  assert(payload.ok, `AI quick plan failed: ${payload.error || payload.detail || "unknown"}`);
  const plan = payload.plan || {};
  assert(payload.hints?.expectedDays === 3, `expectedDays should be 3, got ${payload.hints?.expectedDays}`);
  assert(Array.isArray(plan.days) && plan.days.length === 3, `AI plan should contain exactly 3 days, got ${plan.days?.length}`);
  const titles = plan.days.map((day) => (day.activities || []).map((activity) => activity.title));
  assert(titles[0]?.length && titles[1]?.length && titles[2]?.length, "each AI day should contain activities for the sample text");
  return { expectedDays: payload.hints.expectedDays, days: plan.days.length, titles, plan };
}

async function verifyCloudSaveRead(plan) {
  const roomId = `AICLOUD${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const library = makeLibraryFromPlan(plan, "内罗毕AI三天验证");
  const saved = await requestJson(`/api/room-state?room=${encodeURIComponent(roomId)}`, postJson({ clientId: "smoke-ai-apply", roomId, state: library, reason: "smoke-ai-apply", baseRevision: 0 }));
  assert(saved.ok, "saving AI plan to cloud room failed");
  await sleep(1200);
  const read = await requestJson(`/api/room-state?room=${encodeURIComponent(roomId)}`);
  const days = read.state?.lists?.[0]?.trip?.days || [];
  assert(days.length === 3, `cloud AI room should read back 3 days, got ${days.length}`);
  assert(read.storage?.backend === "github", "AI cloud read did not report github backend");
  return { roomId, revision: read.revision, days: days.length, titles: days.map((day) => day.activities.map((activity) => activity.title)) };
}

async function verifyMergeAndTombstone() {
  const mergeRoom = `MERGE${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const base = makeLibrary("合并基线", [{ location: "合并", activities: [] }]);
  const init = await requestJson(`/api/room-state?room=${encodeURIComponent(mergeRoom)}`, postJson({ clientId: "merge-init", roomId: mergeRoom, state: base, reason: "merge-init", baseRevision: 0 }));
  assert(init.ok, "merge init save failed");
  const clientA = clone(base);
  const clientB = clone(base);
  addActivity(clientA, "设备A事项", "A");
  await sleep(5);
  addActivity(clientB, "设备B事项", "B");
  await requestJson(`/api/room-state?room=${encodeURIComponent(mergeRoom)}`, postJson({ clientId: "device-a", roomId: mergeRoom, state: clientA, reason: "device-a", baseRevision: init.revision }));
  await requestJson(`/api/room-state?room=${encodeURIComponent(mergeRoom)}`, postJson({ clientId: "device-b", roomId: mergeRoom, state: clientB, reason: "device-b", baseRevision: init.revision }));
  await sleep(1200);
  const merged = await requestJson(`/api/room-state?room=${encodeURIComponent(mergeRoom)}`);
  const titles = merged.state?.lists?.[0]?.trip?.days?.[0]?.activities?.map((activity) => activity.title).sort() || [];
  assert(titles.includes("设备A事项") && titles.includes("设备B事项"), `merge lost an activity: ${titles.join(",")}`);
  const conflictBackups = (merged.state?.lists || []).filter((list) => /^冲突备份/.test(String(list.name || ""))).length;
  assert(conflictBackups === 0, `unexpected conflict backups: ${conflictBackups}`);

  const tombRoom = `TOMB${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const tombBase = makeLibrary("待删除事项", [{ location: "墓碑", activities: [{ title: "待删除事项", place: "墓碑" }] }]);
  const tombInit = await requestJson(`/api/room-state?room=${encodeURIComponent(tombRoom)}`, postJson({ clientId: "tomb-init", roomId: tombRoom, state: tombBase, reason: "tomb-init", baseRevision: 0 }));
  const deleted = clone(tombBase);
  const removed = deleted.lists[0].trip.days[0].activities.shift();
  const stamp = Date.now();
  deleted.deleted.activities[removed.id] = stamp;
  touchLibrary(deleted, stamp);
  await requestJson(`/api/room-state?room=${encodeURIComponent(tombRoom)}`, postJson({ clientId: "delete-client", roomId: tombRoom, state: deleted, reason: "delete", baseRevision: tombInit.revision }));
  await requestJson(`/api/room-state?room=${encodeURIComponent(tombRoom)}`, postJson({ clientId: "stale-client", roomId: tombRoom, state: tombBase, reason: "stale", baseRevision: tombInit.revision }));
  await sleep(1200);
  const tombRead = await requestJson(`/api/room-state?room=${encodeURIComponent(tombRoom)}`);
  const resurrected = tombRead.state?.lists?.[0]?.trip?.days?.[0]?.activities || [];
  assert(resurrected.length === 0, `deleted activity resurrected: ${resurrected.map((activity) => activity.title).join(",")}`);

  return { mergeRoom, mergedTitles: titles, conflictBackups, tombRoom, finalTombstoneActivities: resurrected.length };
}

function makeLibrary(title, daySpecs) {
  const stamp = Date.now();
  const listId = crypto.randomUUID();
  const days = daySpecs.map((day) => {
    const dayId = crypto.randomUUID();
    return {
      id: dayId,
      location: day.location || "",
      stay: day.stay || "",
      updatedAt: stamp,
      orderUpdatedAt: stamp,
      activities: (day.activities || []).map((activity) => makeActivity(activity, stamp)),
    };
  });
  return {
    version: 2,
    activeListId: listId,
    members: [],
    deleted: { lists: {}, days: {}, activities: {}, members: {} },
    updatedAt: stamp,
    lists: [{
      id: listId,
      name: title,
      createdAt: stamp,
      updatedAt: stamp,
      trip: {
        tripTitle: title,
        startDate: "2026-07-18",
        originCity: "",
        selectedDayId: days[0].id,
        dayLimit: Math.max(30, days.length),
        updatedAt: stamp,
        orderUpdatedAt: stamp,
        budget: { currency: "CNY", items: {}, limit: 0, updatedAt: stamp },
        days,
      },
    }],
  };
}

function makeLibraryFromPlan(plan, title) {
  return makeLibrary(title, (plan.days || []).map((day) => ({
    location: day.location || "",
    stay: day.stay || "",
    activities: (day.activities || []).map((activity) => ({
      title: activity.title || "待安排事项",
      place: activity.place || "",
      note: activity.note || "",
      time: activity.time || "",
      budget: activity.budget || null,
      transport: activity.transport || null,
    })),
  })));
}

function makeActivity(activity, stamp) {
  return {
    id: crypto.randomUUID(),
    time: activity.time || "",
    title: activity.title || "未命名事项",
    place: activity.place || "",
    note: activity.note || "",
    tags: [],
    done: false,
    budget: activity.budget || null,
    transport: activity.transport || null,
    updatedAt: stamp,
  };
}

function addActivity(library, title, place) {
  const stamp = Date.now();
  const day = library.lists[0].trip.days[0];
  day.activities.push(makeActivity({ title, place }, stamp));
  touchLibrary(library, stamp);
}

function touchLibrary(library, stamp) {
  const list = library.lists[0];
  const trip = list.trip;
  const day = trip.days[0];
  day.updatedAt = stamp;
  day.orderUpdatedAt = stamp;
  trip.updatedAt = stamp;
  trip.orderUpdatedAt = stamp;
  list.updatedAt = stamp;
  library.updatedAt = stamp;
}

async function requestJson(path, options = {}) {
  if (Date.now() - startedAt > timeoutMs) throw new Error(`smoke test exceeded ${timeoutMs}ms`);
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store", ...options });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${path} failed ${response.status}: ${payload.error || payload.detail || text.slice(0, 200)}`);
  return payload;
}

function postJson(body, token = "") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pick(object, keys) {
  return Object.fromEntries(keys.map((key) => [key, object[key]]));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
