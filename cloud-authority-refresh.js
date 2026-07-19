(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  let appliedSignature = "";
  let styleInstalled = false;

  function init() {
    installStyles();
    refreshFromCloud("startup");
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
      appliedSignature = cloudSignature;
      markCloudReady(state, payload.revision, reason);
    } catch (error) {
      console.warn("Cloud authority refresh failed", error);
    }
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

  function markCloudReady(state, revision, reason = "refresh") {
    const totalDays = state.lists.reduce((sum, list) => sum + (list.trip?.days?.length || 0), 0);
    const totalActivities = state.lists.reduce((sum, list) => sum + (list.trip?.days || []).reduce((inner, day) => inner + (day.activities?.length || 0), 0), 0);
    window.__TripCloudAuthority = { roomId, revision, totalDays, totalActivities, reason, at: Date.now() };
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
