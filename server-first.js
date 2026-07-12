(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  const libraryKey = `trip-planner-library:${roomId}`;

  // Keep a lightweight recovery snapshot, but never delete the browser cache
  // before the server has answered. The main app already fetches room state and
  // replaces the local view when authoritative server data is available.
  try {
    const cached = localStorage.getItem(libraryKey);
    if (cached) {
      sessionStorage.setItem(`${libraryKey}:recovery-snapshot`, cached.slice(0, 200000));
    }
    sessionStorage.setItem(`${libraryKey}:prefer-server`, "1");
  } catch {
    // Storage can be unavailable in private/restricted browser contexts. The
    // page must still continue loading normally.
  }
})();
