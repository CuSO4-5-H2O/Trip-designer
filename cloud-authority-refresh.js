(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  const storageKey = `trip-planner-library:${roomId}`;
  let appliedSignature = "";
  let styleInstalled = false;

  function init() {
    installStyles();
    refreshFromCloud("startup");
    window.setTimeout(() => refreshFromCloud("settle"), 1800);
    window.addEventListener("pageshow", () => refreshFromCloud("pageshow"));
  }

  async function refreshFromCloud(reason) {
    try {
      const response = await fetch(`/api/room-state?room=${encodeURIComponent(roomId)}&t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      const state = payload?.state;
      if (!response.ok || !payload.ok || !hasRealLists(state)) return;
      const cloudSignature = signature(state);
      if (cloudSignature === appliedSignature) return;
      const planner = await waitForPlanner();
      const localSignature = signature(planner.getLibrary?.());
      appliedSignature = cloudSignature;
      if (localSignature !== cloudSignature) {
        if (hasPendingLocalEdits()) {
          markCloudReady(state, payload.revision);
          return;
        }
        applyCloudStateLocally(state, Number(payload.revision) || 0, reason);
        toast("已从云端载入最新行程");
      }
      markCloudReady(state, payload.revision);
    } catch (error) {
      console.warn("Cloud authority refresh failed", error);
    }
  }

  function hasPendingLocalEdits() {
    const pending = window.__TripPendingLocalSave;
    if (pending?.roomId === roomId && pending.pending && Date.now() - Number(pending.at || 0) < 1000 * 60 * 3) return true;
    const status = document.querySelector("#syncText")?.textContent || "";
    return /本地待同步|正在保存|云端同步失败/.test(status);
  }

  function applyCloudStateLocally(state, revision, reason) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(storageKey);
    channel.postMessage({
      type: "library",
      clientId: "cloud-authority-refresh",
      library: state,
      revision,
      reason: `cloud-authority-${reason}`,
    });
    window.setTimeout(() => channel.close(), 500);
  }

  function waitForPlanner() {
    if (window.TripPlanner?.getLibrary) return Promise.resolve(window.TripPlanner);
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.TripPlanner?.getLibrary) {
          window.clearInterval(timer);
          resolve(window.TripPlanner);
        } else if (Date.now() - startedAt > 8000) {
          window.clearInterval(timer);
          reject(new Error("TripPlanner store not ready"));
        }
      }, 80);
    });
  }

  function hasRealLists(state) {
    return Array.isArray(state?.lists) && state.lists.some((list) => Array.isArray(list?.trip?.days) && list.trip.days.length > 0);
  }

  function signature(state) {
    const lists = Array.isArray(state?.lists) ? state.lists : [];
    return JSON.stringify(lists.map((list) => ({
      id: list.id,
      name: list.name || list.trip?.tripTitle || "",
      active: state?.activeListId || "",
      days: (list.trip?.days || []).map((day) => ({
        id: day.id,
        location: day.location || "",
        stay: day.stay || "",
        activities: (day.activities || []).map((activity) => [activity.id, activity.time || "", activity.title || "", activity.place || "", activity.updatedAt || 0]),
        updatedAt: day.updatedAt || 0,
        orderUpdatedAt: day.orderUpdatedAt || 0,
      })),
      updatedAt: list.updatedAt || 0,
    })));
  }

  function markCloudReady(state, revision) {
    const totalDays = state.lists.reduce((sum, list) => sum + (list.trip?.days?.length || 0), 0);
    const totalActivities = state.lists.reduce((sum, list) => sum + (list.trip?.days || []).reduce((inner, day) => inner + (day.activities?.length || 0), 0), 0);
    window.__TripCloudAuthority = { roomId, revision, totalDays, totalActivities, at: Date.now() };
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1800);
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "cloudAuthorityRefreshStyles";
    style.textContent = `
      @media(max-width:780px){.day-card:not(.active) .day-content{display:none!important}.day-card:not(.active){box-shadow:none}.activity-row{min-height:54px}.day-card-add-floating{position:absolute!important}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
