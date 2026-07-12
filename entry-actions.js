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
    enhanceImportExportActions();
    enhanceQuickPlanPanel();
    enhancePresetPanel();
    enhanceMobileQuickbar();
    enhanceDayCards();
  }

  function enhanceImportExportActions() {
    const panel = document.querySelector(".list-panel");
    const heading = panel?.querySelector(".section-heading");
    if (!panel || !heading || heading.querySelector(".list-io-actions")) return;
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

  function exportCurrentList() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = getActiveList(library);
    if (!list?.trip) return showToast("没有可导出的行程单");
    const routePlan = window.TripDesignerMap?.getLastPlan?.() || null;
    const payload = { type: "tripdesigner-list-export", version: 2, exportedAt: new Date().toISOString(), list, routePlan };
    const routeSummary = routePlan?.summary ? `${formatKm(routePlan.summary.distance)} · ${formatDuration(routePlan.summary.duration)} · ${routePlan.summary.segmentCount || 0} 段路线` : "未计算路线";
    const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(list.name || "行程导出")}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#10201d;background:#f7fbf9}main{max-width:900px;margin:auto}.day{background:#fff;border:1px solid #d8e5e1;border-radius:10px;margin:16px 0;padding:16px}.activity{border-top:1px solid #edf3f1;padding:10px 0}.meta{color:#64736f;font-weight:700}.tag{display:inline-block;border:1px solid #cfe3dd;border-radius:999px;padding:2px 8px;margin:2px}.route{background:#edf8f4;border-radius:10px;padding:12px;margin:16px 0}</style></head><body><main><h1>${escapeHtml(list.name || "行程导出")}</h1><p class="meta">导出时间 ${escapeHtml(payload.exportedAt)} · ${escapeHtml((list.trip.days || []).length)} 天</p><section class="route"><strong>路线摘要</strong><p>${escapeHtml(routeSummary)}</p>${routePlan ? `<p><a href="https://www.google.com/maps/dir/${encodeURIComponent((routePlan.points || []).filter((p)=>p.located !== false).map((p)=>`${p.lat},${p.lng}`).join("/"))}" target="_blank" rel="noreferrer">Google Maps 路线链接</a></p>` : ""}</section>${renderExportDays(list.trip)}</main><script id="tripdesigner-export-data" type="application/json">${JSON.stringify(payload).replace(/</g,"\\u003c")}</script></body></html>`;
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
    const now = Date.now();
    const list = structuredClone(source);
    const oldDayIds = new Map();
    const oldActivityIds = new Map();
    list.id = crypto.randomUUID();
    list.name = `导入 - ${list.name || fileName || "行程"}`;
    list.updatedAt = now;
    list.orderUpdatedAt = now;
    list.trip = list.trip || {};
    list.trip.id = crypto.randomUUID();
    list.trip.updatedAt = now;
    list.trip.members = Array.isArray(list.trip.members) ? list.trip.members.map((member) => ({ ...member, id: crypto.randomUUID(), updatedAt: now })) : [];
    list.trip.days = Array.isArray(list.trip.days) ? list.trip.days.map((day) => {
      const oldDayId = day.id;
      const newDayId = crypto.randomUUID();
      oldDayIds.set(oldDayId, newDayId);
      const activities = Array.isArray(day.activities) ? day.activities.map((activity) => {
        const oldActivityId = activity.id;
        const newActivityId = crypto.randomUUID();
        oldActivityIds.set(oldActivityId, newActivityId);
        return { ...activity, id: newActivityId, updatedAt: now, orderUpdatedAt: now };
      }) : [];
      return { ...day, id: newDayId, activities, updatedAt: now, orderUpdatedAt: now };
    }) : [];
    list.trip.selectedDayId = oldDayIds.get(list.trip.selectedDayId) || list.trip.days[0]?.id || "";
    if (list.trip.budget?.items) {
      const nextItems = {};
      Object.entries(list.trip.budget.items).forEach(([key, value]) => {
        nextItems[oldActivityIds.get(key) || key] = { ...(value || {}), updatedAt: now };
      });
      list.trip.budget.items = nextItems;
      list.trip.budget.updatedAt = now;
    }
    return list;
  }

  function buildListFromPlainText(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
    if (!lines.length) throw new Error("导入文件为空");
    const now = Date.now();
    const days = [];
    let current = null;
    lines.forEach((line) => {
      const dayMatch = line.match(/^(第?\s*\d+\s*天|day\s*\d+|\d+\/\d+|\d{4}-\d{1,2}-\d{1,2})[:：\s-]*(.*)$/i);
      if (!current || dayMatch) {
        current = { id: crypto.randomUUID(), dateOffset: days.length, location: dayMatch?.[2] || "", stay: "", activities: [], updatedAt: now, orderUpdatedAt: now };
        days.push(current);
      } else {
        current.activities.push({ id: crypto.randomUUID(), time: "09:00", title: line, place: current.location || "", note: "", tags: [], transport: null, updatedAt: now, orderUpdatedAt: now });
      }
    });
    return { list: { id: crypto.randomUUID(), name: "导入文本行程", updatedAt: now, orderUpdatedAt: now, trip: { id: crypto.randomUUID(), title: "导入文本行程", startDate: new Date().toISOString().slice(0,10), originCity: "", dayLimit: Math.max(1, days.length), selectedDayId: days[0]?.id || "", members: [], days, budget: { currency: "CNY", items: {}, updatedAt: now }, updatedAt: now } } };
  }

  function renderExportDays(trip) {
    const budget = trip.budget?.items || {};
    return (trip.days || []).map((day, index) => `<section class="day"><h2>第 ${index + 1} 天 ${escapeHtml(day.location || "未填写地点")}</h2><p class="meta">住宿 ${escapeHtml(day.stay || "未填写")}</p>${(day.activities || []).map((activity) => { const itemBudget = budget[activity.id] || {}; const tags = (activity.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(""); return `<div class="activity"><strong>${escapeHtml(activity.time || "")} ${escapeHtml(activity.title || "未命名事项")}</strong><p>${escapeHtml(activity.place || "")}</p><p class="meta">交通 ${escapeHtml(labelTransport(activity.transport?.type || ""))} · 预算 ${escapeHtml(formatBudget(itemBudget, trip.budget?.currency || "CNY"))}</p>${tags}<p>${escapeHtml(activity.note || "")}</p></div>`; }).join("")}</section>`).join("");
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
  function clone(value) { return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
  function safeFileName(value) { return String(value || "trip-list").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 80); }
  function downloadText(fileName, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function labelTransport(value) { return transportTypes.find(([id]) => id === value)?.[1] || value || "未填写"; }
  function formatBudget(item, currency) { const cost = Number(item?.cost || item?.amount || 0); return cost > 0 ? `${currency} ${cost.toFixed(2)}` : "未估算"; }
  function formatKm(meters) { return `${(Number(meters || 0) / 1000).toFixed(1)} km`; }
  function formatDuration(seconds) { const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours ? `${hours} 小时 ${rest} 分钟` : `${rest} 分钟`; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
