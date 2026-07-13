(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  const MAX_PARSE_CANDIDATES = 14;
  let installed = false;

  function init() {
    waitForStore(0);
  }

  function waitForStore(attempt) {
    if (window.TripPlanner?.getLibrary && document.querySelector(".list-panel .section-heading")) {
      installRecoveryButton();
      return;
    }
    if (attempt > 80) return;
    window.setTimeout(() => waitForStore(attempt + 1), 125);
  }

  function installRecoveryButton() {
    if (installed) return;
    const candidates = collectCandidates();
    const heading = document.querySelector(".list-panel .section-heading");
    if (!heading || heading.querySelector("[data-local-recovery]")) return;
    if (!candidates.length) {
      installRecoveryStatus(heading);
      return;
    }
    installed = true;
    const button = document.createElement("button");
    button.className = "mini-action";
    button.type = "button";
    button.dataset.localRecovery = "1";
    button.textContent = `恢复本机行程 ${candidates.length}`;
    button.title = "把浏览器本机缓存中的旧行程恢复为新的 list，不覆盖服务器当前数据";
    button.addEventListener("click", () => restoreCandidates(candidates));
    heading.append(button);
  }

  function installRecoveryStatus(heading) {
    if (heading.querySelector("[data-local-recovery-empty]")) return;
    const button = document.createElement("button");
    button.className = "mini-action muted";
    button.type = "button";
    button.dataset.localRecoveryEmpty = "1";
    button.textContent = "无本机备份";
    button.title = "当前浏览器没有可恢复的本机旧行程缓存；云端只显示服务器已保存的数据";
    heading.append(button);
  }

  function collectCandidates() {
    const raw = collectRawBackups();
    const seenRaw = new Set();
    const uniqueRaw = [];
    for (const item of raw) {
      const key = rawFingerprint(item.value);
      if (seenRaw.has(key)) continue;
      seenRaw.add(key);
      uniqueRaw.push({ ...item, rawScore: item.value.length });
    }
    uniqueRaw.sort((a, b) => sourceRank(b.source) - sourceRank(a.source) || b.rawScore - a.rawScore);

    const seen = new Set();
    const candidates = [];
    for (const item of uniqueRaw.slice(0, MAX_PARSE_CANDIDATES)) {
      let parsed;
      try { parsed = JSON.parse(item.value); } catch { continue; }
      const lists = extractLists(parsed);
      if (!lists.length) continue;
      const score = lists.reduce((sum, list) => sum + (list.trip?.days?.length || 0) + countActivities(list) * 3, 0);
      const signature = JSON.stringify(lists.map((list) => [cleanName(list.name || list.trip?.tripTitle), list.trip?.days?.length || 0, countActivities(list)]));
      if (seen.has(signature)) continue;
      seen.add(signature);
      candidates.push({ ...item, lists, score });
    }
    candidates.sort((a, b) => b.score - a.score || b.rawScore - a.rawScore);
    return candidates;
  }

  function collectRawBackups() {
    const raw = [];
    const directKeys = [
      `trip-planner-library:${roomId}`,
      `trip-planner:${roomId}`,
    ];
    const sessionKeys = directKeys.map((key) => `${key}:ignored-before-render`);
    const originalGetItem = window.__TripStartupCacheGuard?.originalGetItem || Storage.prototype.getItem;

    for (const key of directKeys) {
      try {
        const value = originalGetItem.call(localStorage, key);
        if (value) raw.push({ key, value, source: "direct" });
      } catch {}
    }
    for (const key of sessionKeys) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) raw.push({ key, value, source: "session" });
      } catch {}
    }
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(`trip-planner-recovery:${roomId}:`)) continue;
        const value = originalGetItem.call(localStorage, key);
        if (value) raw.push({ key, value, source: "local" });
      }
    } catch {}
    return raw;
  }

  function extractLists(parsed) {
    if (Array.isArray(parsed?.lists)) return parsed.lists.filter((list) => list?.trip?.days?.length);
    if (Array.isArray(parsed?.days)) {
      return [{ id: crypto.randomUUID(), name: parsed.tripTitle || parsed.title || "本机旧行程", trip: parsed }];
    }
    if (parsed?.trip?.days?.length) return [parsed];
    return [];
  }

  function restoreCandidates(candidates) {
    const library = window.TripPlanner?.getLibrary?.();
    if (!library?.lists) return showToast("当前行程库尚未加载");
    const existing = new Set(library.lists.map((list) => listSignature(list)));
    const restored = [];
    for (const candidate of candidates) {
      for (const list of candidate.lists) {
        if (existing.has(listSignature(list))) continue;
        const next = remapList(list);
        existing.add(listSignature(list));
        restored.push(next);
      }
    }
    if (!restored.length) return showToast("没有新的本机行程可恢复");
    library.lists.push(...restored);
    library.activeListId = restored[0].id;
    window.TripPlanner.saveExternalLibrary(library, "restore-local-itinerary-cache");
    showToast(`已恢复 ${restored.length} 个本机行程单`);
    document.querySelector("[data-local-recovery]")?.remove();
    document.querySelector("[data-local-recovery-empty]")?.remove();
  }

  function remapList(source) {
    const now = Date.now();
    const list = clone(source);
    const dayIds = new Map();
    const activityIds = new Map();
    list.id = crypto.randomUUID();
    list.name = `本机恢复 - ${cleanName(list.name || list.trip?.tripTitle || "旧行程")}`;
    list.createdAt = now;
    list.updatedAt = now;
    list.trip = list.trip || { days: [] };
    list.trip.tripTitle = list.name;
    list.trip.updatedAt = now;
    list.trip.orderUpdatedAt = now;
    list.trip.days = (list.trip.days || []).map((day) => {
      const oldDayId = day.id;
      const dayId = crypto.randomUUID();
      dayIds.set(oldDayId, dayId);
      const activities = (day.activities || []).map((activity) => {
        const oldActivityId = activity.id;
        const activityId = crypto.randomUUID();
        activityIds.set(oldActivityId, activityId);
        return { ...activity, id: activityId, updatedAt: now };
      });
      return { ...day, id: dayId, activities, updatedAt: now, orderUpdatedAt: now };
    });
    list.trip.selectedDayId = dayIds.get(list.trip.selectedDayId) || list.trip.days[0]?.id || "";
    if (list.trip.budget?.items) {
      const nextItems = {};
      for (const [oldActivityId, value] of Object.entries(list.trip.budget.items)) {
        nextItems[activityIds.get(oldActivityId) || oldActivityId] = { ...(value || {}), updatedAt: now };
      }
      list.trip.budget.items = nextItems;
      list.trip.budget.updatedAt = now;
    }
    return list;
  }

  function sourceRank(source) {
    if (source === "direct") return 3;
    if (source === "session") return 2;
    return 1;
  }

  function rawFingerprint(value) {
    value = String(value || "");
    return `${value.length}:${value.slice(0, 512)}:${value.slice(-512)}`;
  }

  function cleanName(name) {
    return String(name || "").replace(/^(本机恢复 -\s*)+/g, "").replace(/^(冲突备份 -\s*)+/g, "历史备份 - ").trim() || "旧行程";
  }

  function countActivities(list) {
    return (list.trip?.days || []).reduce((sum, day) => sum + (day.activities?.length || 0), 0);
  }

  function listSignature(list) {
    return [cleanName(list.name || list.trip?.tripTitle), list.trip?.days?.length || 0, countActivities(list)].join("|");
  }

  function clone(value) {
    try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value)); }
  }

  function showToast(text) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
