(() => {
  "use strict";

  const quickCollapsedKey = "tripdesigner:quick-plan-collapsed";
  const budgetCategories = [["transport","交通"],["lodging","住宿"],["food","餐饮"],["play","游玩"],["shopping","购物"],["other","其他"]];
  const currencyOptions = ["CNY", "USD", "EUR"];
  const transportTypes = [["","无交通"],["plane","飞机"],["train","火车"],["bus","大巴"],["boat","船"],["car","车"]];
  let actionTimer = 0;
  let editorTarget = { dayId: "", activityId: "", field: "" };

  function init() {
    ensureFloatingEditor();
    enhanceVisibleActions();
    document.addEventListener("click", handleDocumentClick, true);
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
      bar.innerHTML = `<button class="ghost-action" type="button" data-entry-action="new-list">新建行程单</button><button class="primary-action" type="button" data-entry-action="add-day">加一天</button><button class="ghost-action" type="button" data-entry-action="add-activity">加事项</button>`;
      const form = panel.querySelector(".quick-plan-form");
      if (form) panel.insertBefore(bar, form); else panel.append(bar);
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
    bar.innerHTML = `<button type="button" data-entry-action="quick-plan">规划</button><button type="button" data-entry-action="add-day">加一天</button><button type="button" data-entry-action="add-activity">加事项</button>`;
    bar.addEventListener("click", handleEntryAction);
  }

  function enhanceDayCards() {
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      card.querySelectorAll(".day-inline-add,.day-direct-actions,.inline-activity-editor").forEach((node) => node.remove());
      const actions = card.querySelector(".day-inline-actions");
      if (!actions || actions.querySelector(".day-header-plus")) return;
      const add = document.createElement("button");
      add.className = "day-header-plus";
      add.type = "button";
      add.dataset.entryAction = "open-floating-editor";
      add.setAttribute("aria-label", "添加事项");
      add.title = "添加事项";
      add.textContent = "+";
      actions.prepend(add);
    });
  }

  function ensureFloatingEditor() {
    if (document.querySelector("#floatingActivityEditor")) return;
    const shell = document.createElement("div");
    shell.className = "floating-editor hidden";
    shell.id = "floatingActivityEditor";
    shell.innerHTML = `
      <form class="floating-editor-card" id="floatingActivityForm">
        <div class="floating-editor-head">
          <div><p>事项编辑</p><h2 id="floatingEditorTitle">添加事项</h2></div>
          <button class="icon-button" type="button" data-entry-action="close-floating-editor" aria-label="关闭">×</button>
        </div>
        <div class="floating-editor-grid">
          <label><span>时间</span><input name="time" type="time"></label>
          <label class="wide"><span>事项</span><input name="title" type="text" placeholder="要做什么" required></label>
          <label><span>地点</span><input name="place" type="text" placeholder="地点"></label>
          <label><span>交通</span><select name="transportType">${transportTypes.map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
          <label><span>出发</span><input name="transportFrom" type="text" placeholder="出发地"></label>
          <label><span>到达</span><input name="transportTo" type="text" placeholder="到达地"></label>
          <label><span>出发时间</span><input name="depart" type="time"></label>
          <label><span>到达时间</span><input name="arrive" type="time"></label>
          <label><span>金额</span><input name="cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="可不填"></label>
          <label><span>币种</span><select name="currency">${currencyOptions.map((item)=>`<option value="${item}">${item}</option>`).join("")}</select></label>
          <label><span>分类</span><select name="category">${budgetCategories.map(([id,label])=>`<option value="${id}">${label}</option>`).join("")}</select></label>
          <label class="wide"><span>标签</span><input name="tags" type="text" placeholder="用逗号分隔，如 已预订, 门票"></label>
        </div>
        <textarea name="note" rows="3" placeholder="备注、票号、集合点"></textarea>
        <div class="floating-editor-actions"><button class="ghost-action" type="button" data-entry-action="close-floating-editor">取消</button><button class="primary-action" type="submit">保存</button></div>
      </form>
    `;
    document.body.append(shell);
    shell.addEventListener("click", (event) => { if (event.target === shell) closeFloatingEditor(); });
    shell.querySelector("#floatingActivityForm")?.addEventListener("submit", saveFloatingActivity);
  }

  function handleDocumentClick(event) {
    const close = event.target.closest?.('[data-entry-action="close-floating-editor"]');
    if (close) { event.preventDefault(); event.stopPropagation(); closeFloatingEditor(); return; }

    const edit = event.target.closest?.(".edit-activity,.activity-transport-chip,.activity-transport-add,.cost-chip");
    if (edit) {
      const row = edit.closest(".activity-row[data-day-id][data-activity-id]");
      if (!row) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const field = edit.classList.contains("cost-chip") ? "budget" : (edit.classList.contains("activity-transport-chip") || edit.classList.contains("activity-transport-add") ? "transport" : "");
      openFloatingEditor(row.dataset.dayId, row.dataset.activityId, field);
      return;
    }

    const button = event.target.closest?.("[data-entry-action]");
    if (!button) return;
    if (button.dataset.entryAction === "open-floating-editor") {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const card = button.closest(".day-card[data-day-id]");
      openFloatingEditor(card?.dataset.dayId || getSelectedDayId(), "", "");
    }
  }

  function handleEntryAction(event) {
    const button = event.target.closest?.("[data-entry-action]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const action = button.dataset.entryAction;
    if (action === "new-list") return clickAndToast("#addListBtn", "已新建行程单");
    if (action === "add-day") return clickAndToast("#addDayTopBtn, #addDayBtn", "已添加一天");
    if (action === "add-activity") return openFloatingEditor(getSelectedDayId(), "", "");
    if (action === "quick-plan") return showQuickPlan();
  }

  function openFloatingEditor(dayId, activityId = "", field = "") {
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === dayId) || trip?.days?.[0];
    if (!library || !trip || !day) return showToast("未找到当天行程");
    const activity = activityId ? day.activities?.find((item) => item.id === activityId) : null;
    editorTarget = { dayId: day.id, activityId: activity?.id || "", field };
    window.TripPlanner?.selectActivity?.(day.id, activity?.id || "", field);
    const shell = document.querySelector("#floatingActivityEditor");
    const form = document.querySelector("#floatingActivityForm");
    const title = document.querySelector("#floatingEditorTitle");
    if (!shell || !form) return;
    title.textContent = activity ? "修改事项" : "添加事项";
    form.elements.time.value = activity?.time || "09:00";
    form.elements.title.value = activity?.title || "";
    form.elements.place.value = activity?.place || "";
    form.elements.note.value = activity?.note || "";
    form.elements.transportType.value = activity?.transport?.type || "";
    form.elements.transportFrom.value = activity?.transport?.from || "";
    form.elements.transportTo.value = activity?.transport?.to || "";
    form.elements.depart.value = activity?.transport?.depart || "";
    form.elements.arrive.value = activity?.transport?.arrive || "";
    const budget = trip.budget?.items?.[activity?.id] || activity?.budget || {};
    form.elements.cost.value = budget.cost || budget.amount || "";
    form.elements.currency.value = trip.budget?.currency || budget.currency || "CNY";
    form.elements.category.value = budget.category || inferCategory(activity?.title || "");
    form.elements.tags.value = (activity?.tags || []).join(", ");
    shell.classList.remove("hidden");
    window.setTimeout(() => focusField(form, field), 30);
  }

  function saveFloatingActivity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    if (!title) return form.elements.title.focus();
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === editorTarget.dayId) || trip?.days?.[0];
    if (!library || !trip || !day) return showToast("未找到当天行程");
    day.activities = Array.isArray(day.activities) ? day.activities : [];
    const activity = editorTarget.activityId ? day.activities.find((item) => item.id === editorTarget.activityId) : null;
    const activityId = activity?.id || crypto.randomUUID();
    const transport = {
      type: String(data.get("transportType") || ""),
      from: String(data.get("transportFrom") || "").trim(),
      to: String(data.get("transportTo") || "").trim(),
      depart: String(data.get("depart") || ""),
      arrive: String(data.get("arrive") || ""),
    };
    const next = {
      id: activityId,
      time: String(data.get("time") || ""),
      title,
      place: String(data.get("place") || "").trim(),
      note: String(data.get("note") || "").trim(),
      tags: parseTags(data.get("tags")),
      done: activity?.done || false,
      budget: null,
      transport: Object.values(transport).some(Boolean) ? transport : null,
      updatedAt: Date.now(),
    };
    if (activity) Object.assign(activity, next); else day.activities.push(next);
    day.updatedAt = Date.now();
    day.orderUpdatedAt ||= day.updatedAt;
    ensureBudget(trip);
    const currency = String(data.get("currency") || trip.budget.currency || "CNY");
    trip.budget.currency = currencyOptions.includes(currency) ? currency : "CNY";
    trip.budget.updatedAt = Date.now();
    trip.budget.items[activityId] = {
      cost: toAmount(data.get("cost")),
      category: budgetCategories.some(([id]) => id === data.get("category")) ? String(data.get("category")) : inferCategory(title),
      updatedAt: Date.now(),
    };
    trip.selectedDayId = day.id;
    window.TripPlanner.saveExternalLibrary(library, activity ? "edit-floating-activity" : "add-floating-activity");
    closeFloatingEditor();
    showToast(activity ? "事项已更新" : "事项已添加");
  }

  function closeFloatingEditor() { document.querySelector("#floatingActivityEditor")?.classList.add("hidden"); }
  function focusField(form, field) {
    const map = { time: "time", title: "title", place: "place", note: "note", transport: "transportType", budget: "cost", tags: "tags" };
    form.elements[map[field] || "title"]?.focus();
  }
  function toggleQuickPlan(panel) { const next = !panel.classList.contains("is-collapsed"); panel.classList.toggle("is-collapsed", next); localStorage.setItem(quickCollapsedKey, next ? "1" : "0"); const toggle = panel.querySelector(".quick-plan-toggle"); if (toggle) { toggle.textContent = next ? "展开" : "收起"; toggle.setAttribute("aria-expanded", String(!next)); } }
  function clickAndToast(selector, text) { const button = document.querySelector(selector); if (!button || button.disabled) return showToast(button?.disabled ? "已达到上限" : "入口暂未加载"); button.click(); showToast(text); }
  function showQuickPlan() { const panel = document.querySelector("#quickPlanPanel"); if (!panel) return showToast("快速规划入口暂未加载"); panel.classList.remove("is-collapsed"); localStorage.setItem(quickCollapsedKey, "0"); panel.querySelector(".quick-plan-toggle") && (panel.querySelector(".quick-plan-toggle").textContent = "收起"); panel.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function getSelectedDayId() { const library = window.TripPlanner?.getLibrary?.(); const list = getActiveList(library); return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || ""; }
  function getActiveList(library) { if (!library?.lists?.length) return null; return library.lists.find((item) => item.id === library.activeListId) || library.lists[0]; }
  function ensureBudget(trip) { trip.budget = trip.budget && typeof trip.budget === "object" ? trip.budget : {}; trip.budget.currency = currencyOptions.includes(trip.budget.currency) ? trip.budget.currency : "CNY"; trip.budget.items = trip.budget.items && typeof trip.budget.items === "object" ? trip.budget.items : {}; }
  function parseTags(value) { return String(value || "").split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8); }
  function inferCategory(text) { if (/车|飞机|火车|大巴|船|交通|打车|自驾/.test(text)) return "transport"; if (/酒店|住宿|入住|民宿|旅馆/.test(text)) return "lodging"; if (/餐|饭|咖啡|早餐|午餐|晚餐|夜宵/.test(text)) return "food"; if (/购物|商场|买/.test(text)) return "shopping"; if (/景点|游览|门票|博物馆|公园|骑行/.test(text)) return "play"; return "other"; }
  function toAmount(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
  function showToast(text) { const toast = document.querySelector("#toast"); if (!toast) return; toast.textContent = text; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 1800); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
