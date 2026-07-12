(() => {
  installOptimizedMutationObserver();

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  document.documentElement.classList.add("room-loading");
  window.addEventListener("DOMContentLoaded", () => {
    const syncText = document.querySelector("#syncText");
    if (!syncText) {
      document.documentElement.classList.remove("room-loading");
      return;
    }

    const reveal = () => {
      const text = syncText.textContent.trim();
      if (text && text !== "\u672c\u5730\u4fdd\u5b58" && text !== "\u8fde\u63a5\u4e2d") {
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
