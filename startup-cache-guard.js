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
    const fingerprint = fingerprintText(cached);
    const backupKey = `trip-planner-recovery:${roomId}:${fingerprint}`;
    backups.push({ key, backupKey, length: cached.length, fingerprint });
    try { sessionStorage.setItem(`${key}:ignored-before-render`, cached.slice(0, 500000)); } catch {}
    try {
      if (!originalGetItem.call(localStorage, backupKey)) localStorage.setItem(backupKey, cached);
    } catch {}
  }

  window.__TripStartupCacheGuard = {
    roomId,
    backups,
    allowLocalStartupCache: false,
    originalGetItem,
    cloudRoomAuthoritative: true,
  };

  Storage.prototype.getItem = function guardedGetItem(key) {
    if (this === localStorage && hiddenKeys.has(String(key)) && !window.__TripStartupCacheGuard?.allowLocalStartupCache) {
      return null;
    }
    return originalGetItem.call(this, key);
  };

  // In shared cloud rooms the server must be the first visible source of truth.
  // Local startup cache remains available through the recovery menu, but it is
  // never used automatically for the initial render. This prevents stale trips
  // from flashing before the server state arrives.
  window.TripDesignerAllowLocalStartupCache = () => {
    if (window.__TripStartupCacheGuard) window.__TripStartupCacheGuard.allowLocalStartupCache = true;
  };

  function fingerprintText(text) {
    const value = String(text || "");
    let hash = 2166136261;
    const sample = `${value.length}:${value.slice(0, 2048)}:${value.slice(-2048)}`;
    for (let index = 0; index < sample.length; index += 1) {
      hash ^= sample.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
})();
