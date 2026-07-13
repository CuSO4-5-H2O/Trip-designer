(() => {
  "use strict";

  const APP_BUILD_VERSION = "render-20260713y";
  const INLINE_EDITOR_VERSION = "render-20260713z";
  const LAST_ROOM_KEY = "tripdesigner:last-room";
  const params = new URLSearchParams(location.search);
  const requestedRoomId = normalizeRoom(params.get("room"));
  const rememberedRoomId = normalizeRoom(readLocal(LAST_ROOM_KEY));
  const roomId = requestedRoomId || rememberedRoomId;

  if (!roomId) {
    showRoomGate();
    return;
  }

  if (requestedRoomId !== params.get("room")) {
    const url = new URL(location.href);
    url.searchParams.set("room", roomId);
    history.replaceState(null, "", url);
  }

  writeLocal(LAST_ROOM_KEY, roomId);
  window.TripRoom = {
    id: roomId,
    lastRoomKey: LAST_ROOM_KEY,
    remember(id) {
      const next = normalizeRoom(id);
      if (next) writeLocal(LAST_ROOM_KEY, next);
      return next;
    },
    switchTo(id) {
      const next = this.remember(id);
      if (!next) return false;
      const url = new URL(location.href);
      url.searchParams.set("room", next);
      location.assign(url.toString());
      return true;
    },
  };

  document.write(`<script src="./app-collab.js?v=${APP_BUILD_VERSION}" type="module"><\/script>`);
  document.write(`<script src="./inline-activity-template.js?v=${INLINE_EDITOR_VERSION}" defer><\/script>`);

  const root = document.documentElement;
  const storageKey = `trip-planner-library:${roomId}`;
  const healthyPattern = /已连接服务器|已同步|已保存到服务器|协作者已更新|同浏览器标签页已同步/;
  let revealed = false;
  let probing = false;
  let probeTimer = 0;
  let httpAvailable = false;

  root.classList.add("room-loading");

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    root.classList.remove("room-loading");
  };

  // Rendering must never depend on the WebSocket handshake. The local editor is
  // shown as soon as the DOM is ready; server synchronization continues in the
  // background and falls back to the room-state HTTP endpoint.
  window.setTimeout(reveal, 1500);
  window.addEventListener("pageshow", () => window.setTimeout(reveal, 50));
  window.addEventListener("error", reveal, { once: true });
  window.addEventListener("unhandledrejection", reveal, { once: true });

  window.addEventListener("DOMContentLoaded", () => {
    window.requestAnimationFrame(reveal);
    guardSyncLabel();
    scheduleProbe(800);
  }, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleProbe(100);
  });

  function normalizeRoom(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z_-]/g, "")
      .slice(0, 32);
  }

  function readLocal(key) {
    try { return localStorage.getItem(key); } catch { return ""; }
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function makeRoomId() {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(bytes).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function roomUrl(id) {
    const url = new URL(location.href);
    url.searchParams.set("room", id);
    return url.toString();
  }

  function showRoomGate() {
    window.__TripRoomGateActive = true;
    const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>行程编辑器</title>
  <style>
    :root{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;color:#17211f;background:#eef6f2;}
    *{box-sizing:border-box} body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top left,#dff4ee,transparent 34%),#f7faf8;}
    .room-gate{width:min(560px,100%);background:#fff;border:1px solid #cfe3de;border-radius:18px;box-shadow:0 24px 80px rgba(23,33,31,.13);padding:28px;}
    .brand{display:flex;gap:14px;align-items:center;margin-bottom:22px}.brand-mark{width:52px;height:52px;border-radius:14px;background:#17211f;color:#fff;display:grid;place-items:center}.brand-mark svg{width:30px;height:30px;fill:currentColor}.eyeline{margin:0;color:#007d72;font-weight:800}.room-gate h1{margin:4px 0 0;font-size:32px;line-height:1.1}.room-gate p{color:#5e706c;line-height:1.7}.field{display:grid;gap:8px;margin:18px 0}.field span{font-weight:800;color:#5e706c}.field input{height:54px;border:1px solid #cfe3de;border-radius:12px;padding:0 16px;font-size:20px;font-weight:800;text-transform:uppercase}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}.primary,.secondary{height:50px;border-radius:12px;border:1px solid #a9ded8;padding:0 18px;font-weight:900;font-size:16px;cursor:pointer}.primary{background:#17211f;color:#fff;border-color:#17211f}.secondary{background:#e3f7f4;color:#007d72}.hint{font-size:14px;margin-top:18px}.error{color:#b63a28;font-weight:800;min-height:22px}.room-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}
  </style>
</head>
<body>
  <main class="room-gate" aria-label="进入协作房间">
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5 10 4l3 7 6.5-2.5L14 20l-3-7-6.5 2.5Z"/></svg></span><div><p class="eyeline">行程编辑器</p><h1>进入同一个房间</h1></div></div>
    <p>为了避免手机、电脑各自进入随机房间，现在必须使用同一个房间号或好友链接。进入一次后，本设备会自动记住这个房间。</p>
    <label class="field"><span>房间号</span><input id="roomInput" autocomplete="off" placeholder="例如 1075424A" /></label>
    <div class="error" id="roomError"></div>
    <div class="actions"><button class="primary" id="enterRoomBtn" type="button">进入房间</button><button class="secondary" id="newRoomBtn" type="button">新建房间</button></div>
    <p class="hint">给朋友发链接时，请复制带 <span class="room-code">?room=房间号</span> 的完整地址。</p>
  </main>
  <script>
    const normalizeRoom = (value) => String(value || "").trim().toUpperCase().replace(/[^0-9A-Z_-]/g, "").slice(0, 32);
    const key = ${JSON.stringify(LAST_ROOM_KEY)};
    const input = document.querySelector("#roomInput");
    const error = document.querySelector("#roomError");
    const go = (id) => {
      const room = normalizeRoom(id);
      if (!room) { error.textContent = "请输入房间号"; input.focus(); return; }
      localStorage.setItem(key, room);
      const url = new URL(location.href);
      url.searchParams.set("room", room);
      location.assign(url.toString());
    };
    document.querySelector("#enterRoomBtn").onclick = () => go(input.value);
    document.querySelector("#newRoomBtn").onclick = () => {
      const bytes = crypto.getRandomValues(new Uint8Array(4));
      go(Array.from(bytes).map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase());
    };
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") go(input.value); });
    input.focus();
  <\/script>
</body>
</html>`;
    document.open();
    document.write(html);
    document.close();
  }

  function guardSyncLabel() {
    const syncText = document.querySelector("#syncText");
    if (!syncText || !window.MutationObserver) return;
    const observer = new MutationObserver(() => {
      const text = syncText.textContent.trim();
      if (!httpAvailable) return;
      if (healthyPattern.test(text) || text === "HTTP 同步可用" || text === "正在保存到服务器") return;
      setStatus("HTTP 同步可用", true, true);
    });
    observer.observe(syncText, { childList: true, characterData: true, subtree: true });
  }

  function scheduleProbe(delay) {
    clearTimeout(probeTimer);
    probeTimer = window.setTimeout(probeServer, delay);
  }

  async function probeServer() {
    if (probing) return;
    const syncText = document.querySelector("#syncText");
    const current = syncText?.textContent?.trim() || "";

    if (healthyPattern.test(current)) {
      scheduleProbe(30000);
      return;
    }

    probing = true;
    try {
      const response = await fetchWithTimeout(
        `/api/room-state?room=${encodeURIComponent(roomId)}`,
        { cache: "no-store" },
        7000,
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      httpAvailable = true;
      if (payload.state?.lists?.length) {
        publishServerState(payload.state, Number(payload.revision) || 0);
        setStatus("HTTP 同步可用", true, true);
      } else {
        setStatus("服务器已连接，房间为空", true, true);
      }
      reveal();
      scheduleProbe(15000);
    } catch {
      httpAvailable = false;
      setStatus("服务器无响应，离线保存", false, true);
      reveal();
      scheduleProbe(8000);
    } finally {
      probing = false;
    }
  }

  function publishServerState(state, revision) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The app can still receive the state through BroadcastChannel.
    }

    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(storageKey);
    const message = {
      type: "library",
      clientId: "http-bootstrap",
      library: state,
      revision,
      reason: "http-bootstrap",
    };
    channel.postMessage(message);
    window.setTimeout(() => channel.postMessage(message), 250);
    window.setTimeout(() => channel.close(), 700);
  }

  function setStatus(text, connected, force = false) {
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (!syncText) return;
    if (!force && healthyPattern.test(syncText.textContent.trim())) return;
    if (syncText.textContent.trim() !== text) syncText.textContent = text;
    syncState?.classList.toggle("connected", Boolean(connected));
    syncState?.classList.toggle("offline", !connected);
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
})();
