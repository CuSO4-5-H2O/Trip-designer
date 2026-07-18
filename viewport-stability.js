(() => {
  "use strict";

  const STABLE_CLICK_SELECTOR = [
    ".day-card-add-floating",
    ".inline-empty-add",
    ".activity-row [data-select-field]",
    "[data-day-field]",
    ".edit-activity",
  ].join(",");
  const INLINE_EDITOR_SELECTOR = "#dayList .inline-activity-input,#dayList .inline-compound-editor,#dayList .inline-compound-editor *";

  let restoring = false;
  let plannerWrapped = false;

  function shouldProtect(node) {
    return Boolean(node?.closest?.("#dayList"));
  }

  function currentRoomId() {
    return new URLSearchParams(location.search).get("room") || window.TripRoom?.id || "";
  }

  function markPendingLocalSave() {
    const roomId = currentRoomId();
    if (!roomId) return;
    window.__TripPendingLocalSave = { roomId, at: Date.now(), pending: true };
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText && !/正在保存|已保存|本地待同步/.test(syncText.textContent || "")) {
      syncText.textContent = "本地待同步 · 1 分钟内自动保存";
    }
    syncState?.classList.toggle("connected", false);
    syncState?.classList.toggle("offline", true);
  }

  function wrapPlannerSave() {
    if (plannerWrapped) return true;
    const planner = window.TripPlanner;
    if (!planner?.saveExternalLibrary) return false;
    const original = planner.saveExternalLibrary.bind(planner);
    planner.saveExternalLibrary = function guardedSaveExternalLibrary(next, reason) {
      markPendingLocalSave();
      return original(next, reason);
    };
    plannerWrapped = true;
    return true;
  }

  function waitForPlanner() {
    if (wrapPlannerSave()) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (wrapPlannerSave() || tries > 120) window.clearInterval(timer);
    }, 100);
  }

  function loadMobileSyncGuard() {
    if (document.querySelector("script[data-mobile-sync-status-guard]")) return;
    const script = document.createElement("script");
    script.src = "./mobile-sync-status-guard.js?v=render-20260719c";
    script.defer = true;
    script.dataset.mobileSyncStatusGuard = "1";
    document.head.append(script);
  }

  function captureViewport() {
    const x = window.scrollX || 0;
    const y = window.scrollY || 0;
    return () => restoreViewport(x, y);
  }

  function restoreSoon(restore) {
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 90);
    window.setTimeout(restore, 220);
    window.setTimeout(restore, 420);
  }

  function restoreViewport(x, y) {
    if (restoring) return;
    restoring = true;
    let tick = 0;
    const restore = () => {
      if (Math.abs((window.scrollY || 0) - y) > 1 || Math.abs((window.scrollX || 0) - x) > 1) {
        window.scrollTo(x, y);
      }
    };
    const frame = () => {
      restore();
      tick += 1;
      if (tick < 5) window.requestAnimationFrame(frame);
      else restoring = false;
    };
    restore();
    window.requestAnimationFrame(frame);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 90);
    window.setTimeout(restore, 220);
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.(STABLE_CLICK_SELECTOR);
    if (!target || !shouldProtect(target)) return;
    const restore = captureViewport();
    if (target.matches(".day-card-add-floating,.inline-empty-add,.edit-activity,[data-day-field]") || target.closest(".activity-row [data-select-field]")) {
      markPendingLocalSave();
    }
    restoreSoon(restore);
  }, true);

  document.addEventListener("keydown", (event) => {
    if (!["Enter", "Escape"].includes(event.key)) return;
    const target = event.target.closest?.(INLINE_EDITOR_SELECTOR);
    if (!target || !shouldProtect(target)) return;
    const restore = captureViewport();
    restoreSoon(restore);
  }, true);

  document.addEventListener("focusout", (event) => {
    const target = event.target.closest?.(INLINE_EDITOR_SELECTOR);
    if (!target || !shouldProtect(target)) return;
    const restore = captureViewport();
    restoreSoon(restore);
  }, true);

  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function patchedFocus(options) {
    if (!shouldProtect(this)) return nativeFocus.call(this, options);
    const restore = captureViewport();
    try {
      return nativeFocus.call(this, { ...(options || {}), preventScroll: true });
    } finally {
      restore();
    }
  };

  const inputSelect = HTMLInputElement.prototype.select;
  HTMLInputElement.prototype.select = function patchedInputSelect() {
    if (!shouldProtect(this)) return inputSelect.call(this);
    const restore = captureViewport();
    try {
      return inputSelect.call(this);
    } finally {
      restore();
    }
  };

  const textAreaSelect = HTMLTextAreaElement.prototype.select;
  HTMLTextAreaElement.prototype.select = function patchedTextAreaSelect() {
    if (!shouldProtect(this)) return textAreaSelect.call(this);
    const restore = captureViewport();
    try {
      return textAreaSelect.call(this);
    } finally {
      restore();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      waitForPlanner();
      loadMobileSyncGuard();
    }, { once: true });
  } else {
    waitForPlanner();
    loadMobileSyncGuard();
  }
})();