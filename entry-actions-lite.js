(() => {
  "use strict";

  let enhanceTimer = 0;
  let observer = null;
  let enhancing = false;

  function init() {
    document.addEventListener("click", handleClick, true);
    scheduleEnhance();
    window.setTimeout(scheduleEnhance, 300);
    observeStableAreas();
  }

  function observeStableAreas() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (enhancing) return;
      if (!mutations.some((mutation) => mutation.type === "childList")) return;
      scheduleEnhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhance, 80);
  }

  function enhance() {
    enhancing = true;
    try {
      enhanceListActions();
      enhanceQuickPlanActions();
      removeNestedDayPlusButtons();
    } finally {
      window.setTimeout(() => {
        enhancing = false;
      }, 0);
    }
  }

  function enhanceListActions() {
    const heading = document.querySelector(".list-panel .section-heading");
    if (!heading || heading.querySelector(".list-lite-actions")) return;
    const box = document.createElement("div");
    box.className = "list-lite-actions";
    box.innerHTML = `<button class="mini-action" type="button" data-lite-action="export-list">导出</button>`;
    heading.append(box);
  }

  function enhanceQuickPlanActions() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel || panel.querySelector(".quick-entry-actions")) return;
    const bar = document.createElement("div");
    bar.className = "quick-entry-actions";
    bar.innerHTML = `<button class="ghost-action" type="button" data-lite-action="new-list">新建行程单</button><button class="primary-action" type="button" data-lite-action="add-day">加一天</button><button class="ghost-action" type="button" data-lite-action="add-activity">加事项</button>`;
    const form = panel.querySelector(".quick-plan-form");
    if (form) panel.insertBefore(bar, form); else panel.append(bar);
  }

  function removeNestedDayPlusButtons() {
    document.querySelectorAll(".day-header-plus").forEach((button) => button.remove());
  }

  function handleClick(event) {
    const button = event.target.closest?.("[data-lite-action]");
    if (!button) return;
    const action = button.dataset.liteAction;
    if (action === "new-list") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clickOne("#addListBtn");
      return;
    }
    if (action === "add-day") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      clickOne("#addDayTopBtn, #addDayBtn");
      return;
    }
    if (action === "add-activity") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const dayId = button.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      if (dayId) window.TripPlanner?.selectDay?.(dayId);
      focusActivityForm(dayId);
      return;
    }
    if (action === "export-list") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      exportCurrentList();
    }
  }

  function clickOne(selector) {
    const target = document.querySelector(selector);
    if (target && !target.disabled) target.click();
  }

  function getSelectedDayId() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || "";
  }

  function focusActivityForm(dayId) {
    if (typeof window.TripPlannerQuickAdd === "function") {
      window.TripPlannerQuickAdd(dayId || getSelectedDayId());
      return;
    }
    document.body.classList.add("detail-drawer-open");
    window.setTimeout(() => document.querySelector("#activityTitle")?.focus({ preventScroll: true }), 80);
  }

  function exportCurrentList() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    if (!list) return;
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

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function safeFileName(value) {
    return String(value || "trip-list").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
