(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  const root = document.documentElement;
  root.classList.add("room-loading");

  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    root.classList.remove("room-loading");
  };

  // Never let a slow backend, a blocked storage API, or an enhancement-script
  // error leave the whole editor hidden. The editor remains usable with local
  // state while synchronization retries in the background.
  window.setTimeout(reveal, 2500);
  window.addEventListener("pageshow", () => window.setTimeout(reveal, 100));
  window.addEventListener("error", reveal, { once: true });
  window.addEventListener("unhandledrejection", reveal, { once: true });

  window.addEventListener("DOMContentLoaded", () => {
    const syncText = document.querySelector("#syncText");
    if (!syncText || !window.MutationObserver) {
      reveal();
      return;
    }

    const checkSyncState = () => {
      const text = syncText.textContent.trim();
      if (text && text !== "本地保存" && text !== "连接中") {
        observer.disconnect();
        reveal();
      }
    };

    const observer = new MutationObserver(checkSyncState);
    observer.observe(syncText, { childList: true, characterData: true, subtree: true });
    checkSyncState();
  });
})();
