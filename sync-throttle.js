(() => {
  "use strict";

  const AUTO_SAVE_DELAY_MS = 60_000;
  const originalFetch = window.fetch.bind(window);
  const originalSend = WebSocket.prototype.send;
  const lastStateByRoom = new Map();
  const pendingHttpByRoom = new Map();
  const pendingSocketByRoom = new Map();

  window.TripDesignerFlushSync = flushNow;
  window.fetch = guardedFetch;
  WebSocket.prototype.send = queuedSend;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initManualSync, { once: true });
  else initManualSync();
  window.addEventListener("beforeunload", flushForUnload, { capture: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushForUnload();
  });

  function queuedSend(data) {
    const payload = parseJson(data);
    if (payload?.type === "state" && payload.roomId && payload.state) {
      lastStateByRoom.set(payload.roomId, payload.state);
      if (shouldSendImmediately(payload.reason)) {
        setSyncText("正在保存到云端", true);
        return originalSend.call(this, data);
      }
      markPending(payload.roomId);
      queueSocketState(this, payload.roomId, payload);
      setSyncText("本地待同步 · 1 分钟内自动保存", false);
      return;
    }
    return originalSend.call(this, data);
  }

  function guardedFetch(input, init = {}) {
    const method = String(init?.method || "GET").toUpperCase();
    const url = toUrl(input);
    if (url?.pathname === "/api/room-state" && method === "POST") {
      return queueRoomStatePost(input, init, url);
    }
    return originalFetch(input, init);
  }

  async function queueRoomStatePost(input, init, url) {
    const requestBody = parseJson(init?.body);
    const roomId = url.searchParams.get("room") || requestBody?.roomId || "";
    if (!requestBody?.state || !roomId || shouldSendImmediately(requestBody.reason)) {
      return compactRoomStatePost(input, init, url, requestBody);
    }

    lastStateByRoom.set(roomId, requestBody.state);
    markPending(roomId);
    clearTimeout(pendingHttpByRoom.get(roomId)?.timer);
    pendingHttpByRoom.set(roomId, {
      roomId,
      input: String(url.pathname + url.search),
      init: clonePostInit(init),
      body: requestBody,
      timer: window.setTimeout(() => flushRoom(roomId, "auto-debounce"), AUTO_SAVE_DELAY_MS),
    });
    setSyncText("本地待同步 · 1 分钟内自动保存", false);
    return jsonResponse({
      ok: true,
      queued: true,
      roomId,
      revision: getRevision(),
      autosaveInMs: AUTO_SAVE_DELAY_MS,
    });
  }

  async function compactRoomStatePost(input, init, url, requestBody = parseJson(init?.body)) {
    const response = await originalFetch(input, init);
    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    if (!payload?.ok) return response;

    const roomId = url.searchParams.get("room") || requestBody?.roomId || payload?.roomId || "";
    if (requestBody?.state) lastStateByRoom.set(roomId, requestBody.state);

    if (requestBody?.state && payload.state && sameVisibleState(requestBody.state, payload.state)) {
      const compact = { ...payload, stateOmitted: true };
      delete compact.state;
      return jsonResponse(compact);
    }
    return response;
  }

  function queueSocketState(socket, roomId, payload) {
    clearTimeout(pendingSocketByRoom.get(roomId)?.timer);
    pendingSocketByRoom.set(roomId, {
      socket,
      payload,
      timer: window.setTimeout(() => flushSocket(roomId), AUTO_SAVE_DELAY_MS),
    });
  }

  function flushSocket(roomId) {
    const pending = pendingSocketByRoom.get(roomId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    pendingSocketByRoom.delete(roomId);
    if (pending.socket?.readyState !== WebSocket.OPEN) return false;
    try {
      originalSend.call(pending.socket, JSON.stringify(pending.payload));
      setSyncText("正在保存到云端", true);
      return true;
    } catch {
      setSyncText("云端同步失败，点击重试", false);
      return false;
    }
  }

  async function flushRoom(roomId, reason = "manual-sync") {
    clearTimeout(pendingHttpByRoom.get(roomId)?.timer);
    pendingHttpByRoom.delete(roomId);
    clearTimeout(pendingSocketByRoom.get(roomId)?.timer);
    pendingSocketByRoom.delete(roomId);

    const plannerState = window.TripPlanner?.getLibrary?.();
    const state = plannerState || lastStateByRoom.get(roomId);
    if (!roomId || !state) return false;
    markPending(roomId);
    setSyncText("正在保存到云端", true);
    try {
      const response = await originalFetch(`/api/room-state?room=${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: readLocal("trip-planner:client-id") || "manual-sync",
          roomId,
          state,
          reason,
          baseRevision: getRevision(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      clearPending(roomId);
      setSyncText("已保存到云端", true);
      return true;
    } catch {
      markPending(roomId);
      scheduleRetry(roomId);
      setSyncText("云端同步失败，点击重试", false);
      return false;
    }
  }

  async function flushNow(reason = "manual-sync") {
    const params = new URLSearchParams(location.search);
    const roomId = params.get("room") || window.TripRoom?.id || "";
    if (!roomId) {
      setSyncText("没有待同步数据", true);
      return false;
    }
    return flushRoom(roomId, reason);
  }

  function flushForUnload() {
    const params = new URLSearchParams(location.search);
    const roomId = params.get("room") || window.TripRoom?.id || "";
    const state = window.TripPlanner?.getLibrary?.() || lastStateByRoom.get(roomId);
    if (!roomId || !state) return;
    const body = JSON.stringify({
      clientId: readLocal("trip-planner:client-id") || "unload-sync",
      roomId,
      state,
      reason: "unload-sync",
      baseRevision: getRevision(),
    });
    try {
      navigator.sendBeacon?.(`/api/room-state?room=${encodeURIComponent(roomId)}`, new Blob([body], { type: "application/json" }));
    } catch {}
  }

  function scheduleRetry(roomId) {
    markPending(roomId);
    clearTimeout(pendingHttpByRoom.get(roomId)?.timer);
    pendingHttpByRoom.set(roomId, {
      roomId,
      timer: window.setTimeout(() => flushRoom(roomId, "retry-debounce"), 12_000),
    });
  }

  function markPending(roomId) {
    window.__TripPendingLocalSave = { roomId, at: Date.now(), pending: true };
  }

  function clearPending(roomId) {
    const pending = window.__TripPendingLocalSave;
    if (pending?.roomId === roomId) {
      window.__TripPendingLocalSave = { roomId, at: Date.now(), pending: false };
    }
  }

  function initManualSync() {
    const syncState = document.querySelector("#syncState");
    if (!syncState || syncState.dataset.throttleBound === "1") return;
    syncState.dataset.throttleBound = "1";
    syncState.setAttribute("role", "button");
    syncState.setAttribute("tabindex", "0");
    syncState.title = "点击立即保存到 GitHub 云端数据";
    syncState.addEventListener("click", () => flushNow("manual-click"));
    syncState.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      flushNow("manual-keyboard");
    });
  }

  function shouldSendImmediately(reason) {
    return /manual|unload|flush|beforeunload|retry|add-day|delete-day|add-list|delete-list|save-activity|delete-activity|reorder-|inline-template-add-activity|add-ai|apply-ai|ai-quick-plan-apply|create-room|join-room/i.test(String(reason || ""));
  }

  function clonePostInit(init = {}) {
    return {
      method: "POST",
      headers: init.headers || { "Content-Type": "application/json" },
      body: init.body,
      keepalive: init.keepalive,
    };
  }

  function toUrl(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      if (!raw) return null;
      return new URL(raw, location.href);
    } catch {
      return null;
    }
  }

  function setSyncText(text, connected) {
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText) syncText.textContent = text;
    syncState?.classList.toggle("connected", Boolean(connected));
    syncState?.classList.toggle("offline", !connected);
  }

  function getRevision() {
    return window.TripPlanner?.getRevision?.() || window.__TripCloudAuthority?.revision || 0;
  }

  function readLocal(key) {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  }

  function sameVisibleState(left, right) {
    return stableStringify(stripVolatile(left)) === stableStringify(stripVolatile(right));
  }

  function stripVolatile(value) {
    if (Array.isArray(value)) return value.map(stripVolatile);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "updatedAt" || key === "createdAt" || key === "orderUpdatedAt" || key === "deleted") continue;
      result[key] = stripVolatile(value[key]);
    }
    return result;
  }

  function stableStringify(value) {
    return JSON.stringify(value);
  }

  function parseJson(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try { return JSON.parse(String(value)); } catch { return null; }
  }

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
})();
