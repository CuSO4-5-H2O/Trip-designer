(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  let menu = null;
  let styleInstalled = false;

  function init() {
    document.addEventListener("click", handleDocumentClick, true);
    enhanceSoon();
    window.setTimeout(enhanceSoon, 300);
    window.setInterval(enhanceSoon, 1800);
  }

  function enhanceSoon() {
    const addButton = document.querySelector("#addListBtn");
    if (!addButton) return;
    installStyles();
    addButton.classList.add("list-plus-button");
    addButton.setAttribute("aria-label", "行程单操作");
    addButton.title = "新建、导入、恢复和导出";
    addButton.innerHTML = `<span aria-hidden="true">+</span>`;
    hideLegacyListButtons();
  }

  function handleDocumentClick(event) {
    const addButton = event.target.closest?.("#addListBtn");
    if (addButton && !addButton.dataset.plusBypass) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu(addButton);
      return;
    }

    const actionButton = event.target.closest?.("[data-plus-action]");
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionButton.dataset.plusAction;
      closeMenu();
      runAction(action);
      return;
    }

    if (menu && !event.target.closest?.(".list-plus-menu") && !event.target.closest?.("#addListBtn")) closeMenu();
  }

  function toggleMenu(anchor) {
    if (menu) return closeMenu();
    menu = document.createElement("div");
    menu.className = "list-plus-menu";
    menu.innerHTML = `
      <button type="button" data-plus-action="new-list"><strong>新建空白行程单</strong><span>创建一个新的独立 list</span></button>
      <button type="button" data-plus-action="document-import"><strong>从文档导入</strong><span>上传或粘贴文本生成新 list</span></button>
      <button type="button" data-plus-action="quick-import"><strong>快速导入</strong><span>城市 + 天数批量添加</span></button>
      <button type="button" data-plus-action="recover-local"><strong>恢复本机备份</strong><span>只在当前浏览器有旧缓存时可恢复</span></button>
      <button type="button" data-plus-action="export-list"><strong>导出当前行程单</strong><span>保存为本地 HTML</span></button>
    `;
    document.body.append(menu);
    positionMenu(anchor);
  }

  function positionMenu(anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    menu.style.width = `${width}px`;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 12)}px`;
  }

  function closeMenu() {
    menu?.remove();
    menu = null;
  }

  function runAction(action) {
    if (action === "new-list") return createNewList();
    if (action === "document-import") return openDocumentImport();
    if (action === "quick-import") return focusQuickImport();
    if (action === "recover-local") return restoreLocalBackups();
    if (action === "export-list") return exportCurrentList();
  }

  function createNewList() {
    const button = document.querySelector("#addListBtn");
    if (!button) return;
    button.dataset.plusBypass = "1";
    button.click();
    window.setTimeout(() => delete button.dataset.plusBypass, 0);
  }

  function openDocumentImport() {
    const panel = document.querySelector("#quickPlanPanel");
    panel?.classList.remove("is-collapsed");
    const importButton = document.querySelector("[data-doc-import]");
    if (importButton) return importButton.click();
    focusQuickImport();
    toast("文档导入正在加载，请稍后再试");
  }

  function focusQuickImport() {
    const panel = document.querySelector("#quickPlanPanel");
    panel?.classList.remove("is-collapsed");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    const textarea = document.querySelector("#quickPlanBatch");
    window.setTimeout(() => {
      textarea?.focus();
      textarea?.select?.();
    }, 160);
  }

  function restoreLocalBackups() {
    const candidates = collectRecoveryCandidates();
    if (!candidates.length) return toast("这个浏览器里没有可恢复的本机备份");
    const library = window.TripPlanner?.getLibrary?.();
    if (!library?.lists) return toast("行程数据还在加载，请稍后再试");
    const existing = new Set(library.lists.map((list) => listSignature(list)));
    const restored = [];
    for (const candidate of candidates) {
      for (const list of candidate.lists) {
        if (existing.has(listSignature(list))) continue;
        const next = remapList(list);
        existing.add(listSignature(next));
        restored.push(next);
      }
    }
    if (!restored.length) return toast("没有新的本机备份可恢复");
    library.lists.push(...restored);
    library.activeListId = restored[0].id;
    window.TripPlanner.saveExternalLibrary(library, "restore-local-itinerary-cache-plus-menu");
    toast(`已恢复 ${restored.length} 个本机行程单`);
  }

  function collectRecoveryCandidates() {
    const raw = [];
    const directKeys = [`trip-planner-library:${roomId}`, `trip-planner:${roomId}`];
    const originalGetItem = window.__TripStartupCacheGuard?.originalGetItem || Storage.prototype.getItem;
    for (const key of directKeys) {
      try { const value = originalGetItem.call(localStorage, key); if (value) raw.push({ key, value, source: "direct" }); } catch {}
      try { const value = sessionStorage.getItem(`${key}:ignored-before-render`); if (value) raw.push({ key: `${key}:session`, value, source: "session" }); } catch {}
    }
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(`trip-planner-recovery:${roomId}:`)) continue;
        const value = originalGetItem.call(localStorage, key);
        if (value) raw.push({ key, value, source: "local" });
      }
    } catch {}

    const seenRaw = new Set();
    const unique = [];
    for (const item of raw) {
      const fingerprint = rawFingerprint(item.value);
      if (seenRaw.has(fingerprint)) continue;
      seenRaw.add(fingerprint);
      unique.push(item);
    }
    unique.sort((a, b) => sourceRank(b.source) - sourceRank(a.source) || b.value.length - a.value.length);

    const seenLists = new Set();
    const candidates = [];
    for (const item of unique.slice(0, 80)) {
      let parsed;
      try { parsed = JSON.parse(item.value); } catch { continue; }
      const lists = extractLists(parsed);
      if (!lists.length) continue;
      const signature = JSON.stringify(lists.map((list) => [cleanName(list.name || list.trip?.tripTitle), list.trip?.days?.length || 0, countActivities(list)]));
      if (seenLists.has(signature)) continue;
      seenLists.add(signature);
      candidates.push({ ...item, lists });
    }
    return candidates;
  }

  function extractLists(parsed) {
    if (Array.isArray(parsed?.lists)) return parsed.lists.filter((list) => list?.trip?.days?.length);
    if (Array.isArray(parsed?.days)) return [{ id: crypto.randomUUID(), name: parsed.tripTitle || parsed.title || "本机旧行程", trip: parsed }];
    if (parsed?.trip?.days?.length) return [parsed];
    return [];
  }

  function remapList(source) {
    const stamp = Date.now();
    const list = clone(source);
    const dayIds = new Map();
    const activityIds = new Map();
    list.id = crypto.randomUUID();
    list.name = `本机恢复 - ${cleanName(list.name || list.trip?.tripTitle || "旧行程")}`;
    list.createdAt = stamp;
    list.updatedAt = stamp;
    list.trip = list.trip || { days: [] };
    list.trip.tripTitle = list.name;
    list.trip.updatedAt = stamp;
    list.trip.orderUpdatedAt = stamp;
    list.trip.days = (list.trip.days || []).map((day) => {
      const dayId = crypto.randomUUID();
      dayIds.set(day.id, dayId);
      const activities = (day.activities || []).map((activity) => {
        const activityId = crypto.randomUUID();
        activityIds.set(activity.id, activityId);
        return { ...activity, id: activityId, updatedAt: stamp };
      });
      return { ...day, id: dayId, activities, updatedAt: stamp, orderUpdatedAt: stamp };
    });
    list.trip.selectedDayId = dayIds.get(list.trip.selectedDayId) || list.trip.days[0]?.id || "";
    if (list.trip.budget?.items) {
      const nextItems = {};
      for (const [oldActivityId, value] of Object.entries(list.trip.budget.items)) {
        nextItems[activityIds.get(oldActivityId) || oldActivityId] = { ...(value || {}), updatedAt: stamp };
      }
      list.trip.budget.items = nextItems;
      list.trip.budget.updatedAt = stamp;
    }
    return list;
  }

  function exportCurrentList() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    if (!list) return toast("没有可导出的行程单");
    const payload = { type: "tripdesigner-list-export", version: 2, exportedAt: new Date().toISOString(), list };
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(list.name || "行程导出")}</title></head><body><h1>${escapeHtml(list.name || "行程导出")}</h1><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre><script id="tripdesigner-export-data" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(list.name || "trip-list")}.html`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function hideLegacyListButtons() {
    document.querySelectorAll("[data-local-recovery], [data-local-recovery-empty], .list-lite-actions").forEach((node) => {
      node.style.display = "none";
    });
    const docImport = document.querySelector("[data-doc-import]");
    if (docImport) docImport.style.display = "none";
  }

  function sourceRank(source) { return source === "direct" ? 3 : source === "session" ? 2 : 1; }
  function rawFingerprint(value) { value = String(value || ""); return `${value.length}:${value.slice(0, 512)}:${value.slice(-512)}`; }
  function cleanName(name) { return String(name || "").replace(/^(本机恢复 -\s*)+/g, "").replace(/^(冲突备份 -\s*)+/g, "历史备份 - ").trim() || "旧行程"; }
  function countActivities(list) { return (list.trip?.days || []).reduce((sum, day) => sum + (day.activities?.length || 0), 0); }
  function listSignature(list) { return [cleanName(list.name || list.trip?.tripTitle), list.trip?.days?.length || 0, countActivities(list)].join("|"); }
  function clone(value) { try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); } }
  function safeFileName(value) { return String(value || "trip-list").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
  function toast(text) { const node = document.querySelector("#toast"); if (!node) return; node.textContent = text; node.classList.add("show"); window.setTimeout(() => node.classList.remove("show"), 2200); }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "listPlusMenuStyles";
    style.textContent = `
      #addListBtn.list-plus-button{width:42px;min-width:42px;height:42px;padding:0;border-radius:12px;font-size:24px;font-weight:920;line-height:1;display:inline-grid;place-items:center}#addListBtn.list-plus-button svg{display:none}.list-plus-menu{position:fixed;z-index:100;display:grid;gap:6px;padding:8px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(23,33,31,.18)}.list-plus-menu button{display:grid;gap:2px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:transparent;color:var(--ink);text-align:left;cursor:pointer}.list-plus-menu button:hover,.list-plus-menu button:focus-visible{outline:none;background:var(--teal-soft)}.list-plus-menu strong{font-size:14px;font-weight:900}.list-plus-menu span{color:var(--muted);font-size:12px;font-weight:720}@media(max-width:780px){.list-plus-menu{left:12px!important;right:12px;width:auto!important;top:auto!important;bottom:14px}.list-plus-menu button{padding:13px 14px}.list-plus-menu strong{font-size:16px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
