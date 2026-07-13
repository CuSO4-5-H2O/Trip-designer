(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

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
    if (!candidates.length) return;
    const heading = document.querySelector(".list-panel .section-heading");
    if (!heading || heading.querySelector("[data-local-recovery]")) return;
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

  function collectCandidates() {
    const keys = [
      `trip-planner-library:${roomId}:ignored-before-render`,
      `trip-planner:${roomId}:ignored-before-render`,
    ];
    const raw = [];
    for (const key of keys) {
      try {
        const value = sessionStorage.getItem(key);
        if (value) raw.push({ key, value, source: "session" });
      } catch {}
    }
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(`trip-planner-recovery:${roomId}:`)) continue;
        const value = localStorage.getItem(key);
        if (value) raw.push({ key, value, source: "local" });
      }
    } catch {}

    const seen = new Set();
    const candidates = [];
    for (const item of raw) {
      let parsed;
      try { parsed = JSON.parse(item.value); } catch { continue; }
      const lists = extractLists(parsed);
      if (!lists.length) continue;
      const score = lists.reduce((sum, list) => sum + (list.trip?.days?.length || 0) + countActivities(list) * 3, 0);
      const signature = JSON.stringify(lists.map((list) => [list.name, list.trip?.days?.length || 0, countActivities(list)]));
      if (seen.has(signature)) continue;
      seen.add(signature);
      candidates.push({ ...item, lists, score });
    }
    candidates.sort((a, b) => b.score - a.score || b.value.length - a.value.length);
    return candidates;
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
  }

  function remapList(source) {
    const now = Date.now();
    const list = clone(source);
    const dayIds = new Map();
    const activityIds = new Map();
    list.id = crypto.randomUUID();
    list.name = `本机恢复 - ${String(list.name || list.trip?.tripTitle || "旧行程").replace(/^(本机恢复 -\s*)+/, "")}`;
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

  function countActivities(list) {
    return (list.trip?.days || []).reduce((sum, day) => sum + (day.activities?.length || 0), 0);
  }

  function listSignature(list) {
    return [String(list.name || list.trip?.tripTitle || "").replace(/^本机恢复 -\s*/, ""), list.trip?.days?.length || 0, countActivities(list)].join("|");
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
