(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId || location.protocol === "file:") return;

  let styleInstalled = false;

  function init() {
    installStyles();
    window.setTimeout(checkRoom, 1000);
    window.addEventListener("pageshow", checkRoom);
  }

  async function checkRoom() {
    try {
      const response = await fetch(`/api/room-state?room=${encodeURIComponent(roomId)}&t=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return;
      if (hasRealLists(payload.state)) {
        removeWarning();
        return;
      }
      showWarning();
    } catch {}
  }

  function hasRealLists(state) {
    return Array.isArray(state?.lists) && state.lists.some((list) => Array.isArray(list?.trip?.days) && list.trip.days.length > 0);
  }

  function showWarning() {
    if (document.querySelector(".room-empty-warning")) return;
    const warning = document.createElement("div");
    warning.className = "room-empty-warning";
    warning.innerHTML = `<strong>当前协作链接没有云端行程</strong><span>这个 room 是 ${escapeHtml(roomId)}。手机和电脑必须打开同一个 room 链接才会实时同步。</span><button type="button" aria-label="关闭提示">×</button>`;
    warning.querySelector("button").onclick = removeWarning;
    document.body.append(warning);
  }

  function removeWarning() {
    document.querySelector(".room-empty-warning")?.remove();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "roomStatusWarningStyles";
    style.textContent = `
      .room-empty-warning{position:fixed;left:50%;bottom:18px;z-index:130;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;width:min(520px,calc(100vw - 28px));padding:12px 12px 12px 14px;border:1px solid rgba(239,115,95,.32);border-radius:12px;background:#fff7f4;color:var(--ink);box-shadow:0 22px 60px rgba(23,33,31,.18);transform:translateX(-50%)}.room-empty-warning strong{font-size:14px;font-weight:920}.room-empty-warning span{grid-column:1;color:var(--muted);font-size:12px;font-weight:760;line-height:1.4}.room-empty-warning button{grid-column:2;grid-row:1 / span 2;width:34px;height:34px;border:0;border-radius:10px;background:#fff;color:#bb3d2d;font-size:22px;line-height:1}@media(max-width:780px){.room-empty-warning{bottom:12px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
