(() => {
  "use strict";

  const original = {
    getItem: Storage.prototype.getItem,
    setItem: Storage.prototype.setItem,
  };
  const blockedReads = [];
  const blockedWrites = [];

  function isTripDataKey(key) {
    const value = String(key || "");
    if (value.startsWith("trip-planner-library:")) return true;
    if (value.startsWith("trip-planner-recovery:")) return true;
    if (value.startsWith("trip-planner:") && value !== "trip-planner:client-id" && value !== "trip-planner:member-name") return true;
    return false;
  }

  Storage.prototype.getItem = function cloudOnlyGetItem(key) {
    if ((this === window.localStorage || this === window.sessionStorage) && isTripDataKey(key)) {
      blockedReads.push(String(key || ""));
      return null;
    }
    return original.getItem.call(this, key);
  };

  Storage.prototype.setItem = function cloudOnlySetItem(key, value) {
    if ((this === window.localStorage || this === window.sessionStorage) && isTripDataKey(key)) {
      blockedWrites.push(String(key || ""));
      return undefined;
    }
    return original.setItem.call(this, key, value);
  };

  window.__TripCloudOnlyStorage = {
    cloudOnly: true,
    destructiveCleanup: false,
    blockedReads,
    blockedWrites,
    isTripDataKey,
  };
})();
