(() => {
  "use strict";

  const quickCollapsedKey = "tripdesigner:quick-plan-collapsed";
  const budgetCategories = [["transport","交通"],["lodging","住宿"],["food","餐饮"],["play","游玩"],["shopping","购物"],["other","其他"]];
  const currencyOptions = ["CNY", "USD", "EUR"];
  const transportTypes = [["","无交通"],["plane","飞机"],["train","火车"],["bus","大巴"],["boat","船"],["car","车"]];
  let editorTarget = { dayId: "", activityId: "", field: "" };
  let enhanceTimer = 0;

  function init() {
    ensureInlineStyles();
    ensureFloatingEditor();
    enhanceStaticActions();
    enhanceDayCards();
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("load", enhanceStaticActions, { once: true });

    const dayList = document.querySelector("#dayList");
    if (dayList && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        clearTimeout(enhanceTimer);
        enhanceTimer = window.setTimeout(enhanceDayCards, 24);
      });
      observer.observe(dayList, { childList: true });
    }
  }

  function enhanceStaticActions() {
    enhanceImportExportActions();
    enhanceQuickPlanPanel();
  }

  function enhanceImportExportActions() {
    const heading = document.querySelector(".list-panel .section-heading");
    if (!heading || heading.querySelector(".list-io-actions")) return;
    const actions = document.createElement("div");
    actions.className = "list-io-actions";
    actions.innerHTML = `
      <button class="mini-action" type="button" data-entry-action="export-list">导出</button>
      <button class="mini-action" type="button" data-entry-action="import-list">导入</button>
      <input class="hidden" id="listImportInput" type="file" accept=".html,.json,.txt,application/json,text/html,text/plain">
    `;
    heading.append(actions);
    actions.addEventListener("click", handleEntryAction);
    actions.querySelector("#listImportInput")?.addEventListener("change", importListFile);
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

  function enhanceDayCards() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    const activityTags = new Map();
    (list?.trip?.days || []).forEach((day) => (day.activities || []).forEach((activity) => activityTags.set(activity.id, activity.tags || [])));

    document.querySelectorAll("#dayList .day-card[data-day-id]").forEach((card) => {
      const actions = card.querySelector(".day-inline-actions");
      if (actions && !actions.querySelector(".day-header-plus")) {
        const add = document.createElement("button");
        add.className = "day-header-plus";
        add.type = "button";
        add.dataset.entryAction = "open-floating-editor";
        add.setAttribute("aria-label", "添加事项");
        add.title = "添加事项";
        add.textContent = "+";
        actions.prepend(add);
      }
    });

    document.querySelectorAll("#dayList .activity-row[data-activity-id]").forEach((row) => {
      row.querySelector(".activity-native-tags")?.remove();
      const tags = activityTags.get(row.dataset.activityId) || [];
      if (!tags.length) return;
      const body = row.querySelector(".activity-body");
      if (!body) return;
      const strip = document.createElement("span");
      strip.className = "activity-native-tags";
      strip.replaceChildren(...tags.slice(0, 8).map((tag) => {
        const chip = document.createElement("span");
        chip.textContent = `#${tag}`;
        return chip;
      }));
      body.append(strip);
    });
  }

  function ensureFloatingEditor() {
    if (document.querySelector("#floatingActivityEditor")) return;
    const shell = document.createElement("div");
    shell.className = "floating-editor hidden";
    shell.id = "floatingActivityEditor";
    shell.innerHTML = `
      <form class="floating-editor-card" id="floatingActivityForm">
        <div class="floating-editor-head"><div><p>事项编辑</p><h2 id="floatingEditorTitle">添加事项</h2></div><button class="icon-button" type="button" data-entry-action="close-floating-editor" aria-label="关闭">×</button></div>
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
    if (close) {
      event.preventDefault();
      event.stopPropagation();
      closeFloatingEditor();
      return;
    }

    const edit = event.target.closest?.(".edit-activity,.activity-transport-chip,.activity-transport-add");
    if (edit) {
      const row = edit.closest(".activity-row[data-day-id][data-activity-id]");
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const field = edit.matches(".activity-transport-chip,.activity-transport-add") ? "transport" : "";
      openFloatingEditor(row.dataset.dayId, row.dataset.activityId, field);
      return;
    }

    const button = event.target.closest?.("[data-entry-action]");
    if (!button || button.dataset.entryAction !== "open-floating-editor") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card = button.closest(".day-card[data-day-id]");
    openFloatingEditor(card?.dataset.dayId || getSelectedDayId(), "", "");
  }

  function handleEntryAction(event) {
    const button = event.target.closest?.("[data-entry-action]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.entryAction;
    if (action === "new-list") return clickAndToast("#addListBtn", "已新建行程单");
    if (action === "add-day") return clickAndToast("#addDayTopBtn, #addDayBtn", "已添加一天");
    if (action === "add-activity") return openFloatingEditor(getSelectedDayId(), "", "");
    if (action === "export-list") return exportCurrentList();
    if (action === "import-list") return document.querySelector("#listImportInput")?.click();
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
    if (!shell || !form) return;
    document.querySelector("#floatingEditorTitle").textContent = activity ? "修改事项" : "添加事项";
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

  function exportCurrentList() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    if (!list?.trip) return showToast("没有可导出的行程单");
    const routePlan = window.TripDesignerMap?.getLastPlan?.() || null;
    const payload = { type: "tripdesigner-list-export", version: 2, exportedAt: new Date().toISOString(), list, routePlan };
    const routeSummary = routePlan?.summary ? `${formatKm(routePlan.summary.distance)} · ${formatDuration(routePlan.summary.duration)} · ${routePlan.summary.segmentCount || 0} 段路线` : "未计算路线";
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(list.name || "行程导出")}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#10201d;background:#f7fbf9}main{max-width:900px;margin:auto}.day{background:#fff;border:1px solid #d8e5e1;border-radius:10px;margin:16px 0;padding:16px}.activity{border-top:1px solid #edf3f1;padding:10px 0}.meta{color:#64736f;font-weight:700}.tag{display:inline-block;border:1px solid #cfe3dd;border-radius:999px;padding:2px 8px;margin:2px}.route{background:#edf8f4;border-radius:10px;padding:12px;margin:16px 0}</style></head><body><main><h1>${escapeHtml(list.name || "行程导出")}</h1><p class="meta">导出时间 ${escapeHtml(payload.exportedAt)} · ${escapeHtml((list.trip.days || []).length)} 天</p><section class="route"><strong>路线摘要</strong><p>${escapeHtml(routeSummary)}</p></section>${renderExportDays(list.trip)}</main><script id="tripdesigner-export-data" type="application/json">${JSON.stringify(payload).replace(/</g,"\\u003c")}</script></body></html>`;
    downloadText(`${safeFileName(list.name || "trip-list")}.html`, html, "text/html;charset=utf-8");
    showToast("当前 list 已导出");
  }

  async function importListFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const payload = parseImportedPayload(text);
      const library = window.TripPlanner?.getLibrary?.();
      if (!library?.lists) throw new Error("当前行程库未加载");
      const importedList = remapImportedList(payload.list || payload, file.name);
      library.lists.push(importedList);
      library.activeListId = importedList.id;
      window.TripPlanner.saveExternalLibrary(library, "import-list");
      showToast("已导入为新 list");
    } catch (error) {
      showToast(error.message || "导入失败");
    }
  }

  function parseImportedPayload(text) {
    const trimmed = String(text || "").trim();
    const match = trimmed.match(/<script[^>]*id=["']tripdesigner-export-data["'][^>]*>([\s\S]*?)<\/script>/i);
    const source = match ? match[1] : trimmed;
    let payload;
    try { payload = JSON.parse(source); }
    catch { payload = buildListFromPlainText(trimmed); }
    const list = payload?.list || payload;
    if (!list?.trip?.days) throw new Error("没有识别到可导入的行程 list");
    return payload;
  }

  function remapImportedList(source, fileName) {
    const stamp = Date.now();
    const list = clone(source);
    const dayIds = new Map();
    const activityIds = new Map();
    list.id = crypto.randomUUID();
    list.name = `导入 - ${list.name || fileName || "行程"}`;
    list.updatedAt = stamp;
    list.createdAt = stamp;
    list.trip = list.trip || {};
    list.trip.updatedAt = stamp;
    list.trip.days = Array.isArray(list.trip.days) ? list.trip.days.map((day) => {
      const nextDayId = crypto.randomUUID();
      dayIds.set(day.id, nextDayId);
      const activities = Array.isArray(day.activities) ? day.activities.map((activity) => {
        const nextActivityId = crypto.randomUUID();
        activityIds.set(activity.id, nextActivityId);
        return { ...activity, id: nextActivityId, updatedAt: stamp };
      }) : [];
      return { ...day, id: nextDayId, activities, updatedAt: stamp, orderUpdatedAt: stamp };
    }) : [];
    list.trip.selectedDayId = dayIds.get(list.trip.selectedDayId) || list.trip.days[0]?.id || "";
    if (list.trip.budget?.items) {
      const items = {};
      Object.entries(list.trip.budget.items).forEach(([key, value]) => { items[activityIds.get(key) || key] = { ...(value || {}), updatedAt: stamp }; });
      list.trip.budget.items = items;
      list.trip.budget.updatedAt = stamp;
    }
    return list;
  }

  function buildListFromPlainText(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
    if (!lines.length) throw new Error("导入文件为空");
    const stamp = Date.now();
    const days = lines.map((line, index) => ({ id: crypto.randomUUID(), location: line, stay: "", activities: [], updatedAt: stamp, orderUpdatedAt: stamp, dateOffset: index }));
    return { list: { id: crypto.randomUUID(), name: "导入文本行程", createdAt: stamp, updatedAt: stamp, trip: { tripTitle: "导入文本行程", startDate: new Date().toISOString().slice(0,10), originCity: "", dayLimit: days.length, selectedDayId: days[0]?.id || "", days, budget: { currency: "CNY", items: {}, updatedAt: stamp }, updatedAt: stamp } } };
  }

  function renderExportDays(trip) {
    const budget = trip.budget?.items || {};
    return (trip.days || []).map((day, index) => `<section class="day"><h2>第 ${index + 1} 天 ${escapeHtml(day.location || "未填写地点")}</h2><p class="meta">住宿 ${escapeHtml(day.stay || "未填写")}</p>${(day.activities || []).map((activity) => { const itemBudget = budget[activity.id] || {}; const tags = (activity.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(""); return `<div class="activity"><strong>${escapeHtml(activity.time || "")} ${escapeHtml(activity.title || "未命名事项")}</strong><p>${escapeHtml(activity.place || "")}</p><p class="meta">交通 ${escapeHtml(labelTransport(activity.transport?.type || ""))} · 预算 ${escapeHtml(formatBudget(itemBudget, trip.budget?.currency || "CNY"))}</p>${tags}<p>${escapeHtml(activity.note || "")}</p></div>`; }).join("")}</section>`).join("");
  }

  function ensureInlineStyles() {
    if (document.querySelector("style[data-native-tags]")) return;
    const style = document.createElement("style");
    style.dataset.nativeTags = "true";
    style.textContent = `.activity-native-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.activity-native-tags span{padding:3px 7px;border:1px solid rgba(15,143,131,.18);border-radius:999px;background:var(--teal-soft);color:var(--teal-dark);font-size:11px;font-weight:780}`;
    document.head.append(style);
  }

  function closeFloatingEditor() { document.querySelector("#floatingActivityEditor")?.classList.add("hidden"); }
  function focusField(form, field) { const names = { transport: "transportType", budget: "cost", tags: "tags" }; form.elements[names[field] || "title"]?.focus(); }
  function toggleQuickPlan(panel) { const collapsed = !panel.classList.contains("is-collapsed"); panel.classList.toggle("is-collapsed", collapsed); localStorage.setItem(quickCollapsedKey, collapsed ? "1" : "0"); const toggle = panel.querySelector(".quick-plan-toggle"); if (toggle) { toggle.textContent = collapsed ? "展开" : "收起"; toggle.setAttribute("aria-expanded", String(!collapsed)); } }
  function clickAndToast(selector, text) { const button = document.querySelector(selector); if (!button || button.disabled) return showToast(button?.disabled ? "已达到上限" : "入口暂未加载"); button.click(); showToast(text); }
  function getSelectedDayId() { const list = getActiveList(window.TripPlanner?.getLibrary?.()); return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || ""; }
  function getActiveList(library) { if (!library?.lists?.length) return null; return library.lists.find((item) => item.id === library.activeListId) || library.lists[0]; }
  function ensureBudget(trip) { trip.budget = trip.budget && typeof trip.budget === "object" ? trip.budget : {}; trip.budget.currency = currencyOptions.includes(trip.budget.currency) ? trip.budget.currency : "CNY"; trip.budget.items = trip.budget.items && typeof trip.budget.items === "object" ? trip.budget.items : {}; }
  function parseTags(value) { return [...new Set(String(value || "").split(/[,，、\s]+/).map((item) => item.trim().replace(/^#+/, "")).filter(Boolean))].slice(0, 8); }
  function inferCategory(text) { if (/车|飞机|火车|大巴|船|交通|打车|自驾/.test(text)) return "transport"; if (/酒店|住宿|入住|民宿|旅馆/.test(text)) return "lodging"; if (/餐|饭|咖啡|早餐|午餐|晚餐|夜宵/.test(text)) return "food"; if (/购物|商场|买/.test(text)) return "shopping"; if (/景点|游览|门票|博物馆|公园|骑行/.test(text)) return "play"; return "other"; }
  function toAmount(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : 0; }
  function showToast(text) { const toast = document.querySelector("#toast"); if (!toast) return; toast.textContent = text; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 1800); }
  function clone(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
  function safeFileName(value) { return String(value || "trip-list").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80); }
  function downloadText(fileName, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function labelTransport(value) { return transportTypes.find(([id]) => id === value)?.[1] || value || "未填写"; }
  function formatBudget(item, currency) { const cost = Number(item?.cost || item?.amount || 0); return cost > 0 ? `${currency} ${cost.toFixed(2)}` : "未估算"; }
  function formatKm(meters) { return `${(Number(meters || 0) / 1000).toFixed(1)} km`; }
  function formatDuration(seconds) { const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours} 小时 ${rest} 分钟` : `${rest} 分钟`; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();