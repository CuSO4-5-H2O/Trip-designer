(() => {
  "use strict";

  const PENDING_TEXT = "本地待同步 · 点击立即保存";
  let observer = null;
  let timer = 0;

  function init() {
    installStyles();
    bindSyncButton();
    observeSyncText();
    timer = window.setInterval(guardPendingStatus, 700);
    window.addEventListener("beforeunload", () => window.clearInterval(timer));
    guardPendingStatus();
  }

  function currentRoomId() {
    return new URLSearchParams(location.search).get("room") || window.TripRoom?.id || "";
  }

  function hasPendingLocalSave() {
    const pending = window.__TripPendingLocalSave;
    const roomId = currentRoomId();
    return Boolean(pending?.pending && pending.roomId === roomId && Date.now() - Number(pending.at || 0) < 1000 * 90);
  }

  function guardPendingStatus() {
    if (!hasPendingLocalSave()) return;
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (!syncText || !syncState) return;
    if (syncText.textContent.trim() !== PENDING_TEXT) syncText.textContent = PENDING_TEXT;
    syncState.classList.add("offline", "mobile-sync-pending");
    syncState.classList.remove("connected");
  }

  function markSaved() {
    const roomId = currentRoomId();
    if (roomId) window.__TripPendingLocalSave = { roomId, at: Date.now(), pending: false };
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText) syncText.textContent = "已保存到云端";
    syncState?.classList.remove("offline", "mobile-sync-pending");
    syncState?.classList.add("connected");
  }

  function bindSyncButton() {
    const syncState = document.querySelector("#syncState");
    if (!syncState || syncState.dataset.mobileSyncGuard === "1") return;
    syncState.dataset.mobileSyncGuard = "1";
    syncState.setAttribute("role", "button");
    syncState.setAttribute("tabindex", "0");
    syncState.title = "点击立即保存到 GitHub 云端数据";
    syncState.addEventListener("click", () => flushNow());
    syncState.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      flushNow();
    });
  }

  async function flushNow() {
    const syncText = document.querySelector("#syncText");
    if (syncText && hasPendingLocalSave()) syncText.textContent = "正在保存到云端";
    try {
      if (typeof window.TripDesignerFlushSync === "function") {
        const ok = await window.TripDesignerFlushSync("mobile-sync-click");
        if (ok !== false) markSaved();
      }
    } finally {
      window.setTimeout(guardPendingStatus, 250);
    }
  }

  function observeSyncText() {
    const syncText = document.querySelector("#syncText");
    if (!syncText || observer) return;
    observer = new MutationObserver(guardPendingStatus);
    observer.observe(syncText, { childList: true, characterData: true, subtree: true });
  }

  function installStyles() {
    if (document.querySelector("#mobileSyncStatusGuardStyles")) return;
    const style = document.createElement("style");
    style.id = "mobileSyncStatusGuardStyles";
    style.textContent = `
      @media (max-width: 780px) {
        body { padding-bottom: max(72px, env(safe-area-inset-bottom)); }
        #syncState {
          position: fixed !important;
          left: 12px !important;
          right: 12px !important;
          bottom: calc(10px + env(safe-area-inset-bottom)) !important;
          top: auto !important;
          z-index: 2500 !important;
          width: auto !important;
          max-width: none !important;
          min-height: 46px !important;
          display: inline-flex !important;
          justify-content: center !important;
          align-items: center !important;
          padding: 0 14px !important;
          border-radius: 14px !important;
          box-shadow: 0 16px 40px rgba(23, 33, 31, 0.18) !important;
          backdrop-filter: blur(14px) !important;
          cursor: pointer !important;
        }
        #syncState #syncText {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          max-width: calc(100vw - 70px) !important;
        }
        #syncState.mobile-sync-pending {
          border-color: rgba(182, 58, 40, 0.28) !important;
          background: #fff5f1 !important;
          color: #b63a28 !important;
        }
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();