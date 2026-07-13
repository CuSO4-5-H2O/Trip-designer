(() => {
  "use strict";

  const AUTO_SYNC_DELAY = 60000;
  const LOCAL_NEWER_SKEW = 500;
  const originalFetch = window.fetch.bind(window);
  const originalSend = WebSocket.prototype.send;
  let queuedState = null;
  let queuedReason = "";
  let queueTimer = 0;
  let flushing = false;
  let lastQueuedAt = 0;

  window.TripDesignerFlushSync = flushNow;
  window.fetch = throttledFetch;
  WebSocket.prototype.send = throttledSend;
  window.addEventListener("pagehide", flushOnPageHide);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initManualSync, { once: true });
  else initManualSync();

  function throttledSend(data) {
    const payload = parseJson(data);
    if (payload?.type === "state" && payload.roomId && payload.state) {
      queueState({
        clientId: payload.clientId,
        roomId: payload.roomId,
        state: payload.state,
        reason: payload.reason || "ws-state",
        baseRevision: payload.baseRevision || 0,
      });
      return undefined;
    }
    return originalSend.call(this, data);
  }

  function throttledFetch(input, init = {}) {
    const method = String(init?.method || "GET").toUpperCase();
    const url = typeof input === "string" ? input : input?.url || "";
    if (/\/api\/room-state\?/.test(url) && method === "GET") {
      return protectRoomStateFetch(input, init, url);
    }
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
    if (requestBody?.state) clearMatchingQueue(roomId, requestBody.state);

    if (requestBody?.state && payload.state && sameVisibleState(requestBody.state, payload.state)) {
      const compact = { ...payload, stateOmitted: true };
      delete compact.state;
      return jsonResponse(compact);
    }
    return response;
  }

  async function protectRoomStateFetch(input, init, url) {
    const response = await originalFetch(input, init);
    let payload;
    try {
      payload = await response.clone().json();
    } catch {
      return response;
    }
    const roomId = new URL(url, location.href).searchParams.get("room") || payload?.roomId || "";
    const local = readLocalLibrary(roomId);
    if (!roomId || !payload?.ok || !payload.state || !local?.lists?.length) return response;

    const localStamp = stateStamp(local);
    const serverStamp = stateStamp(payload.state);
    if (localStamp <= serverStamp + LOCAL_NEWER_SKEW) return response;

    queueState({
      clientId: readLocal("trip-planner:client-id") || "local-recovery",
      roomId,
      state: local,
      reason: "protect-local-newer",
      baseRevision: Number(payload.revision) || 0,
    });
    flushNow("protect-local-newer");
    return jsonResponse({ ...payload, state: local, localPreferred: true, pendingSave: true });
  }

  function queueState(next) {
    queuedState = next;
    queuedReason = next.reason || queuedReason || "queued-save";
    lastQueuedAt = Date.now();
    markQueued();
    clearTimeout(queueTimer);
    queueTimer = window.setTimeout(() => flushNow("auto-60s"), AUTO_SYNC_DELAY);
  }

  function clearMatchingQueue(roomId, state) {
    if (!queuedState || queuedState.roomId !== roomId) return;
    if (!sameVisibleState(queuedState.state, state)) return;
    queuedState = null;
    clearTimeout(queueTimer);
    queueTimer = 0;
  }

  async function flushNow(reason = "manual-sync") {
    if (flushing || !queuedState) return false;
    const payload = queuedState;
    queuedState = null;
    clearTimeout(queueTimer);
    queueTimer = 0;
    flushing = true;
    setSyncText("正在保存到服务器", true);
    try {
      const response = await originalFetch(`/api/room-state?room=${encodeURIComponent(payload.roomId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, reason: `${payload.reason || queuedReason}:${reason}` }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP ${response.status}`);
      setSyncText("已保存到服务器", true);
      return true;
    } catch (error) {
      queuedState = payload;
      setSyncText("同步失败，点击重试", false);
      clearTimeout(queueTimer);
      queueTimer = window.setTimeout(() => flushNow("retry"), AUTO_SYNC_DELAY);
      return false;
    } finally {
      flushing = false;
    }
  }

  function flushOnPageHide() {
    if (!queuedState) return;
    const payload = queuedState;
    const body = JSON.stringify({ ...payload, reason: `${payload.reason || queuedReason}:pagehide` });
    const url = `/api/room-state?room=${encodeURIComponent(payload.roomId)}`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) {
          queuedState = null;
          clearTimeout(queueTimer);
          return;
        }
      }
      originalFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  function initManualSync() {
    const syncState = document.querySelector("#syncState");
    if (!syncState || syncState.dataset.throttleBound === "1") return;
    syncState.dataset.throttleBound = "1";
    syncState.setAttribute("role", "button");
    syncState.setAttribute("tabindex", "0");
    syncState.title = "点击立即同步到服务器";
    syncState.addEventListener("click", () => flushNow("manual-click"));
    syncState.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      flushNow("manual-keyboard");
    });
  }

  function markQueued() {
    if (!queuedState) return;
    const seconds = Math.max(1, Math.ceil((AUTO_SYNC_DELAY - (Date.now() - lastQueuedAt)) / 1000));
    setSyncText(`本地已保存，${seconds}秒后同步`, true);
  }

  function setSyncText(text, connected) {
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText) syncText.textContent = text;
    syncState?.classList.toggle("connected", Boolean(connected));
    syncState?.classList.toggle("offline", !connected);
  }

  function readLocalLibrary(roomId) {
    return parseJson(readLocal(`trip-planner-library:${roomId}`));
  }

  function readLocal(key) {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  }

  function stateStamp(value) {
    let max = 0;
    const visit = (item) => {
      if (!item || typeof item !== "object") return;
      for (const [key, child] of Object.entries(item)) {
        if (/At$/.test(key)) {
          const number = Number(child);
          if (Number.isFinite(number)) max = Math.max(max, number);
        }
        if (child && typeof child === "object") visit(child);
      }
    };
    visit(value);
    return max;
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
