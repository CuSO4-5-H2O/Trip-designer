const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { handleMapRuntime } = require("./map-runtime");
const { createGithubRoomStore } = require("./github-room-store");

const root = __dirname;
const port = Number(process.env.PORT || 4177);
const renderDiskDir = "/var/data";
const dataDir = process.env.DATA_DIR || (fs.existsSync(renderDiskDir) ? renderDiskDir : path.join(root, "data"));
const dataFile = process.env.DATA_FILE || path.join(dataDir, "rooms.json");
const allowDiskStorage = process.env.ALLOW_DISK_STORAGE === "true";
const githubStore = createGithubRoomStore();
const rooms = new Map();
const sockets = new Map();
const geocodeCache = new Map();
let saveTimer = null;
let githubSaveTimer = null;
let authRuntime = null;
let authLoadPromise = null;
let quickPlanHandler = null;
let storageStatus = {
  backend: githubStore.enabled ? "github" : (allowDiskStorage ? "disk" : "unconfigured"),
  tokenConfigured: githubStore.enabled,
  repo: githubStore.status.repo,
  branch: githubStore.status.branch,
  path: githubStore.status.path,
  dataFile: allowDiskStorage ? dataFile : "disabled",
  allowDiskStorage,
  cloudOnly: !allowDiskStorage,
  hydrated: false,
  lastError: githubStore.status.lastError || (allowDiskStorage ? "" : "GITHUB_DATA_TOKEN not configured"),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

main().catch((error) => {
  console.warn(`Startup failed: ${error.message}`);
  if (allowDiskStorage) loadRoomsFromDisk();
  startServer();
});

async function main() {
  await loadRooms();
  startServer();
}

function startServer() {
  const server = http.createServer(handleRequest);
  server.on("upgrade", handleUpgrade);
  server.listen(port, () => {
    console.log(`Trip planner is running at http://localhost:${port}`);
    console.log(`Room storage backend: ${storageStatus.backend}`);
    if (allowDiskStorage) console.log(`Room data file: ${dataFile}`);
  });
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === "/api/cloud-storage-status") {
    sendJson(res, 200, { ok: true, storage: getCloudStorageStatus() });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/auth/")) {
    await handleAuthRequest(req, res, requestUrl);
    return;
  }

  if (await handleMapRuntime(req, res, requestUrl.pathname)) return;

  if (requestUrl.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, aiConfigured: Boolean(process.env.deepseek || process.env.DEEPSEEK_API_KEY), storage: getCloudStorageStatus() });
    return;
  }
  if (requestUrl.pathname === "/api/geocode") return handleGeocode(requestUrl, res);
  if (requestUrl.pathname === "/api/ai/recommend") return handleAiRecommend(req, res);
  if (requestUrl.pathname === "/api/ai/quick-plan") return handleAiQuickPlan(req, res, requestUrl);
  if (requestUrl.pathname === "/api/room-state") return handleRoomState(req, requestUrl, res);
  if (requestUrl.pathname === "/sync") {
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("WebSocket endpoint");
    return;
  }

  const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const filePath = path.normalize(path.join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

function handleUpgrade(req, socket) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname !== "/sync") return socket.destroy();

  const key = req.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"));

  const roomId = requestUrl.searchParams.get("room") || "LOCAL";
  const peer = { socket, roomId, clientId: crypto.randomUUID(), name: "同行者" };
  sockets.set(socket, peer);
  ensureRoom(roomId).peers.add(socket);

  socket.on("data", (chunk) => {
    for (const message of decodeFrames(chunk)) handleMessage(socket, message);
  });
  socket.on("close", () => removePeer(socket));
  socket.on("error", () => removePeer(socket));
}

async function loadRooms() {
  if (githubStore.enabled) {
    try {
      const payload = await githubStore.load();
      if (payload?.rooms && Object.keys(payload.rooms).length) applyRoomsPayload(payload);
      storageStatus.hydrated = true;
      storageStatus.lastError = "";
      return;
    } catch (error) {
      storageStatus.hydrated = false;
      storageStatus.lastError = error.message;
      console.warn(`Could not load GitHub room data: ${error.message}`);
      return;
    }
  }

  if (allowDiskStorage) {
    storageStatus.hydrated = loadRoomsFromDisk();
    storageStatus.lastError = storageStatus.hydrated ? "" : "disk storage empty";
    return;
  }

  storageStatus.hydrated = false;
  storageStatus.lastError = "GITHUB_DATA_TOKEN not configured; disk fallback disabled";
}

function loadRoomsFromDisk() {
  try {
    if (!fs.existsSync(dataFile)) return false;
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    applyRoomsPayload(saved);
    console.log(`Loaded ${rooms.size} room(s) from disk`);
    return true;
  } catch (error) {
    console.warn(`Could not load room data: ${error.message}`);
    return false;
  }
}

function createEmptyRoomState(roomId) {
  const stamp = Date.now();
  const day = { id: crypto.randomUUID(), location: "", stay: "", activities: [], updatedAt: stamp, orderUpdatedAt: stamp };
  const trip = {
    tripTitle: "新行程单",
    startDate: new Date(stamp).toISOString().slice(0, 10),
    originCity: "",
    selectedDayId: day.id,
    dayLimit: 30,
    days: [day],
    budget: { currency: "CNY", items: {}, limit: 0, updatedAt: stamp },
    updatedAt: stamp,
    orderUpdatedAt: stamp,
  };
  const list = { id: crypto.randomUUID(), name: "新行程单", trip, createdAt: stamp, updatedAt: stamp };
  return normalizeLibrary({ version: 2, activeListId: list.id, members: [], lists: [list], deleted: normalizeDeleted(), updatedAt: stamp, roomId });
}

function applyRoomsPayload(saved = {}) {
  rooms.clear();
  for (const [roomId, value] of Object.entries(saved.rooms || {})) {
    const isEnvelope = value && typeof value === "object" && "state" in value;
    rooms.set(roomId, {
      state: normalizeLibrary(isEnvelope ? value.state : value),
      revision: isEnvelope && Number.isFinite(value.revision) ? value.revision : 1,
      peers: new Set(),
    });
  }
}

function buildRoomsPayload() {
  const persistedRooms = {};
  for (const [roomId, room] of rooms.entries()) {
    if (room.state) persistedRooms[roomId] = { revision: room.revision || 0, state: room.state };
  }
  return { version: 2, savedAt: new Date().toISOString(), rooms: persistedRooms };
}

function writeRoomsPayloadToDisk(payload) {
  if (!allowDiskStorage) return;
  fs.mkdirSync(dataDir, { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
  fs.renameSync(tempFile, dataFile);
}

function scheduleSave(reason = "state") {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveRooms(reason), 250);
}

function canPersistWrites() {
  if (allowDiskStorage) return true;
  return Boolean(githubStore.enabled && storageStatus.hydrated);
}

function saveRooms(reason = "state") {
  const payload = buildRoomsPayload();
  if (githubStore.enabled) {
    scheduleGithubSave(payload, reason);
    return;
  }
  if (allowDiskStorage) {
    try {
      writeRoomsPayloadToDisk(payload);
    } catch (error) {
      console.warn(`Could not save room data: ${error.message}`);
    }
    return;
  }
  storageStatus.lastError = "Write rejected: GitHub data storage is not configured";
}

function scheduleGithubSave(payload, reason) {
  if (!githubStore.enabled) return;
  clearTimeout(githubSaveTimer);
  githubSaveTimer = setTimeout(async () => {
    try {
      await githubStore.save(payload);
      storageStatus.lastError = "";
      storageStatus.lastGithubSaveAt = new Date().toISOString();
      console.log(`Saved room data to GitHub (${reason})`);
    } catch (error) {
      storageStatus.lastError = error.message;
      console.warn(`Could not save room data to GitHub: ${error.message}`);
    }
  }, 700);
}

function getCloudStorageStatus() {
  return {
    ...storageStatus,
    ...githubStore.status,
    backend: githubStore.enabled ? "github" : (allowDiskStorage ? "disk" : "unconfigured"),
    tokenConfigured: githubStore.enabled,
    dataFile: allowDiskStorage ? dataFile : "disabled",
    allowDiskStorage,
    cloudOnly: !allowDiskStorage,
  };
}

async function handleAuthRequest(req, res, requestUrl) {
  try {
    const runtime = await getAuthRuntime();
    await runtime.handle(req, res, requestUrl);
  } catch (error) {
    sendJson(res, 503, { ok: false, error: "账号服务暂时不可用", detail: error.message });
  }
}

async function getAuthRuntime() {
  if (!authRuntime) {
    const { createAuthRuntime } = require("./auth-runtime");
    authRuntime = createAuthRuntime();
  }
  if (!authLoadPromise) {
    authLoadPromise = authRuntime.load().catch((error) => {
      authLoadPromise = null;
      throw error;
    });
  }
  await authLoadPromise;
  return authRuntime;
}

async function handleAiQuickPlan(req, res, requestUrl) {
  try {
    if (!quickPlanHandler) quickPlanHandler = require("./ai-plan-runtime").handleAiPlan;
    await quickPlanHandler(req, res, requestUrl);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: "AI 快速行程服务暂时不可用", detail: error.message });
  }
}

function handleMessage(socket, raw) {
  let message;
  try { message = JSON.parse(raw); } catch { return; }
  const peer = sockets.get(socket);
  if (!peer) return;
  peer.clientId = message.clientId || peer.clientId;
  peer.name = message.name || peer.name;
  const room = ensureRoom(peer.roomId);

  if (message.type === "join") {
    removeDuplicateClientPeers(peer.roomId, peer.clientId, socket);
    send(socket, { type: "state", clientId: "server", state: room.state, revision: room.revision || 0 });
    broadcastMembers(peer.roomId);
    return;
  }

  if (message.type === "state" && message.state) {
    if (!canPersistWrites()) {
      send(socket, { type: "error", clientId: "server", error: storageStatus.lastError || "GitHub data storage is not ready" });
      return;
    }
    room.state = adoptOrMergeLibrary(room, message.state);
    room.revision = (room.revision || 0) + 1;
    scheduleSave(message.reason || "state");
    send(socket, { type: "ack", clientId: "server", state: room.state, revision: room.revision, reason: message.reason || "state" });
    broadcast(peer.roomId, { type: "state", clientId: message.clientId || "remote", roomId: peer.roomId, state: room.state, reason: message.reason || "state", revision: room.revision }, socket);
    return;
  }

  if (message.type === "presence") {
    broadcast(peer.roomId, message, null);
    broadcastMembers(peer.roomId);
    return;
  }
  if (message.type === "leave") removePeer(socket);
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { state: createEmptyRoomState(roomId), revision: 0, peers: new Set() });
  }
  const room = rooms.get(roomId);
  if (!room.state) room.state = createEmptyRoomState(roomId);
  return room;
}

async function handleRoomState(req, requestUrl, res) {
  const roomId = requestUrl.searchParams.get("room") || "LOCAL";
  const room = ensureRoom(roomId);
  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, roomId, revision: room.revision || 0, state: room.state, storage: getCloudStorageStatus() });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  if (!canPersistWrites()) {
    sendJson(res, 503, { ok: false, error: "github data storage not ready", storage: getCloudStorageStatus() });
    return;
  }
  try {
    const message = JSON.parse(await readBody(req));
    if (!message.state) {
      sendJson(res, 400, { ok: false, error: "missing state" });
      return;
    }
    room.state = adoptOrMergeLibrary(room, message.state);
    room.revision = (room.revision || 0) + 1;
    scheduleSave(message.reason || "http-state");
    broadcast(roomId, { type: "state", clientId: message.clientId || "http", roomId, state: room.state, reason: message.reason || "http-state", revision: room.revision }, null);
    sendJson(res, 200, { ok: true, revision: room.revision, state: room.state, storage: getCloudStorageStatus() });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "invalid state request", detail: error.message });
  }
}

function adoptOrMergeLibrary(room, incomingState) {
  const incoming = normalizeLibrary(incomingState);
  const serverHasContent = !isPristineRoomState(room.state);
  const incomingIsBlank = isPristineRoomState(incoming);
  if (serverHasContent && incomingIsBlank) {
    return room.state;
  }
  if ((room.revision || 0) === 0 && isPristineRoomState(room.state)) return incoming;
  return mergeLibraries(room.state, incoming);
}

function isPristineRoomState(state) {
  const lib = normalizeLibrary(state);
  if ((lib.members || []).length) return false;
  if (lib.lists.length !== 1) return false;
  const list = lib.lists[0];
  const trip = list.trip || {};
  const days = trip.days || [];
  if (days.length !== 1) return false;
  const day = days[0];
  const blankDay = !day.location && !day.stay && !(day.activities || []).length;
  const blankList = list.name === "新行程单" || trip.tripTitle === "新行程单";
  return blankDay && blankList;
}

function mergeLibraries(serverState, incomingState) {
  if (!serverState) return normalizeLibrary(incomingState);
  const server = normalizeLibrary(serverState);
  const incoming = normalizeLibrary(incomingState);
  const deleted = mergeDeleted(server.deleted, incoming.deleted);
  const lists = mergeById(server.lists, incoming.lists, (left, right) => mergeList(left, right, deleted), deleted.lists);
  const members = mergeById(server.members || [], incoming.members || [], chooseNewer, deleted.members);
  const activeListId = lists.some((list) => list.id === incoming.activeListId) ? incoming.activeListId : (lists.some((list) => list.id === server.activeListId) ? server.activeListId : lists[0]?.id || "");
  return { version: 2, activeListId, members, lists, deleted, updatedAt: Math.max(toTime(server.updatedAt), toTime(incoming.updatedAt), Date.now()) };
}

function mergeList(left, right, deleted) {
  const newer = chooseNewer(left, right);
  return {
    ...newer,
    name: newer.name || newer.trip?.tripTitle || "未命名行程单",
    trip: mergeTrip(left.trip, right.trip, deleted),
    updatedAt: Math.max(toTime(left.updatedAt), toTime(right.updatedAt)),
    createdAt: Math.min(toTime(left.createdAt), toTime(right.createdAt)) || Date.now(),
  };
}

function mergeTrip(left = {}, right = {}, deleted) {
  const newer = chooseNewer(left, right);
  const orderSource = toTime(right.orderUpdatedAt) >= toTime(left.orderUpdatedAt) ? right : left;
  const mergedDays = mergeById(left.days || [], right.days || [], (a, b) => mergeDay(a, b, deleted), deleted.days);
  const orderedDays = orderBySource(mergedDays, orderSource.days || []);
  const budget = mergeBudget(left.budget || {}, right.budget || {});
  const selectedDayId = orderedDays.some((day) => day.id === newer.selectedDayId) ? newer.selectedDayId : orderedDays[0]?.id || "";
  return {
    ...newer,
    days: orderedDays,
    budget,
    selectedDayId,
    dayLimit: Math.max(orderedDays.length || 1, Math.min(60, Number(newer.dayLimit) || 30)),
    updatedAt: Math.max(toTime(left.updatedAt), toTime(right.updatedAt)),
    orderUpdatedAt: Math.max(toTime(left.orderUpdatedAt), toTime(right.orderUpdatedAt)),
  };
}

function mergeDay(left = {}, right = {}, deleted) {
  const newer = chooseNewer(left, right);
  const orderSource = toTime(right.orderUpdatedAt) >= toTime(left.orderUpdatedAt) ? right : left;
  const mergedActivities = mergeById(left.activities || [], right.activities || [], mergeActivity, deleted.activities);
  return {
    ...newer,
    activities: orderBySource(mergedActivities, orderSource.activities || []),
    updatedAt: Math.max(toTime(left.updatedAt), toTime(right.updatedAt)),
    orderUpdatedAt: Math.max(toTime(left.orderUpdatedAt), toTime(right.orderUpdatedAt)),
  };
}

function mergeActivity(left = {}, right = {}) {
  const newer = chooseNewer(left, right);
  return { ...newer, updatedAt: Math.max(toTime(left.updatedAt), toTime(right.updatedAt)) };
}

function mergeBudget(left = {}, right = {}) {
  const newer = chooseNewer(left, right);
  const items = { ...(left.items || {}) };
  for (const [activityId, item] of Object.entries(right.items || {})) {
    const existing = items[activityId];
    items[activityId] = !existing || toTime(item.updatedAt) >= toTime(existing.updatedAt) ? item : existing;
  }
  return { ...newer, items, updatedAt: Math.max(toTime(left.updatedAt), toTime(right.updatedAt)) };
}

function mergeById(leftItems, rightItems, mergeItem, deletedMap = {}) {
  const result = new Map();
  for (const item of leftItems || []) if (item?.id) result.set(item.id, item);
  for (const item of rightItems || []) {
    if (!item?.id) continue;
    result.set(item.id, result.has(item.id) ? mergeItem(result.get(item.id), item) : item);
  }
  return Array.from(result.values()).filter((item) => !deletedMap?.[item.id] || toTime(item.updatedAt) > toTime(deletedMap[item.id]));
}

function orderBySource(items, sourceItems) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = [];
  for (const item of sourceItems || []) {
    if (byId.has(item.id)) ordered.push(byId.get(item.id));
    byId.delete(item.id);
  }
  ordered.push(...byId.values());
  return ordered;
}

function chooseNewer(left = {}, right = {}) {
  return toTime(right.updatedAt) >= toTime(left.updatedAt) ? right : left;
}

function normalizeLibrary(input = {}) {
  const now = Date.now();
  const lists = (Array.isArray(input.lists) ? input.lists : []).filter((list) => list?.trip?.days?.length).map((list, index) => normalizeList(list, index, now));
  const activeListId = lists.some((list) => list.id === input.activeListId) ? input.activeListId : lists[0]?.id || "";
  return {
    version: 2,
    activeListId,
    members: normalizeMembers(input.members, now),
    lists,
    deleted: normalizeDeleted(input.deleted),
    updatedAt: toTime(input.updatedAt) || now,
  };
}

function normalizeList(list = {}, index, now) {
  const id = list.id || crypto.randomUUID();
  const trip = normalizeTrip(list.trip || {}, now);
  const name = String(list.name || trip.tripTitle || `行程单 ${index + 1}`).trim() || "未命名行程单";
  trip.tripTitle ||= name;
  return { ...list, id, name, trip, createdAt: toTime(list.createdAt) || now, updatedAt: toTime(list.updatedAt || trip.updatedAt) || now };
}

function normalizeTrip(trip = {}, now) {
  const days = (Array.isArray(trip.days) ? trip.days : []).map((day) => normalizeDay(day, now)).filter(Boolean);
  const safeDays = days.length ? days : [normalizeDay({ id: crypto.randomUUID(), location: "", stay: "", activities: [] }, now)];
  return {
    ...trip,
    tripTitle: trip.tripTitle || "新行程单",
    startDate: trip.startDate || new Date(now).toISOString().slice(0, 10),
    originCity: trip.originCity || "",
    selectedDayId: safeDays.some((day) => day.id === trip.selectedDayId) ? trip.selectedDayId : safeDays[0].id,
    dayLimit: Math.max(safeDays.length || 1, Math.min(60, Number(trip.dayLimit) || 30)),
    days: safeDays,
    budget: normalizeBudget(trip.budget, now),
    updatedAt: toTime(trip.updatedAt) || now,
    orderUpdatedAt: toTime(trip.orderUpdatedAt) || toTime(trip.updatedAt) || now,
  };
}

function normalizeDay(day = {}, now) {
  const id = day.id || crypto.randomUUID();
  return {
    ...day,
    id,
    location: day.location || "",
    stay: day.stay || "",
    activities: (Array.isArray(day.activities) ? day.activities : []).map((activity) => normalizeActivity(activity, now)),
    updatedAt: toTime(day.updatedAt) || now,
    orderUpdatedAt: toTime(day.orderUpdatedAt) || toTime(day.updatedAt) || now,
  };
}

function normalizeActivity(activity = {}, now) {
  return {
    ...activity,
    id: activity.id || crypto.randomUUID(),
    time: activity.time || "",
    title: activity.title || "未命名事项",
    place: activity.place || "",
    note: activity.note || "",
    done: Boolean(activity.done),
    budget: activity.budget || null,
    transport: activity.transport || null,
    updatedAt: toTime(activity.updatedAt) || now,
  };
}

function normalizeMembers(members = [], now) {
  const seen = new Set();
  return (Array.isArray(members) ? members : []).map((member) => ({
    id: member?.id || crypto.randomUUID(),
    name: String(member?.name || "").trim(),
    createdAt: toTime(member?.createdAt) || now,
    updatedAt: toTime(member?.updatedAt) || now,
  })).filter((member) => member.name && !seen.has(member.id) && seen.add(member.id));
}

function normalizeBudget(budget = {}, now) {
  const items = {};
  for (const [id, item] of Object.entries(budget?.items || {})) {
    items[id] = { ...item, updatedAt: toTime(item.updatedAt) || toTime(budget.updatedAt) || now };
  }
  return { ...budget, currency: budget?.currency || "CNY", items, updatedAt: toTime(budget?.updatedAt) || now };
}

function normalizeDeleted(deleted = {}) {
  return {
    lists: normalizeDeletedMap(deleted.lists),
    days: normalizeDeletedMap(deleted.days),
    activities: normalizeDeletedMap(deleted.activities),
    members: normalizeDeletedMap(deleted.members),
  };
}

function normalizeDeletedMap(map = {}) {
  const result = {};
  for (const [id, time] of Object.entries(map || {})) result[id] = toTime(time) || Date.now();
  return result;
}

function mergeDeleted(left = {}, right = {}) {
  const result = normalizeDeleted(left);
  const incoming = normalizeDeleted(right);
  for (const kind of ["lists", "days", "activities", "members"]) {
    for (const [id, time] of Object.entries(incoming[kind] || {})) {
      result[kind][id] = Math.max(toTime(result[kind][id]), toTime(time));
    }
  }
  return result;
}

function toTime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
