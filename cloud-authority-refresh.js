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
      const localState = planner.getLibrary?.();
      const localSignature = signature(localState);
      appliedSignature = cloudSignature;
      if (localSignature !== cloudSignature) {
        if (hasPendingLocalEdits() || localLooksNewerOrRicher(localState, state, Number(payload.revision) || 0)) {
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
    if (pending?.roomId === roomId && pending.pending && Date.now() - Number(pending.at || 0) < 1000 * 60 * 5) return true;
    const status = document.querySelector("#syncText")?.textContent || "";
    return /本地待同步|正在保存|云端同步失败/.test(status);
  }

  function localLooksNewerOrRicher(localState, cloudState, cloudRevision) {
    if (!localState || !cloudState) return false;
    const local = summarizeState(localState);
    const cloud = summarizeState(cloudState);
    const currentRevision = Number(window.TripPlanner?.getRevision?.() || window.__TripCloudAuthority?.revision || 0);
    const cloudIsNotNewer = !cloudRevision || cloudRevision <= currentRevision;
    if (!local.hasUserContent) return false;
    if (cloudIsNotNewer && local.activities > cloud.activities) return true;
    if (cloudIsNotNewer && local.days > cloud.days && local.activities >= cloud.activities) return true;
    if (cloudIsNotNewer && local.maxUpdatedAt > cloud.maxUpdatedAt && local.activities >= cloud.activities) return true;
    return false;
  }

  function summarizeState(state) {
    const lists = Array.isArray(state?.lists) ? state.lists : [];
    let days = 0;
    let activities = 0;
    let maxUpdatedAt = Number(state?.updatedAt || 0) || 0;
    let hasUserContent = false;
    for (const list of lists) {
      maxUpdatedAt = Math.max(maxUpdatedAt, Number(list?.updatedAt || 0) || 0, Number(list?.trip?.updatedAt || 0) || 0);
      for (const day of list?.trip?.days || []) {
        days += 1;
        maxUpdatedAt = Math.max(maxUpdatedAt, Number(day?.updatedAt || 0) || 0, Number(day?.orderUpdatedAt || 0) || 0);
        if (String(day?.location || "").trim() || String(day?.stay || "").trim()) hasUserContent = true;
        for (const activity of day?.activities || []) {
          activities += 1;
          maxUpdatedAt = Math.max(maxUpdatedAt, Number(activity?.updatedAt || 0) || 0);
          if (String(activity?.title || "").trim() || String(activity?.place || "").trim() || String(activity?.note || "").trim()) hasUserContent = true;
        }
      }
    }
    return { days, activities, maxUpdatedAt, hasUserContent };
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
