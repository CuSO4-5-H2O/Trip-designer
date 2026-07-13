(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:" || !window.WebSocket) return;

  const startedAt = Date.now();
  const originalSend = WebSocket.prototype.send;
  const stats = { strippedJoinState: 0, blockedStartupState: 0 };

  window.__TripCloudSyncGuard = { roomId, startedAt, stats };

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

    if (message?.type === "state" && isStartupPlaceholderState(message.state, message.reason)) {
      stats.blockedStartupState += 1;
      return;
    }

    return originalSend.call(this, payload);
  };

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
})();
