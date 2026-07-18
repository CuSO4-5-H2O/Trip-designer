(() => {
  "use strict";

  if (!new URLSearchParams(location.search).get("room") || location.protocol === "file:") return;

  let done = false;
  let timer = 0;

  document.documentElement.classList.add("trip-cloud-hydrating");
  installStyles();
  waitUntilReady();

  function waitUntilReady() {
    if (done) return;
    const ready = window.__TripCloudSyncGuard?.isReady?.() || window.__TripCloudAuthority?.roomId;
    if (ready) {
      done = true;
      document.documentElement.classList.remove("trip-cloud-hydrating");
      return;
    }
    timer = window.setTimeout(waitUntilReady, 80);
  }

  window.addEventListener("beforeunload", () => clearTimeout(timer));

  function installStyles() {
    if (document.querySelector("#cloudReadyUiGuardStyles")) return;
    const style = document.createElement("style");
    style.id = "cloudReadyUiGuardStyles";
    style.textContent = `
      .trip-cloud-hydrating .workspace{pointer-events:none;filter:saturate(.82);opacity:.62}
      .trip-cloud-hydrating .timeline-section::before{content:"正在载入云端行程...";display:block;margin:0 0 12px;padding:12px 14px;border:1px solid rgba(15,143,131,.22);border-radius:8px;background:#e9f8f5;color:#087169;font-weight:900}
    `;
    document.head.append(style);
  }
})();