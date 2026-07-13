(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  const keys = [
    `trip-planner-library:${roomId}`,
    `trip-planner:${roomId}`,
  ];

  for (const key of keys) {
    try {
      const cached = localStorage.getItem(key);
      if (cached) sessionStorage.setItem(`${key}:ignored-before-render`, cached.slice(0, 200000));
    } catch {}
    try { localStorage.removeItem(key); } catch {}
  }
})();
