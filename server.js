const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { handleMapRuntime } = require("./map-runtime");

const root = __dirname;
const port = Number(process.env.PORT || 4177);
const renderDiskDir = "/var/data";
const dataDir = process.env.DATA_DIR || (fs.existsSync(renderDiskDir) ? renderDiskDir : path.join(root, "data"));
const dataFile = process.env.DATA_FILE || path.join(dataDir, "rooms.json");
const rooms = new Map();
const sockets = new Map();
const geocodeCache = new Map();
let saveTimer = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

loadRooms();

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (await handleMapRuntime(req, res, requestUrl.pathname)) {
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, aiConfigured: Boolean(process.env.deepseek || process.env.DEEPSEEK_API_KEY) });
    return;
  }

  if (requestUrl.pathname === "/api/geocode") {
    handleGeocode(requestUrl, res);
    return;
  }

  if (requestUrl.pathname === "/api/ai/recommend") {
    handleAiRecommend(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/room-state") {
    handleRoomState(req, requestUrl, res);
    return;
  }

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
});

server.on("upgrade", (req, socket) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  if (requestUrl.pathname !== "/sync") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

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
    for (const message of decodeFrames(chunk)) {
      handleMessage(socket, message);
    }
  });
  socket.on("close", () => removePeer(socket));
  socket.on("error", () => removePeer(socket));
});

server.listen(port, () => {
  console.log(`Trip planner is running at http://localhost:${port}`);
  console.log(`Room data file: ${dataFile}`);
});

function handleMessage(socket, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  const peer = sockets.get(socket);
  if (!peer) return;
  peer.clientId = message.clientId || peer.clientId;
  peer.name = message.name || peer.name;

  const room = ensureRoom(peer.roomId);
  if (message.type === "join") {
    removeDuplicateClientPeers(peer.roomId, peer.clientId, socket);
    if (!room.state) {
      room.state = message.state;
      room.revision = Math.max(1, room.revision || 0);
      scheduleSave();
    }
    send(socket, { type: "state", clientId: "server", state: room.state, revision: room.revision || 0 });
    broadcastMembers(peer.roomId);
    return;
  }

  if (message.type === "state" && message.state) {
    const baseRevision = Number.isFinite(message.baseRevision) ? message.baseRevision : null;
    const isLegacyWidgetWrite = baseRevision === null && /^(quick-plan|trip-insights):/.test(String(message.clientId || ""));
    if (isLegacyWidgetWrite) {
      send(socket, { type: "conflict", clientId: "server", state: room.state, revision: room.revision || 0, rejectedReason: "legacy-widget-write" });
      return;
    }
    if (baseRevision !== null && baseRevision < (room.revision || 0)) {
      send(socket, {
        type: "conflict",
        clientId: "server",
        state: room.state,
        revision: room.revision || 0,
        rejectedReason: message.reason || "stale-write",
      });
      return;
    }

    room.state = message.state;
    room.revision = (room.revision || 0) + 1;
    scheduleSave();
    send(socket, { type: "ack", clientId: "server", revision: room.revision, reason: message.reason || "state" });
    broadcast(peer.roomId, { ...message, revision: room.revision }, socket);
    return;
  }

  if (message.type === "presence") {
    broadcast(peer.roomId, message, null);
    broadcastMembers(peer.roomId);
    return;
  }

  if (message.type === "leave") {
    removePeer(socket);
  }
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { state: null, revision: 0, peers: new Set() });
  }
  return rooms.get(roomId);
}

function loadRooms() {
  try {
    if (!fs.existsSync(dataFile)) return;
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    for (const [roomId, value] of Object.entries(saved.rooms || {})) {
      const isEnvelope = value && typeof value === "object" && "state" in value;
      rooms.set(roomId, {
        state: isEnvelope ? value.state : value,
        revision: isEnvelope && Number.isFinite(value.revision) ? value.revision : 1,
        peers: new Set(),
      });
    }
    console.log(`Loaded ${rooms.size} room(s) from disk`);
  } catch (error) {
    console.warn(`Could not load room data: ${error.message}`);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRooms, 250);
}

function saveRooms() {
  const persistedRooms = {};
  for (const [roomId, room] of rooms.entries()) {
    if (room.state) {
      persistedRooms[roomId] = { revision: room.revision || 0, state: room.state };
    }
  }

  const payload = {
    version: 2,
    savedAt: new Date().toISOString(),
    rooms: persistedRooms,
  };

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const tempFile = `${dataFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2));
    fs.renameSync(tempFile, dataFile);
  } catch (error) {
    console.warn(`Could not save room data: ${error.message}`);
  }
}

async function handleRoomState(req, requestUrl, res) {
  const roomId = requestUrl.searchParams.get("room") || "LOCAL";
  const room = ensureRoom(roomId);

  if (req.method === "GET") {
    sendJson(res, 200, { ok: true, roomId, revision: room.revision || 0, state: room.state });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  try {
    const message = JSON.parse(await readBody(req));
    if (!message.state) {
      sendJson(res, 400, { ok: false, error: "missing state" });
      return;
    }

    const baseRevision = Number.isFinite(message.baseRevision) ? message.baseRevision : null;
    const isLegacyWidgetWrite = baseRevision === null && /^(quick-plan|trip-insights):/.test(String(message.clientId || ""));
    if (isLegacyWidgetWrite) {
      sendJson(res, 409, { ok: false, error: "legacy-widget-write", revision: room.revision || 0, state: room.state });
      return;
    }

    if (baseRevision !== null && baseRevision < (room.revision || 0)) {
      sendJson(res, 409, { ok: false, error: message.reason || "stale-write", revision: room.revision || 0, state: room.state });
      return;
    }

    room.state = message.state;
    room.revision = (room.revision || 0) + 1;
    scheduleSave();
    broadcast(roomId, { type: "state", clientId: message.clientId || "http", roomId, state: room.state, reason: message.reason || "http-state", revision: room.revision }, null);
    sendJson(res, 200, { ok: true, revision: room.revision });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: "invalid state request", detail: error.message });
  }
}
async function handleGeocode(requestUrl, res) {
  const query = (requestUrl.searchParams.get("q") || "").trim();
  if (!query) {
    sendJson(res, 400, { ok: false, error: "missing query" });
    return;
  }

  if (geocodeCache.has(query)) {
    sendJson(res, 200, { ok: true, cached: true, results: geocodeCache.get(query) });
    return;
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "zh-CN,zh,en");
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: { "User-Agent": "TripDesigner/1.0 (https://tripdesigner.onrender.com)" },
    });
    if (!response.ok) throw new Error(`geocode ${response.status}`);
    const raw = await response.json();
    const results = raw.map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lon: Number(item.lon),
      type: item.type || "",
      importance: Number(item.importance || 0),
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));
    geocodeCache.set(query, results);
    sendJson(res, 200, { ok: true, cached: false, results });
  } catch (error) {
    sendJson(res, 502, { ok: false, error: "geocode failed", detail: error.message });
  }
}

async function handleAiRecommend(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const apiKey = process.env.deepseek || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { ok: false, error: "missing deepseek api key" });
    return;
  }

  try {
    const body = JSON.parse(await readBody(req));
    const day = body.day || {};
    const trip = body.trip || {};
    const prompt = [
      "你是旅行行程规划助手。请只返回 JSON，不要 markdown。",
      "根据当前行程，推荐 3-5 个可直接加入当天的事项。",
      "JSON 格式：{\"recommendations\":[{\"time\":\"09:30\",\"title\":\"...\",\"place\":\"...\",\"note\":\"...\",\"transport\":{\"type\":\"train|bus|boat|plane|car|\",\"from\":\"\",\"to\":\"\",\"depart\":\"\",\"arrive\":\"\"},\"budget\":{\"amount\":0,\"currency\":\"CNY\",\"category\":\"food|transport|stay|ticket|other\"}}]}",
      `行程名称：${trip.tripTitle || ""}`,
      `出发城市：${trip.originCity || ""}`,
      `当天地点：${day.location || ""}`,
      `住宿：${day.stay || ""}`,
      `已有事项：${JSON.stringify(day.activities || [])}`,
    ].join("\n");

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你只输出可解析 JSON。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`deepseek ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    sendJson(res, 200, { ok: true, recommendations: parsed.recommendations || [] });
  } catch (error) {
    sendJson(res, 502, { ok: false, error: "ai recommend failed", detail: error.message });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200000) {
        reject(new Error("request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body || "{}"));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function removeDuplicateClientPeers(roomId, clientId, currentSocket) {
  const room = rooms.get(roomId);
  if (!room || !clientId) return;
  for (const otherSocket of Array.from(room.peers)) {
    if (otherSocket === currentSocket) continue;
    const otherPeer = sockets.get(otherSocket);
    if (otherPeer?.clientId !== clientId) continue;
    room.peers.delete(otherSocket);
    sockets.delete(otherSocket);
    otherSocket.destroy();
  }
}

function removePeer(socket) {
  const peer = sockets.get(socket);
  if (!peer) return;
  sockets.delete(socket);
  const room = rooms.get(peer.roomId);
  room?.peers.delete(socket);
  broadcastMembers(peer.roomId);
}

function broadcastMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const members = Array.from(room.peers)
    .map((socket) => sockets.get(socket))
    .filter(Boolean)
    .map(({ clientId, name }) => ({ clientId, name }));
  broadcast(roomId, { type: "members", members }, null);
}

function broadcast(roomId, message, excludeSocket) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const socket of room.peers) {
    if (socket !== excludeSocket) send(socket, message);
  }
}

function send(socket, payload) {
  if (socket.destroyed) return;
  socket.write(encodeFrame(JSON.stringify(payload)));
}

function decodeFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    if (opcode === 0x8) break;
    let length = second & 0x7f;
    let lengthOffset = 2;
    if (length === 126) {
      length = buffer.readUInt16BE(offset + 2);
      lengthOffset = 4;
    } else if (length === 127) {
      length = Number(buffer.readBigUInt64BE(offset + 2));
      lengthOffset = 10;
    }
    const masked = Boolean(second & 0x80);
    const maskStart = offset + lengthOffset;
    const dataStart = masked ? maskStart + 4 : maskStart;
    const frameEnd = dataStart + length;
    if (frameEnd > buffer.length) break;
    const payload = buffer.subarray(dataStart, frameEnd);
    if (masked) {
      const mask = buffer.subarray(maskStart, dataStart);
      const decoded = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) decoded[i] = payload[i] ^ mask[i % 4];
      messages.push(decoded.toString("utf8"));
    } else {
      messages.push(payload.toString("utf8"));
    }
    offset = frameEnd;
  }
  return messages;
}

function encodeFrame(message) {
  const payload = Buffer.from(message);
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}
