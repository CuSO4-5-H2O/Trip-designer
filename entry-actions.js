(() => {
  "use strict";

  const quickCollapsedKey = "tripdesigner:quick-plan-collapsed";
  const budgetCategories = [
    ["transport", "交通"],
    ["lodging", "住宿"],
    ["food", "餐饮"],
    ["play", "游玩"],
    ["shopping", "购物"],
    ["other", "其他"],
  ];
  const currencyOptions = ["CNY", "USD", "EUR"];
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
      actions.innerHTML = `<button class="mini-action quick-plan-toggle" type="button" aria-expanded="true">收起</button>`;
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
    actions.innerHTML = `<button class="mini-action" type="button" data-entry-action="add-day">加一天</button>`;
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
    `;
    bar.addEventListener("click", handleEntryAction);
  }

  function enhanceDayCards() {
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      card.querySelectorAll(".day-inline-add,.day-direct-actions").forEach((node) => node.remove());
      const actions = card.querySelector(".day-inline-actions");
      if (!actions || actions.querySelector(".day-header-plus")) return;
      const add = document.createElement("button");
      add.className = "day-header-plus";
      add.type = "button";
      add.dataset.entryAction = "open-inline-editor";
      add.setAttribute("aria-label", "添加事项");
      add.title = "添加事项";
      add.textContent = "+";
      actions.prepend(add);
      add.addEventListener("click", handleEntryAction);
    });
  }

  function openInlineEditor(button) {
    const card = button.closest(".day-card[data-day-id]");
    if (!card) return;
    const dayId = card.dataset.dayId;
    if (dayId && window.TripPlanner?.selectDay) window.TripPlanner.selectDay(dayId);
    window.setTimeout(() => {
      const freshCard = document.querySelector(`.day-card[data-day-id="${cssEscape(dayId)}"]`) || card;
      freshCard.querySelector(".inline-activity-editor")?.remove();
      const content = freshCard.querySelector(".day-content");
      const list = freshCard.querySelector(".activity-list");
      if (!content || !list) return showToast("添加入口暂未加载");
      const library = window.TripPlanner?.getLibrary?.();
      const activeList = getActiveList(library);
      const currency = getTripCurrency(activeList?.trip);
      const editor = document.createElement("form");
      editor.className = "inline-activity-editor";
      editor.innerHTML = `
        <div class="inline-editor-grid">
          <label><span>时间</span><input name="time" type="time" value="09:00"></label>
          <label class="inline-title"><span>事项</span><input name="title" type="text" placeholder="要做什么" required></label>
          <label><span>地点</span><input name="place" type="text" placeholder="地点"></label>
        </div>
        <div class="inline-editor-budget">
          <label><span>金额</span><input name="cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="可不填"></label>
          <label><span>币种</span><select name="currency">${currencyOptions.map((item) => `<option value="${item}" ${item === currency ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          <label><span>分类</span><select name="category">${budgetCategories.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
        </div>
        <textarea name="note" rows="2" placeholder="备注、票号、集合点"></textarea>
        <div class="inline-editor-actions">
          <button class="ghost-action" type="button" data-entry-action="close-inline-editor">取消</button>
          <button class="primary-action" type="submit">保存事项</button>
        </div>
      `;
      content.insertBefore(editor, list);
      editor.addEventListener("submit", (event) => saveInlineActivity(event, dayId));
      editor.querySelector('[data-entry-action="close-inline-editor"]')?.addEventListener("click", () => editor.remove());
      editor.querySelector('input[name="title"]')?.focus();
    }, 80);
  }

  function saveInlineActivity(event, dayId) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return form.querySelector('input[name="title"]')?.focus();
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === dayId);
    if (!library || !list || !trip || !day) return showToast("未找到当天行程");
    const activityId = crypto.randomUUID();
    day.activities = Array.isArray(day.activities) ? day.activities : [];
    day.activities.push({
      id: activityId,
      time: String(data.get("time") || ""),
      title,
      place: String(data.get("place") || "").trim(),
      note: String(data.get("note") || "").trim(),
      done: false,
      budget: null,
      transport: null,
    });
    ensureBudget(trip);
    const currency = String(data.get("currency") || trip.budget.currency || "CNY");
    trip.budget.currency = currencyOptions.includes(currency) ? currency : "CNY";
    const cost = toAmount(data.get("cost"));
    trip.budget.items[activityId] = {
      cost,
      category: budgetCategories.some(([id]) => id === data.get("category")) ? String(data.get("category")) : inferCategory(title),
    };
    trip.selectedDayId = dayId;
    window.TripPlanner.saveExternalLibrary(library, "add-inline-activity");
    showToast("事项已添加");
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
    if (action === "add-activity") return openInlineEditorForSelectedDay();
    if (action === "open-inline-editor") return openInlineEditor(button);
    if (action === "quick-plan") return showQuickPlan();
  }

  function openInlineEditorForSelectedDay() {
    const selected = document.querySelector(".day-card.active[data-day-id]") || document.querySelector(".day-card[data-day-id]");
    const button = selected?.querySelector(".day-header-plus");
    if (button) return openInlineEditor(button);
    showToast("添加入口暂未加载");
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

  function scrollToElement(target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function getActiveList(library) {
    if (!library?.lists?.length) return null;
    return library.lists.find((item) => item.id === library.activeListId) || library.lists[0];
  }

  function ensureBudget(trip) {
    trip.budget = trip.budget && typeof trip.budget === "object" ? trip.budget : {};
    trip.budget.currency = getTripCurrency(trip);
    trip.budget.items = trip.budget.items && typeof trip.budget.items === "object" ? trip.budget.items : {};
  }

  function getTripCurrency(trip) {
    const value = trip?.budget?.currency;
    return currencyOptions.includes(value) ? value : "CNY";
  }

  function inferCategory(text) {
    if (/车|飞机|火车|大巴|船|交通|打车|自驾/.test(text)) return "transport";
    if (/酒店|住宿|入住|民宿|旅馆/.test(text)) return "lodging";
    if (/餐|饭|咖啡|早餐|午餐|晚餐|夜宵/.test(text)) return "food";
    if (/购物|商场|买/.test(text)) return "shopping";
    if (/景点|游览|门票|博物馆|公园|骑行/.test(text)) return "play";
    return "other";
  }

  function toAmount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value || "").replace(/"/g, '\\"');
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
