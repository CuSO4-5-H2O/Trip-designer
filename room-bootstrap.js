(() => {
  installOptimizedMutationObserver();

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  const storageKey = `trip-planner-library:${roomId}`;
  const legacyStorageKey = `trip-planner:${roomId}`;
  const isTokyoExample = (value) => {
    try {
      const data = typeof value === "string" ? JSON.parse(value) : value;
      if (!data) return false;
      if (data.tripTitle === "东京春日行") return true;
      return Array.isArray(data.lists) && data.lists.some((list) => list?.trip?.tripTitle === "东京春日行");
    } catch {
      return false;
    }
  };

  const existing = localStorage.getItem(storageKey);
  const legacy = localStorage.getItem(legacyStorageKey);
  if (existing && isTokyoExample(existing)) localStorage.removeItem(storageKey);
  if (legacy && isTokyoExample(legacy)) localStorage.removeItem(legacyStorageKey);

  if (!localStorage.getItem(storageKey)) {
    const now = Date.now();
    const dayId = crypto.randomUUID();
    const listId = crypto.randomUUID();
    const blankLibrary = {
      version: 2,
      activeListId: listId,
      lists: [{
        id: listId,
        name: "新行程单",
        trip: {
          version: 1,
          tripTitle: "新行程单",
          startDate: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
          originCity: "",
          selectedDayId: dayId,
          dayLimit: 30,
          updatedAt: now,
          days: [{ id: dayId, location: "", stay: "", activities: [] }],
        },
        createdAt: now,
        updatedAt: now,
      }],
      updatedAt: now,
    };
    localStorage.setItem(storageKey, JSON.stringify(blankLibrary));
  }

  document.documentElement.classList.add("room-loading");
  window.addEventListener("DOMContentLoaded", () => {
    const syncText = document.querySelector("#syncText");
    if (!syncText) {
      document.documentElement.classList.remove("room-loading");
      return;
    }

    const reveal = () => {
      const text = syncText.textContent.trim();
      const title = document.querySelector("#tripTitle")?.value?.trim();
      if ((text === "已同步" || text === "离线保存" || text === "同步失败") && title !== "东京春日行") {
        document.documentElement.classList.remove("room-loading");
        observer.disconnect();
      }
    };

    const observer = new MutationObserver(reveal);
    observer.observe(syncText, { childList: true, characterData: true, subtree: true });
    reveal();
    window.setTimeout(() => document.documentElement.classList.remove("room-loading"), 8000);
  });

  function installOptimizedMutationObserver() {
    if (window.__tripDesignerMutationObserverOptimized) return;
    const NativeMutationObserver = window.MutationObserver;
    if (!NativeMutationObserver) return;

    class OptimizedMutationObserver {
      constructor(callback) {
        this.callback = callback;
        this.nativeObserver = new NativeMutationObserver((records) => callback(records, this));
      }

      observe(target, options = {}) {
        let observedTarget = target;
        let observedOptions = { ...options };

        // Several optional feature scripts used to observe the entire app shell.
        // Their own DOM writes then triggered another full render indefinitely.
        // All itinerary changes replace the direct children of #dayList, so that
        // is the only mutation surface those scripts need to watch.
        if (target?.classList?.contains("app-shell")) {
          const dayList = document.querySelector("#dayList");
          if (dayList) {
            observedTarget = dayList;
            observedOptions = { childList: true, subtree: false };
          }
        } else if (target?.id === "dayList" && observedOptions.childList) {
          observedOptions = { childList: true, subtree: false };
        }

        return this.nativeObserver.observe(observedTarget, observedOptions);
      }

      disconnect() {
        return this.nativeObserver.disconnect();
      }

      takeRecords() {
        return this.nativeObserver.takeRecords();
      }
    }

    window.MutationObserver = OptimizedMutationObserver;
    window.__tripDesignerMutationObserverOptimized = true;
  }
})();
