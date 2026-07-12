(() => {
  "use strict";

  const quickCollapsedKey = "tripdesigner:quick-plan-collapsed";
  let actionTimer = 0;

  function init() {
    enhanceVisibleActions();
    const observer = new MutationObserver(() => {
      clearTimeout(actionTimer);
      actionTimer = window.setTimeout(enhanceVisibleActions, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(enhanceVisibleActions, 1600);
  }

  function enhanceVisibleActions() {
    enhanceQuickPlanPanel();
    enhancePresetPanel();
    enhanceMobileQuickbar();
    enhanceDayCards();
  }

  function enhanceQuickPlanPanel() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel) return;
    panel.classList.toggle("is-collapsed", localStorage.getItem(quickCollapsedKey) === "1");

    const heading = panel.querySelector(".quick-plan-heading");
    if (heading && !heading.querySelector(".quick-plan-toggle")) {
      const actions = document.createElement("div");
      actions.className = "quick-plan-title-actions";
      actions.innerHTML = `
        <button class="mini-action quick-plan-toggle" type="button" aria-expanded="true">收起</button>
      `;
      heading.append(actions);
      actions.querySelector(".quick-plan-toggle")?.addEventListener("click", () => toggleQuickPlan(panel));
    }

    const toggle = panel.querySelector(".quick-plan-toggle");
    if (toggle) {
      const collapsed = panel.classList.contains("is-collapsed");
      toggle.textContent = collapsed ? "展开" : "收起";
      toggle.setAttribute("aria-expanded", String(!collapsed));
    }

    if (!panel.querySelector(".quick-entry-actions")) {
      const bar = document.createElement("div");
      bar.className = "quick-entry-actions";
      bar.innerHTML = `
        <button class="ghost-action" type="button" data-entry-action="new-list">新建行程单</button>
        <button class="primary-action" type="button" data-entry-action="add-day">加一天</button>
        <button class="ghost-action" type="button" data-entry-action="add-activity">加事项</button>
        <button class="ghost-action" type="button" data-entry-action="budget">预算</button>
      `;
      const form = panel.querySelector(".quick-plan-form");
      if (form) panel.insertBefore(bar, form);
      else panel.append(bar);
      bar.addEventListener("click", handleEntryAction);
    }
  }

  function enhancePresetPanel() {
    const heading = document.querySelector("#presetPanel .compact-heading");
    if (!heading || heading.querySelector(".preset-heading-actions")) return;
    const actions = document.createElement("div");
    actions.className = "preset-heading-actions";
    actions.innerHTML = `
      <button class="mini-action" type="button" data-entry-action="add-day">加一天</button>
      <button class="mini-action" type="button" data-entry-action="budget">预算</button>
    `;
    heading.append(actions);
    actions.addEventListener("click", handleEntryAction);
  }

  function enhanceMobileQuickbar() {
    const bar = document.querySelector("#mobileQuickbar");
    if (!bar || bar.dataset.entryEnhanced === "1") return;
    bar.dataset.entryEnhanced = "1";
    bar.innerHTML = `
      <button type="button" data-entry-action="quick-plan">规划</button>
      <button type="button" data-entry-action="add-day">加一天</button>
      <button type="button" data-entry-action="add-activity">加事项</button>
      <button type="button" data-entry-action="budget">预算</button>
    `;
    bar.addEventListener("click", handleEntryAction);
  }

  function enhanceDayCards() {
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      const content = card.querySelector(".day-content");
      if (!content || content.querySelector(".day-direct-actions")) return;
      const actions = document.createElement("div");
      actions.className = "day-direct-actions";
      actions.innerHTML = `
        <button class="primary-action" type="button" data-entry-action="add-activity-for-day">添加事项</button>
        <button class="ghost-action" type="button" data-entry-action="budget-for-day">预算</button>
      `;
      const meta = content.querySelector(".day-meta");
      if (meta?.nextSibling) content.insertBefore(actions, meta.nextSibling);
      else content.prepend(actions);
      actions.addEventListener("click", handleEntryAction);
    });
  }

  function toggleQuickPlan(panel) {
    const next = !panel.classList.contains("is-collapsed");
    panel.classList.toggle("is-collapsed", next);
    localStorage.setItem(quickCollapsedKey, next ? "1" : "0");
    const toggle = panel.querySelector(".quick-plan-toggle");
    if (toggle) {
      toggle.textContent = next ? "展开" : "收起";
      toggle.setAttribute("aria-expanded", String(!next));
    }
  }

  function handleEntryAction(event) {
    const button = event.target.closest?.("[data-entry-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.entryAction;
    if (action === "new-list") return clickAndToast("#addListBtn", "已新建行程单");
    if (action === "add-day") return clickAndToast("#addDayTopBtn, #addDayBtn", "已添加一天");
    if (action === "add-activity") return focusActivityForm();
    if (action === "add-activity-for-day") return focusDayActivity(button);
    if (action === "budget-for-day" || action === "budget") return scrollToTarget("#budgetPanel", true);
    if (action === "quick-plan") return showQuickPlan();
  }

  function clickAndToast(selector, text) {
    const button = document.querySelector(selector);
    if (!button || button.disabled) {
      showToast(button?.disabled ? "已达到上限" : "入口暂未加载");
      return;
    }
    button.click();
    showToast(text);
  }

  function focusDayActivity(button) {
    const card = button.closest(".day-card[data-day-id]");
    const dayId = card?.dataset.dayId;
    if (dayId && window.TripPlanner?.selectDay) window.TripPlanner.selectDay(dayId);
    window.setTimeout(() => focusActivityForm(), 90);
  }

  function focusActivityForm() {
    const form = document.querySelector("#activityForm");
    if (!form) return showToast("添加事项入口暂未加载");
    scrollToElement(form);
    const first = document.querySelector("#activityTitle") || form.querySelector("input, textarea, button");
    window.setTimeout(() => first?.focus?.(), 260);
  }

  function showQuickPlan() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel) return showToast("快速规划入口暂未加载");
    panel.classList.remove("is-collapsed");
    localStorage.setItem(quickCollapsedKey, "0");
    const toggle = panel.querySelector(".quick-plan-toggle");
    if (toggle) {
      toggle.textContent = "收起";
      toggle.setAttribute("aria-expanded", "true");
    }
    scrollToElement(panel);
  }

  function scrollToTarget(selector, pulse) {
    const target = document.querySelector(selector);
    if (!target) return showToast("入口暂未加载");
    scrollToElement(target);
    if (pulse) {
      target.classList.add("entry-pulse");
      window.setTimeout(() => target.classList.remove("entry-pulse"), 900);
    }
  }

  function scrollToElement(target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showToast(text) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
