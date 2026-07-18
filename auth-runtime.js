"use strict";

const crypto = require("crypto");

const DEFAULT_REPO = "CuSO4-5-H2O/Trip-designer";
const DEFAULT_BRANCH = "trip-data";
const DEFAULT_PATH = "accounts.json";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function createAuthRuntime() {
  const token = process.env.GITHUB_DATA_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const repo = process.env.GITHUB_DATA_REPO || process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const branch = process.env.GITHUB_DATA_BRANCH || DEFAULT_BRANCH;
  const filePath = process.env.GITHUB_AUTH_PATH || DEFAULT_PATH;
  const [owner, name] = String(repo).split("/");
  const enabled = Boolean(token && owner && name);
  const secret = process.env.AUTH_SECRET || token.slice(-48) || "trip-designer-auth-secret";
  let sha = "";
  let branchReady = false;
  let saveQueue = Promise.resolve();
  let data = emptyData();
  const status = {
    enabled,
    repo,
    branch,
    path: filePath,
    ready: !enabled,
    lastLoadAt: "",
    lastSaveAt: "",
    lastError: enabled ? "" : "GITHUB_DATA_TOKEN not configured",
  };

  async function load() {
    if (!enabled) return null;
    try {
      await ensureBranch();
      const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(branch)}`, { method: "GET" });
      if (response.status === 404) {
        data = emptyData();
        status.ready = true;
        status.lastError = "";
        status.lastLoadAt = new Date().toISOString();
        return data;
      }
      if (!response.ok) throw await githubError(response, "load auth data");
      const payload = await response.json();
      sha = payload.sha || "";
      const text = Buffer.from(String(payload.content || ""), "base64").toString("utf8");
      data = normalizeData(JSON.parse(text || "{}"));
      status.ready = true;
      status.lastError = "";
      status.lastLoadAt = new Date().toISOString();
      return data;
    } catch (error) {
      status.ready = false;
      status.lastError = error.message;
      throw error;
    }
  }

  async function handle(req, res, requestUrl) {
    if (!requestUrl.pathname.startsWith("/api/auth/")) return false;
    if (!enabled || !status.ready) {
      if (requestUrl.pathname === "/api/auth/status") {
        sendJson(res, 200, { ok: true, auth: { ...status } });
      } else {
        sendJson(res, 503, { ok: false, error: "GitHub auth storage not ready", auth: { ...status } });
      }
      return true;
    }

    if (requestUrl.pathname === "/api/auth/status") {
      sendJson(res, 200, { ok: true, auth: { ...status } });
      return true;
    }
    if (requestUrl.pathname === "/api/auth/register") return handleRegister(req, res);
    if (requestUrl.pathname === "/api/auth/login") return handleLogin(req, res);
    if (requestUrl.pathname === "/api/auth/me") return handleMe(req, res);
    if (requestUrl.pathname === "/api/auth/join-room") return handleJoinRoom(req, res);
    if (requestUrl.pathname === "/api/auth/create-room") return handleCreateRoom(req, res);
    sendJson(res, 404, { ok: false, error: "auth endpoint not found" });
    return true;
  }

  async function handleRegister(req, res) {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const body = JSON.parse(await readBody(req));
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    if (!username) return sendJson(res, 400, { ok: false, error: "账号需要 3-32 位字母、数字、下划线或短横线" });
    if (password.length < 6) return sendJson(res, 400, { ok: false, error: "密码至少 6 位" });
    if (data.accounts[username]) return sendJson(res, 409, { ok: false, error: "账号已存在" });
    const now = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString("hex");
    const roomId = randomRoomId();
    const account = {
      id: crypto.randomUUID(),
      username,
      displayName: String(body.displayName || username).trim().slice(0, 40) || username,
      passwordHash: hashPassword(password, salt),
      salt,
      defaultRoomId: roomId,
      rooms: [{ roomId, role: "owner", addedAt: now, updatedAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    data.accounts[username] = account;
    await save("register");
    sendJson(res, 200, publicSession(account));
  }

  async function handleLogin(req, res) {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const body = JSON.parse(await readBody(req));
    const username = normalizeUsername(body.username);
    const account = data.accounts[username];
    if (!account || account.passwordHash !== hashPassword(String(body.password || ""), account.salt)) {
      return sendJson(res, 401, { ok: false, error: "账号或密码不正确" });
    }
    sendJson(res, 200, publicSession(account));
  }

  async function handleMe(req, res) {
    if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const account = accountFromRequest(req);
    if (!account) return sendJson(res, 401, { ok: false, error: "not signed in" });
    sendJson(res, 200, { ok: true, account: publicAccount(account) });
  }

  async function handleJoinRoom(req, res) {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const account = accountFromRequest(req);
    if (!account) return sendJson(res, 401, { ok: false, error: "not signed in" });
    const body = JSON.parse(await readBody(req));
    const roomId = normalizeRoomId(body.roomId);
    if (!roomId) return sendJson(res, 400, { ok: false, error: "missing roomId" });
    if (!account.rooms.some((room) => room.roomId === roomId)) {
      const now = new Date().toISOString();
      account.rooms.push({ roomId, role: "editor", addedAt: now, updatedAt: now });
      account.updatedAt = now;
      await save("join-room");
    }
    sendJson(res, 200, { ok: true, account: publicAccount(account), roomId });
  }

  async function handleCreateRoom(req, res) {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method not allowed" });
    const account = accountFromRequest(req);
    if (!account) return sendJson(res, 401, { ok: false, error: "not signed in" });
    const body = JSON.parse(await readBody(req));
    const requested = normalizeRoomId(body.roomId);
    const roomId = requested || randomRoomId();
    const now = new Date().toISOString();
    const existing = account.rooms.find((room) => room.roomId === roomId);
    if (!existing) {
      account.rooms.push({ roomId, role: "owner", addedAt: now, updatedAt: now });
      account.updatedAt = now;
      await save("create-room");
    }
    sendJson(res, 200, { ok: true, account: publicAccount(account), roomId });
  }

  function publicSession(account) {
    return { ok: true, token: signToken(account), account: publicAccount(account), roomId: account.defaultRoomId };
  }

  function publicAccount(account) {
    return {
      username: account.username,
      displayName: account.displayName,
      defaultRoomId: account.defaultRoomId,
      rooms: normalizeRooms(account.rooms).map((room) => ({ roomId: room.roomId, role: room.role, addedAt: room.addedAt, updatedAt: room.updatedAt })),
    };
  }

  function accountFromRequest(req) {
    const header = req.headers.authorization || req.headers["x-trip-token"] || "";
    const tokenValue = String(header).replace(/^Bearer\s+/i, "").trim();
    const payload = verifyToken(tokenValue);
    if (!payload?.username) return null;
    const account = data.accounts[payload.username] || null;
    if (account) account.rooms = normalizeRooms(account.rooms);
    return account;
  }

  function signToken(account) {
    const payload = { username: account.username, exp: Date.now() + TOKEN_TTL_MS };
    const body = base64Url(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  function verifyToken(tokenValue) {
    try {
      const [body, sig] = String(tokenValue || "").split(".");
      if (!body || !sig) return null;
      const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
      const sigBuffer = Buffer.from(sig);
      const expectedBuffer = Buffer.from(expected);
      if (sigBuffer.length !== expectedBuffer.length) return null;
      if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (!payload.exp || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function save(reason) {
    saveQueue = saveQueue.then(() => saveOnce(reason), () => saveOnce(reason));
    return saveQueue;
  }

  async function saveOnce(reason) {
    await ensureBranch();
    const body = {
      message: `data: persist trip accounts ${new Date().toISOString()} (${reason})`,
      content: Buffer.from(JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2), "utf8").toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;
    const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}`, { method: "PUT", body: JSON.stringify(body) });
    if (response.status === 409) {
      await refreshSha();
      return saveOnce(reason);
    }
    if (!response.ok) throw await githubError(response, "save auth data");
    const payload = await response.json();
    sha = payload.content?.sha || sha;
    status.ready = true;
    status.lastError = "";
    status.lastSaveAt = new Date().toISOString();
    return { ok: true };
  }

  async function refreshSha() {
    const response = await githubFetch(`/repos/${owner}/${name}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(branch)}`, { method: "GET" });
    if (response.status === 404) { sha = ""; return; }
    if (!response.ok) throw await githubError(response, "refresh auth data sha");
    const payload = await response.json();
    sha = payload.sha || "";
    data = normalizeData(JSON.parse(Buffer.from(String(payload.content || ""), "base64").toString("utf8") || "{}"));
  }

  async function ensureBranch() {
    if (branchReady) return;
    const branchResponse = await githubFetch(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`, { method: "GET" });
    if (branchResponse.ok) { branchReady = true; return; }
    if (branchResponse.status !== 404) throw await githubError(branchResponse, "check auth data branch");
    const repoResponse = await githubFetch(`/repos/${owner}/${name}`, { method: "GET" });
    if (!repoResponse.ok) throw await githubError(repoResponse, "read repository metadata");
    const repoData = await repoResponse.json();
    const sourceBranch = repoData.default_branch || "main";
    const sourceRefResponse = await githubFetch(`/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(sourceBranch)}`, { method: "GET" });
    if (!sourceRefResponse.ok) throw await githubError(sourceRefResponse, "read default branch ref");
    const sourceRef = await sourceRefResponse.json();
    const createResponse = await githubFetch(`/repos/${owner}/${name}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: sourceRef.object?.sha }) });
    if (!createResponse.ok && createResponse.status !== 422) throw await githubError(createResponse, "create auth data branch");
    branchReady = true;
  }

  async function githubFetch(path, options = {}) {
    return fetch(`https://api.github.com${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "TripDesignerAuthStorage",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    });
  }

  return { enabled, status, load, handle };
}

function emptyData() { return { version: 1, accounts: {} }; }
function normalizeData(input = {}) { return { version: 1, accounts: input.accounts && typeof input.accounts === "object" ? input.accounts : {} }; }
function normalizeUsername(value) { const v = String(value || "").trim().toLowerCase(); return /^[a-z0-9_-]{3,32}$/.test(v) ? v : ""; }
function normalizeRoomId(value) { return String(value || "").trim().toUpperCase().replace(/[^0-9A-Z_-]/g, "").slice(0, 32); }
function normalizeRooms(rooms = []) {
  const seen = new Set();
  const normalized = [];
  for (const item of Array.isArray(rooms) ? rooms : []) {
    const roomId = normalizeRoomId(item?.roomId || item);
    if (!roomId || seen.has(roomId)) continue;
    seen.add(roomId);
    normalized.push({
      roomId,
      role: item?.role === "owner" ? "owner" : "editor",
      addedAt: item?.addedAt || item?.updatedAt || new Date(0).toISOString(),
      updatedAt: item?.updatedAt || item?.addedAt || new Date(0).toISOString(),
    });
  }
  return normalized;
}
function randomRoomId() { return crypto.randomBytes(4).toString("hex").toUpperCase(); }
function hashPassword(password, salt) { return crypto.pbkdf2Sync(String(password), String(salt), 120000, 32, "sha256").toString("hex"); }
function base64Url(value) { return Buffer.from(value, "utf8").toString("base64url"); }
function encodeURIComponentPath(filePath) { return String(filePath).split("/").map(encodeURIComponent).join("/"); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body || "{}"));
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function githubError(response, action) {
  let detail = "";
  try { const payload = await response.json(); detail = payload.message || JSON.stringify(payload).slice(0, 300); }
  catch { detail = await response.text().catch(() => ""); }
  return new Error(`GitHub ${action} failed: ${response.status} ${detail}`.trim());
}

module.exports = { createAuthRuntime };
