(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  const originalSend = WebSocket.prototype.send;
  let lastStateByRoom = new Map();

  window.TripDesignerFlushSync = flushNow;
  window.fetch = guardedFetch;
  WebSocket.prototype.send = immediateSend;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initManualSync, { once: true });
  else initManualSync();

  function immediateSend(data) {
    const payload = parseJson(data);
    if (payload?.type === "state" && payload.roomId && payload.state) {
      lastStateByRoom.set(payload.roomId, payload.state);
      setSyncText("正在保存到云端", true);
    }
    return originalSend.call(this, data);
  }

  function guardedFetch(input, init = {}) {
    const method = String(init?.method || "GET").toUpperCase();
    const url = typeof input === "string" ? input : input?.url || "";
    if (/\/api\/room-state\?/.test(url) && method === "POST") {
      return compactRoomStatePost(input, init, url);
    }
    return originalFetch(input, init);
  }

  async function compactRoomStatePost(input, init, url) {
    const requestBody = parseJson(init?.body);
    const response = await originalFetch(input, init);
    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    if (!payload?.ok) return response;

    const roomId = new URL(url, location.href).searchParams.get("room") || requestBody?.roomId || payload?.roomId || "";
    if (requestBody?.state) lastStateByRoom.set(roomId, requestBody.state);

    if (requestBody?.state && payload.state && sameVisibleState(requestBody.state, payload.state)) {
      const compact = { ...payload, stateOmitted: true };
      delete compact.state;
      return jsonResponse(compact);
    }
    return response;
  }

  async function flushNow(reason = "manual-sync") {
    const params = new URLSearchParams(location.search);
    const roomId = params.get("room") || window.TripRoom?.id || "";
    const plannerState = window.TripPlanner?.getLibrary?.();
    const state = plannerState || lastStateByRoom.get(roomId);
    if (!roomId || !state) {
      setSyncText("没有待同步数据", true);
      return false;
    }
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
          baseRevision: window.TripPlanner?.getRevision?.() || 0,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      setSyncText("已保存到云端", true);
      return true;
    } catch {
      setSyncText("云端同步失败，点击重试", false);
      return false;
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

  function setSyncText(text, connected) {
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText) syncText.textContent = text;
    syncState?.classList.toggle("connected", Boolean(connected));
    syncState?.classList.toggle("offline", !connected);
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
