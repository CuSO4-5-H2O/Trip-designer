(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  const libraryKey = `trip-planner-library:${roomId}`;
  const legacyKey = `trip-planner:${roomId}`;

  try {
    const cached = localStorage.getItem(libraryKey);
    if (cached) sessionStorage.setItem(`${libraryKey}:ignored-local-cache`, cached.slice(0, 200000));
  } catch {}

  try { localStorage.removeItem(libraryKey); } catch {}
  try { localStorage.removeItem(legacyKey); } catch {}
})();
