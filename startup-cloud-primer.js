(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = String(params.get("room") || "").trim();
  if (!roomId || location.protocol === "file:") return;

  const storageKey = `trip-planner-library:${roomId}`;
  const previousGetItem = Storage.prototype.getItem;
  let primedState = null;
  let primedRevision = 0;

  Storage.prototype.getItem = function startupCloudPrimedGetItem(key) {
    if ((this === window.localStorage || this === window.sessionStorage) && key === storageKey && primedState) {
      return JSON.stringify(primedState);
    }
    return previousGetItem.call(this, key);
  };

  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `/api/room-state?room=${encodeURIComponent(roomId)}&startup=${Date.now()}`, false);
    xhr.setRequestHeader("Cache-Control", "no-store");
    xhr.send();
    if (xhr.status >= 200 && xhr.status < 300) {
      const payload = JSON.parse(xhr.responseText || "{}");
      if (payload?.ok && payload?.state?.lists?.length) {
        primedState = payload.state;
        primedRevision = Number(payload.revision) || 0;
        window.__TripInitialRoomState = primedState;
        window.__TripInitialRoomRevision = primedRevision;
        window.__TripCloudAuthority = {
          ...(window.__TripCloudAuthority || {}),
          roomId,
          revision: primedRevision,
          source: "startup-primer",
          at: Date.now(),
          totalLists: Array.isArray(primedState.lists) ? primedState.lists.length : 0,
        };
      }
    }
  } catch (error) {
    window.__TripStartupCloudPrimerError = error?.message || "startup cloud prime failed";
  }
})();
