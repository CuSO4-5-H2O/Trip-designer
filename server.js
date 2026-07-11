const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 4177);
const renderDiskDir = "/var/data";
const dataDir = process.env.DATA_DIR || (fs.existsSync(renderDiskDir) ? renderDiskDir : path.join(root, "data"));
const dataFile = process.env.DATA_FILE || path.join(dataDir, "rooms.json");
const rooms = new Map();
const sockets = new Map();
const geocodeCache = new Map();
let saveTimer = null;
let geocodeQueue = Promise.resolve();
let lastGeocodeAt = 0;

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

  if (requestUrl.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      aiConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    });
    return;
  }

  if (requestUrl.pathname === "/api/ai-status" && req.method === "GET") {
    sendJson(res, 200, {
      configured: Boolean(process.env.DEEPSEEK_API_KEY),
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
    });
    return;
  }

  if (requestUrl.pathname === "/api/travel-recommendations" && req.method === "POST") {
    await handleTravelRecommendations(req, res);
    return;
  }

  if (requestUrl.pathname === "/api/geocode" && req.method === "GET") {
    await handleGeocode(requestUrl, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    sendJson(res, 404, { error: "API endpoint not found" });
    return;
  }

  if (requestUrl.pathname.startsWith("/sync")) {
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

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

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
  console.log(`DeepSeek travel assistant: ${process.env.DEEPSEEK_API_KEY ? "configured" : "not configured"}`);
});

async function handleTravelRecommendations(req, res) {
  if (!process.env.DEEPSEEK_API_KEY) {
    sendJson(res, 503, {
      error: "AI 推荐尚未配置。请在 Render 环境变量中添加 DEEPSEEK_API_KEY。",
    });
    return;
  }

  try {
    const body = await readJsonBody(req, 120000);
    const preference = cleanText(body.preference, 80) || "综合体验";
    const trip = body.trip && typeof body.trip === "object" ? body.trip : {};
    const day = body.day && typeof body.day === "object" ? body.day : {};
    const activities = Array.isArray(day.activities)
      ? day.activities.slice(0, 20).map((activity) => ({
          time: cleanText(activity.time, 20),
          title: cleanText(activity.title, 160),
          place: cleanText(activity.place, 160),
          note: cleanText(activity.note, 240),
        }))
      : [];

    const safeContext = {
      preference,
      tripTitle: cleanText(trip.title, 160),
      startDate: cleanText(trip.startDate, 32),
      originCity: cleanText(trip.originCity, 100),
      destinations: Array.isArray(trip.destinations)
        ? trip.destinations.slice(0, 40).map((value) => cleanText(value, 100)).filter(Boolean)
        : [],
      day: {
        number: Number(day.number) || 1,
        location: cleanText(day.location, 160),
        stay: cleanText(day.stay, 160),
        activities,
      },
    };

    if (!safeContext.day.location && activities.length === 0) {
      sendJson(res, 400, { error: "请先填写当天地点或至少一个行程事项。" });
      return;
    }

    const baseUrl = (process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com").replace(/\/$/, "");
    const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: [
                "你是谨慎、实用的中文旅行规划助手。",
                "根据用户已有行程推荐当地可补充的景点、街区、餐饮或体验，避免重复已有事项。",
                "不要声称掌握实时营业时间、实时票价或实时余票。",
                "必须输出合法 JSON，不要使用 Markdown。",
                "JSON 结构必须为：{summary:string,recommendations:[{name:string,category:string,reason:string,area:string,suggestedTime:string,duration:string,tips:string}],cautions:string[]}。",
                "recommendations 返回 3 到 6 项，优先考虑路线顺畅、距离合理和用户偏好。",
              ].join("\n"),
            },
            {
              role: "user",
              content: `请分析以下行程上下文并给出推荐：\n${JSON.stringify(safeContext)}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.45,
          max_tokens: 1800,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const upstreamMessage = payload?.error?.message || `DeepSeek API returned ${response.status}`;
      throw new Error(upstreamMessage);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 没有返回推荐内容");
    const parsed = JSON.parse(content);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.slice(0, 6).map(normalizeRecommendation).filter((item) => item.name)
      : [];

    sendJson(res, 200, {
      summary: cleanText(parsed.summary, 1000),
      recommendations,
      cautions: Array.isArray(parsed.cautions)
        ? parsed.cautions.slice(0, 6).map((value) => cleanText(value, 300)).filter(Boolean)
        : [],
      model,
    });
  } catch (error) {
    const message = error.name === "AbortError" ? "AI 推荐请求超时，请稍后重试。" : error.message;
    console.warn(`Travel recommendation failed: ${message}`);
    sendJson(res, 502, { error: `AI 推荐生成失败：${message}` });
  }
}

async function handleGeocode(requestUrl, res) {
  const query = cleanText(requestUrl.searchParams.get("q"), 240);
  if (!query) {
    sendJson(res, 400, { error: "缺少地点关键词" });
    return;
  }

  if (geocodeCache.has(query)) {
    sendJson(res, 200, { result: geocodeCache.get(query), cached: true });
    return;
  }

  try {
    const result = await enqueueGeocode(query);
    geocodeCache.set(query, result);
    if (geocodeCache.size > 800) {
      const oldestKey = geocodeCache.keys().next().value;
      geocodeCache.delete(oldestKey);
    }
    sendJson(res, 200, { result, cached: false });
  } catch (error) {
    console.warn(`Geocoding failed for ${query}: ${error.message}`);
    sendJson(res, 502, { error: "地点定位服务暂时不可用，请稍后重试。" });
  }
}

function enqueueGeocode(query) {
  const task = geocodeQueue.then(async () => {
    const elapsed = Date.now() - lastGeocodeAt;
    if (elapsed < 1050) await delay(1050 - elapsed);
    lastGeocodeAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "zh-CN,zh,en");
    url.searchParams.set("q", query);
    if (process.env.TRIP_DESIGNER_CONTACT) {
      url.searchParams.set("email", process.env.TRIP_DESIGNER_CONTACT);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "TripDesigner/1.0 (collaborative itinerary planner)",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    if (!first) return null;
    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
      displayName: cleanText(first.display_name, 300),
      type: cleanText(first.type, 80),
    };
  });

  geocodeQueue = task.catch(() => null);
  return task;
}

function normalizeRecommendation(item) {
  if (!item || typeof item !== "object") return {};
  return {
    name: cleanText(item.name, 180),
    category: cleanText(item.category, 80),
    reason: cleanText(item.reason || item.description, 600),
    area: cleanText(item.area, 160),
    suggestedTime: cleanText(item.suggestedTime, 100),
    duration: cleanText(item.duration, 80),
    tips: cleanText(item.tips, 400),
  };
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("请求内容过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求 JSON 格式无效"));
      }
    });
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

function cleanText(value, maxLength) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      scheduleSave();
    }
    send(socket, { type: "state", clientId: "server", state: room.state });
    broadcastMembers(peer.roomId);
    return;
  }

  if (message.type === "state" && message.state) {
    room.state = message.state;
    scheduleSave();
    broadcast(peer.roomId, message, socket);
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
    rooms.set(roomId, { state: null, peers: new Set() });
  }
  return rooms.get(roomId);
}

function loadRooms() {
  try {
    if (!fs.existsSync(dataFile)) return;
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    for (const [roomId, state] of Object.entries(saved.rooms || {})) {
      rooms.set(roomId, { state, peers: new Set() });
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
      persistedRooms[roomId] = room.state;
    }
  }

  const payload = {
    version: 1,
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
    if (socket !== excludeSocket) {
      send(socket, message);
    }
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
    const second = buffer[offset + 1];
    let length = second & 0x7f;
    let lengthOffset = 2;
    if (length === 126) {
      length = buffer.readUInt16BE(offset + 2);
      lengthOffset = 4;
    } else if (length === 127) {
      length = Number(buffer.readBigUInt64BE(offset + 2));
      lengthOffset = 10;
    }
    const maskStart = offset + lengthOffset;
    const dataStart = maskStart + 4;
    const frameEnd = dataStart + length;
    if (frameEnd > buffer.length) break;
    const mask = buffer.subarray(maskStart, dataStart);
    const payload = buffer.subarray(dataStart, frameEnd);
    const decoded = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) {
      decoded[i] = payload[i] ^ mask[i % 4];
    }
    messages.push(decoded.toString("utf8"));
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
