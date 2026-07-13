(() => {
  "use strict";

  let enhanceTimer = 0;

  function init() {
    document.addEventListener("click", handleClick, true);
    scheduleEnhance();
    window.setTimeout(scheduleEnhance, 300);
    window.setInterval(scheduleEnhance, 1800);
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhance, 60);
  }

  function enhance() {
    enhanceListActions();
    enhanceQuickPlan();
    enhanceDayCards();
  }

  function enhanceListActions() {
    const heading = document.querySelector(".list-panel .section-heading");
    if (!heading || heading.querySelector(".list-lite-actions")) return;
    const box = document.createElement("div");
    box.className = "list-lite-actions";
    box.innerHTML = `<button class="mini-action" type="button" data-lite-action="export-list">导出</button>`;
    heading.append(box);
  }

  function enhanceQuickPlan() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel) return;
    const heading = panel.querySelector(".quick-plan-heading");
    if (heading && !heading.querySelector(".quick-plan-toggle")) {
      const button = document.createElement("button");
      button.className = "mini-action quick-plan-toggle";
      button.type = "button";
      button.dataset.liteAction = "toggle-quick-plan";
      button.textContent = panel.classList.contains("is-collapsed") ? "展开" : "收起";
      heading.append(button);
    }
    if (!panel.querySelector(".quick-entry-actions")) {
      const bar = document.createElement("div");
      bar.className = "quick-entry-actions";
      bar.innerHTML = `<button class="ghost-action" type="button" data-lite-action="new-list">新建行程单</button><button class="primary-action" type="button" data-lite-action="add-day">加一天</button><button class="ghost-action" type="button" data-lite-action="add-activity">加事项</button>`;
      const form = panel.querySelector(".quick-plan-form");
      if (form) panel.insertBefore(bar, form); else panel.append(bar);
    }
  }

  function enhanceDayCards() {
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      const actions = card.querySelector(".day-inline-actions");
      if (!actions || actions.querySelector(".day-header-plus")) return;
      const button = document.createElement("button");
      button.className = "day-header-plus";
      button.type = "button";
      button.dataset.liteAction = "add-activity";
      button.title = "添加事项";
      button.setAttribute("aria-label", "添加事项");
      button.textContent = "+";
      actions.prepend(button);
    });
  }

  function handleClick(event) {
    const button = event.target.closest?.("[data-lite-action]");
    if (!button) return;
    const action = button.dataset.liteAction;
    if (action === "toggle-quick-plan") {
      event.preventDefault();
      const panel = button.closest("#quickPlanPanel");
      const collapsed = !panel.classList.contains("is-collapsed");
      panel.classList.toggle("is-collapsed", collapsed);
      button.textContent = collapsed ? "展开" : "收起";
      return;
    }
    if (action === "new-list") {
      event.preventDefault();
      clickOne("#addListBtn");
      return;
    }
    if (action === "add-day") {
      event.preventDefault();
      clickOne("#addDayTopBtn, #addDayBtn");
      return;
    }
    if (action === "add-activity") {
      event.preventDefault();
      event.stopPropagation();
      const dayId = button.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      if (dayId) window.TripPlanner?.selectDay?.(dayId);
      focusActivityForm();
      return;
    }
    if (action === "export-list") {
      event.preventDefault();
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

  function focusActivityForm() {
    const panel = document.querySelector(".detail-panel");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => document.querySelector("#activityTitle")?.focus(), 120);
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
