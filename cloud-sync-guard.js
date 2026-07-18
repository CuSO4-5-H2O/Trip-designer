(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:" || !window.WebSocket) return;

  const startedAt = Date.now();
  const originalSend = WebSocket.prototype.send;
  const originalFetch = window.fetch.bind(window);
  const stats = {
    strippedJoinState: 0,
    blockedStartupState: 0,
    blockedPreHydrateState: 0,
    blockedPreHydrateHttp: 0,
    hydratedByHttp: 0,
  };

  window.__TripCloudSyncGuard = { roomId, startedAt, stats, isReady };

  WebSocket.prototype.send = function guardedSend(payload) {
    const text = typeof payload === "string" ? payload : "";
    if (!text || text.charCodeAt(0) !== 123) return originalSend.call(this, payload);

    let message;
    try { message = JSON.parse(text); } catch { return originalSend.call(this, payload); }

    if (message?.roomId && String(message.roomId) !== roomId) {
      return originalSend.call(this, payload);
    }

    if (message?.type === "join" && message.state) {
      delete message.state;
      stats.strippedJoinState += 1;
      return originalSend.call(this, JSON.stringify(message));
    }

    if (message?.type === "state") {
      if (!isReady()) {
        stats.blockedPreHydrateState += 1;
        setStatus("正在载入云端数据，暂不写入");
        return;
      }
      if (isStartupPlaceholderState(message.state, message.reason)) {
        stats.blockedStartupState += 1;
        return;
      }
    }

    return originalSend.call(this, payload);
  };

  window.fetch = async function guardedFetch(input, init = {}) {
    const url = toUrl(input);
    const method = String(init?.method || (input && input.method) || "GET").toUpperCase();

    if (url?.pathname === "/api/room-state" && url.searchParams.get("room") === roomId) {
      if (method === "POST" && !isReady()) {
        stats.blockedPreHydrateHttp += 1;
        setStatus("正在载入云端数据，暂不写入");
        return new Response(JSON.stringify({ ok: false, error: "cloud state not hydrated yet" }), {
          status: 409,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }

      const response = await originalFetch(input, init);
      if (method === "GET" && response.ok) {
        response.clone().json().then((payload) => {
          if (payload?.ok && payload?.state?.lists?.length) markReady(payload.state, payload.revision, "http");
        }).catch(() => {});
      }
      return response;
    }

    return originalFetch(input, init);
  };

  function toUrl(input) {
    try {
      const raw = typeof input === "string" ? input : input?.url;
      if (!raw) return null;
      return new URL(raw, location.href);
    } catch {
      return null;
    }
  }

  function markReady(state, revision, source) {
    window.__TripCloudAuthority = {
      ...(window.__TripCloudAuthority || {}),
      roomId,
      revision: Number(revision) || window.__TripCloudAuthority?.revision || 0,
      source,
      at: Date.now(),
      totalLists: Array.isArray(state?.lists) ? state.lists.length : 0,
    };
    stats.hydratedByHttp += source === "http" ? 1 : 0;
  }

  function isReady() {
    const authority = window.__TripCloudAuthority;
    return Boolean(authority && authority.roomId === roomId && Date.now() - Number(authority.at || 0) < 1000 * 60 * 30);
  }

  function isStartupPlaceholderState(state, reason) {
    if (!state || Date.now() - startedAt > 12000) return false;
    if (!/^startup|^init|^hydrate|^join|^room|^render/i.test(String(reason || "startup"))) return false;
    return isPlaceholderLibrary(state);
  }

  function isPlaceholderLibrary(state) {
    const lists = Array.isArray(state?.lists) ? state.lists : [];
    if (lists.length !== 1) return false;
    const list = lists[0] || {};
    const trip = list.trip || {};
    const days = Array.isArray(trip.days) ? trip.days : [];
    if (days.length !== 1) return false;
    const day = days[0] || {};
    const activities = Array.isArray(day.activities) ? day.activities : [];
    const hasMembers = Array.isArray(state.members) && state.members.some((member) => String(member?.name || "").trim());
    const defaultNames = new Set(["", "新行程单", "我的行程单", "共享行程", "未命名行程单"]);
    const name = String(list.name || trip.tripTitle || "").trim();
    return !activities.length
      && !hasMembers
      && !String(day.location || "").trim()
      && !String(day.stay || "").trim()
      && !String(trip.originCity || "").trim()
      && defaultNames.has(name);
  }

  function setStatus(text) {
    const node = document.querySelector("#syncText");
    const state = document.querySelector("#syncState");
    if (node) node.textContent = text;
    state?.classList.toggle("offline", true);
    state?.classList.toggle("connected", false);
  }
})();