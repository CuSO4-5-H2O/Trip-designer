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
let saveTimer = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

loadRooms();

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url.startsWith("/sync")) {
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("WebSocket endpoint");
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
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


