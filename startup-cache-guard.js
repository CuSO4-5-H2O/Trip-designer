(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  const keys = [
    `trip-planner-library:${roomId}`,
    `trip-planner:${roomId}`,
  ];
  const hiddenKeys = new Set(keys);
  const backups = [];
  const originalGetItem = Storage.prototype.getItem;

  for (const key of keys) {
    let cached = "";
    try { cached = originalGetItem.call(localStorage, key) || ""; } catch {}
    if (!cached) continue;
    const backupKey = `trip-planner-recovery:${roomId}:${Date.now()}:${backups.length}`;
    backups.push({ key, backupKey, length: cached.length });
    try { sessionStorage.setItem(`${key}:ignored-before-render`, cached.slice(0, 500000)); } catch {}
    try { localStorage.setItem(backupKey, cached); } catch {}
  }

  window.__TripStartupCacheGuard = {
    roomId,
    backups,
    allowLocalStartupCache: false,
    originalGetItem,
  };

  Storage.prototype.getItem = function guardedGetItem(key) {
    if (this === localStorage && hiddenKeys.has(String(key)) && !window.__TripStartupCacheGuard?.allowLocalStartupCache) {
      return null;
    }
    return originalGetItem.call(this, key);
  };

  window.setTimeout(() => {
    if (window.__TripStartupCacheGuard) window.__TripStartupCacheGuard.allowLocalStartupCache = true;
  }, 10000);
})();
