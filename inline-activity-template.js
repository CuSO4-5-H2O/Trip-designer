(() => {
  "use strict";

  const currencies = ["CNY", "EUR", "USD", "JPY", "GBP"];
  const transports = [["", "无交通"], ["plane", "飞机"], ["train", "火车"], ["bus", "大巴"], ["boat", "船"], ["car", "车"]];
  let enhanceTimer = 0;
  let observer = null;
  let activeEditor = null;
  let pointerHandled = false;

  function init() {
    installStyles();
    window.TripPlannerQuickAdd = addTemplateActivity;
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    observeRows();
    scheduleEnhance();
    window.setTimeout(() => {
      window.TripPlannerQuickAdd = addTemplateActivity;
      scheduleEnhance();
    }, 450);
    window.setInterval(() => {
      if (window.TripPlannerQuickAdd !== addTemplateActivity) window.TripPlannerQuickAdd = addTemplateActivity;
    }, 1200);
  }

  function observeRows() {
    if (observer) return;
    observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhanceAll, 70);
  }

  function enhanceAll() {
    enhanceDayCards();
    enhanceRows();
  }

  function enhanceDayCards() {
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      card.querySelector(".day-compact-location")?.setAttribute("data-day-field", "location");
      card.querySelector(".day-compact-stay")?.setAttribute("data-day-field", "stay");
      card.querySelector(".day-compact-budget")?.setAttribute("data-day-field", "budget");
      card.querySelector(".empty-state")?.classList.add("inline-empty-add");
      const pills = [...card.querySelectorAll(".day-meta .meta-pill")];
      const fields = ["location", "stay", "budget"];
      pills.forEach((pill, index) => {
        pill.dataset.dayField = fields[index] || "";
        pill.classList.add("inline-day-chip");
      });
    });
  }

  function enhanceRows() {
    document.querySelectorAll(".activity-row[data-activity-id]").forEach((row) => {
      if (row.dataset.inlineEnhanced === "1") return;
      row.dataset.inlineEnhanced = "1";
      row.querySelector(".edit-activity")?.setAttribute("title", "行内编辑事项");
      row.querySelector(".activity-time")?.classList.add("inline-clickable");
      const body = row.querySelector(".activity-body");
      if (!body) return;
      const title = body.querySelector("strong[data-select-field='title']");
      title?.classList.add("inline-clickable");
      if (!body.querySelector("[data-select-field='place']")) {
        body.insertBefore(chip("place", "地点"), body.querySelector(".activity-transport-chip,.activity-transport-add") || null);
      }
      if (!body.querySelector("[data-select-field='note']")) {
        body.insertBefore(chip("note", "描述"), body.querySelector(".activity-transport-chip,.activity-transport-add") || null);
      }
      if (!body.querySelector("[data-select-field='budget']")) {
        body.append(chip("budget", budgetText(row), "inline-budget-chip"));
      }
    });
  }

  function chip(field, text, extra = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inline-field-chip ${extra}`.trim();
    button.dataset.selectField = field;
    button.textContent = text;
    return button;
  }

  function handlePointerDown(event) {
    if (!isEditableClick(event)) return;
    if (routeEditableTarget(event)) {
      pointerHandled = true;
      window.setTimeout(() => { pointerHandled = false; }, 350);
    }
  }

  function handleClick(event) {
    if (pointerHandled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }
    routeEditableTarget(event);
  }

  function isEditableClick(event) {
    return event.button === undefined || event.button === 0;
  }

  function routeEditableTarget(event) {
    const addButton = event.target.closest?.(".day-card-add-floating,[data-hotfix-action='add-activity'],[data-lite-action='add-activity']");
    if (addButton) {
      stop(event);
      const dayId = addButton.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      addTemplateActivity(dayId);
      return true;
    }

    const empty = event.target.closest?.(".inline-empty-add");
    if (empty) {
      stop(event);
      const dayId = empty.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      addTemplateActivity(dayId);
      return true;
    }

    const dayField = event.target.closest?.("[data-day-field]");
    if (dayField) {
      stop(event);
      const card = dayField.closest(".day-card[data-day-id]");
      const field = dayField.dataset.dayField;
      if (!card || !field) return true;
      if (field === "budget") openDayBudgetEditor(card.dataset.dayId, dayField);
      else openDayFieldEditor(card, field, dayField);
      return true;
    }

    const editButton = event.target.closest?.(".edit-activity");
    if (editButton) {
      const row = editButton.closest(".activity-row[data-activity-id]");
      if (!row) return false;
      stop(event);
      openFieldEditor(row, "title", row.querySelector("strong[data-select-field='title']") || row);
      return true;
    }

    const target = event.target.closest?.(".activity-row [data-select-field]");
    if (!target) return false;
    const row = target.closest(".activity-row[data-activity-id]");
    if (!row) return false;
    const field = target.dataset.selectField;
    if (!["time", "title", "place", "note", "budget", "transport"].includes(field)) return false;
    stop(event);
    openFieldEditor(row, field, target);
    return true;
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && activeEditor) {
      event.preventDefault();
      closeEditor();
    }
  }

  function addTemplateActivity(dayId, options = {}) {
    const library = window.TripPlanner?.getLibrary?.();
    const list = activeList(library);
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === dayId) || trip?.days?.find((item) => item.id === trip.selectedDayId) || trip?.days?.[0];
    if (!library || !list || !trip || !day) {
      toast("行程还没加载完成");
      return "";
    }
    const stamp = Date.now();
    const activity = {
      id: crypto.randomUUID(),
      time: "",
      title: options.title || "新事项",
      place: "",
      note: "",
      tags: [],
      done: false,
      budget: { amount: 0, currency: trip.budget?.currency || "CNY" },
      transport: null,
      updatedAt: stamp,
    };
    day.activities ||= [];
    day.activities.push(activity);
    day.updatedAt = stamp;
    day.orderUpdatedAt = stamp;
    trip.selectedDayId = day.id;
    trip.updatedAt = stamp;
    list.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, "inline-template-add-activity");
    toast("已在当天末尾添加事项");
    if (options.open !== false) {
      window.setTimeout(() => {
        const row = document.querySelector(`.activity-row[data-activity-id="${cssEscape(activity.id)}"]`);
        if (row) openFieldEditor(row, options.field || "title", row.querySelector(`[data-select-field='${options.field || "title"}']`) || row.querySelector("strong[data-select-field='title']") || row);
      }, 120);
    }
    return activity.id;
  }

  function openDayFieldEditor(card, field, anchor) {
    closeEditor();
    const ref = getDayRefs(card.dataset.dayId);
    if (!ref.day) return;
    card.classList.add("inline-editing-row");
    const input = document.createElement("input");
    input.className = "inline-activity-input inline-day-input inline-chip-input";
    input.dataset.inlineDayEditor = field;
    input.placeholder = field === "location" ? "当天地点" : "住宿";
    input.value = field === "location" ? (ref.day.location || "") : (ref.day.stay || "");
    replaceAnchor(anchor, input, card);
    activeEditor = { node: input, row: card, release: lockRowHeight(card) };
    input.focus({ preventScroll: true });
    input.select?.();
    let saved = false;
    const saveAndClose = () => {
      if (saved) return;
      saved = true;
      const value = input.value.trim();
      updateDay(card.dataset.dayId, (day) => {
        if (field === "location") day.location = value;
        if (field === "stay") day.stay = value;
      }, `inline-edit-day-${field}`);
      closeEditor();
    };
    input.addEventListener("blur", saveAndClose, { once: true });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveAndClose();
      }
    });
  }

  function openDayBudgetEditor(dayId, anchor) {
    const ref = getDayRefs(dayId);
    if (!ref.day) return;
    const activity = ref.day.activities?.[ref.day.activities.length - 1];
    if (!activity) {
      const id = addTemplateActivity(dayId, { title: "预算事项", open: false });
      window.setTimeout(() => {
        const row = document.querySelector(`.activity-row[data-activity-id="${cssEscape(id)}"]`);
        if (row) openFieldEditor(row, "budget", row.querySelector("[data-select-field='budget']") || row);
      }, 140);
      return;
    }
    const row = document.querySelector(`.activity-row[data-activity-id="${cssEscape(activity.id)}"]`);
    if (row) openFieldEditor(row, "budget", row.querySelector("[data-select-field='budget']") || row);
    else toast("请先展开当天事项再编辑预算");
  }

  function openFieldEditor(row, field, anchor) {
    closeEditor();
    const ref = getRefs(row);
    const activity = ref.activity;
    if (!activity) return;
    row.classList.add("inline-editing-row");
    if (field === "transport") return openTransportEditor(row, anchor, ref);
    if (field === "budget") return openBudgetEditor(row, anchor, ref);
    const input = document.createElement("input");
    input.className = `inline-activity-input ${field === "title" ? "inline-title-input" : "inline-chip-input"}`;
    input.dataset.inlineEditor = field;
    if (field === "time") input.type = "time";
    if (field === "title") input.placeholder = "事项标题";
    if (field === "place") input.placeholder = "地点";
    if (field === "note") input.placeholder = "详细描述";
    input.value = activity[field] || "";
    replaceAnchor(anchor, input, row);
    activeEditor = { node: input, row, release: lockRowHeight(row) };
    input.focus({ preventScroll: true });
    if (field !== "time") input.select?.();
    let saved = false;
    const saveAndClose = () => {
      if (saved) return;
      saved = true;
      const value = input.value.trim();
      updateActivity(row, (item) => {
        item[field] = field === "title" ? (value || "新事项") : value;
      }, `inline-edit-${field}`);
      closeEditor();
    };
    input.addEventListener("blur", saveAndClose, { once: true });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        saveAndClose();
      }
    });
  }

  function openBudgetEditor(row, anchor, ref) {
    const budget = ref.activity.budget || {};
    const wrap = document.createElement("span");
    wrap.className = "inline-budget-editor inline-compound-editor";
    wrap.innerHTML = `<input class="inline-activity-input budget-amount" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeAttr(Number(budget.amount ?? budget.cost ?? 0) || 0)}"><select class="inline-activity-input budget-currency">${currencies.map((code) => `<option value="${code}" ${code === (budget.currency || ref.trip?.budget?.currency || "CNY") ? "selected" : ""}>${code}</option>`).join("")}</select>`;
    replaceAnchor(anchor, wrap, row);
    activeEditor = { node: wrap, row, release: lockRowHeight(row) };
    const amount = wrap.querySelector(".budget-amount");
    const currency = wrap.querySelector(".budget-currency");
    amount.focus({ preventScroll: true });
    amount.select?.();
    let saved = false;
    const saveAndClose = () => {
      if (saved) return;
      saved = true;
      updateActivity(row, (item) => {
        item.budget = { amount: Math.max(0, Number(amount.value) || 0), currency: currency.value || "CNY" };
      }, "inline-edit-budget");
      closeEditor();
    };
    wrap.addEventListener("focusout", () => window.setTimeout(() => {
      if (!wrap.contains(document.activeElement)) saveAndClose();
    }, 0));
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveAndClose();
      }
    });
  }

  function openTransportEditor(row, anchor, ref) {
    const transport = ref.activity.transport || {};
    const wrap = document.createElement("span");
    wrap.className = "inline-transport-editor inline-compound-editor";
    wrap.innerHTML = `<select class="inline-activity-input transport-type">${transports.map(([id, label]) => `<option value="${id}" ${id === (transport.type || "") ? "selected" : ""}>${label}</option>`).join("")}</select><input class="inline-activity-input transport-from" value="${escapeAttr(transport.from || "")}" placeholder="出发地"><input class="inline-activity-input transport-to" value="${escapeAttr(transport.to || "")}" placeholder="到达地">`;
    replaceAnchor(anchor, wrap, row);
    activeEditor = { node: wrap, row, release: lockRowHeight(row) };
    wrap.querySelector(".transport-type")?.focus({ preventScroll: true });
    let saved = false;
    const saveAndClose = () => {
      if (saved) return;
      saved = true;
      const type = wrap.querySelector(".transport-type")?.value || "";
      const from = wrap.querySelector(".transport-from")?.value.trim() || "";
      const to = wrap.querySelector(".transport-to")?.value.trim() || "";
      updateActivity(row, (item) => {
        item.transport = type || from || to ? { type: type || "car", from, to, depart: item.transport?.depart || "", arrive: item.transport?.arrive || "" } : null;
      }, "inline-edit-transport");
      closeEditor();
    };
    wrap.addEventListener("focusout", () => window.setTimeout(() => {
      if (!wrap.contains(document.activeElement)) saveAndClose();
    }, 0));
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveAndClose();
      }
    });
  }

  function replaceAnchor(anchor, editor, row) {
    const release = lockRowHeight(row || anchor.closest?.(".activity-row,.day-card"));
    const rect = anchor.getBoundingClientRect?.();
    anchor.dataset.inlineOriginalDisplay = anchor.style.display || "";
    anchor.style.display = "none";
    if (rect?.width && editor.matches?.("input.inline-chip-input")) {
      editor.style.minWidth = `${Math.max(82, Math.ceil(rect.width))}px`;
    }
    editor.dataset.inlineAnchor = "1";
    anchor.insertAdjacentElement("afterend", editor);
    window.requestAnimationFrame?.(() => release());
  }

  function closeEditor(restore = true) {
    if (!activeEditor) return;
    const { node, row, release } = activeEditor;
    const hidden = node.previousElementSibling;
    lockRowHeight(row);
    if (restore && hidden?.dataset?.inlineOriginalDisplay !== undefined) {
      hidden.style.display = hidden.dataset.inlineOriginalDisplay;
      delete hidden.dataset.inlineOriginalDisplay;
    }
    node.remove();
    row?.classList.remove("inline-editing-row");
    release?.();
    activeEditor = null;
  }

  function lockRowHeight(row) {
    if (!row?.isConnected) return () => {};
    const height = row.getBoundingClientRect?.().height || 0;
    if (height <= 0) return () => {};
    row.style.minHeight = `${Math.ceil(height)}px`;
    row.dataset.inlineLockedHeight = "1";
    return () => window.setTimeout(() => {
      if (!row.isConnected || row.dataset.inlineLockedHeight !== "1") return;
      row.style.minHeight = "";
      delete row.dataset.inlineLockedHeight;
    }, 180);
  }

  function updateDay(dayId, mutate, reason) {
    const library = window.TripPlanner?.getLibrary?.();
    const ref = getDayRefs(dayId, library);
    if (!ref.day || !ref.trip || !ref.list) return;
    const stamp = Date.now();
    mutate(ref.day);
    ref.day.updatedAt = stamp;
    ref.trip.updatedAt = stamp;
    ref.list.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, reason);
  }

  function updateActivity(row, mutate, reason) {
    const library = window.TripPlanner?.getLibrary?.();
    const ref = getRefs(row, library);
    if (!ref.activity || !ref.day || !ref.trip || !ref.list) return;
    const stamp = Date.now();
    mutate(ref.activity);
    ref.activity.updatedAt = stamp;
    ref.day.updatedAt = stamp;
    ref.trip.updatedAt = stamp;
    ref.list.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, reason);
  }

  function getRefs(row, library = window.TripPlanner?.getLibrary?.()) {
    const list = activeList(library);
    const trip = list?.trip;
    const dayId = row.dataset.dayId || row.closest(".day-card[data-day-id]")?.dataset.dayId;
    const day = trip?.days?.find((item) => item.id === dayId);
    const activity = day?.activities?.find((item) => item.id === row.dataset.activityId);
    return { library, list, trip, day, activity };
  }

  function getDayRefs(dayId, library = window.TripPlanner?.getLibrary?.()) {
    const list = activeList(library);
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === dayId);
    return { library, list, trip, day };
  }

  function activeList(library) {
    return library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
  }

  function getSelectedDayId() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = activeList(library);
    return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || "";
  }

  function budgetText(row) {
    const ref = getRefs(row);
    const budget = ref.activity?.budget || {};
    const amount = Number(budget.amount ?? budget.cost ?? 0) || 0;
    const currency = budget.currency || ref.trip?.budget?.currency || "CNY";
    return amount ? `预算 ${currency} ${amount}` : "预算";
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1600);
  }

  function installStyles() {
    if (document.querySelector("#inlineActivityTemplateStyles")) return;
    const style = document.createElement("style");
    style.id = "inlineActivityTemplateStyles";
    style.textContent = `
      .activity-row .inline-clickable,.activity-row [data-select-field],.inline-day-chip,[data-day-field],.inline-empty-add{cursor:text}.inline-empty-add{transition:border-color 140ms var(--ease),background 140ms var(--ease),color 140ms var(--ease)}.inline-empty-add:hover{border-color:rgba(15,143,131,.46)!important;background:#eef9f6!important;color:var(--teal-dark)!important}.activity-row .inline-field-chip,.activity-transport-add,.activity-transport-chip{height:32px!important;min-height:32px!important;border-radius:999px!important;padding:0 13px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font:inherit!important;font-size:14px!important;font-weight:850!important;line-height:1!important;white-space:nowrap!important;vertical-align:top!important}.activity-row .inline-field-chip{width:max-content;border:1px solid transparent;background:#f4f8f6;color:var(--muted);cursor:text}.activity-row .inline-field-chip:hover,.activity-row [data-select-field]:hover,.inline-day-chip:hover,[data-day-field]:hover{border-color:rgba(15,143,131,.22);background:#eef9f6;color:var(--teal-dark)}.activity-row .inline-budget-chip{border-style:solid;color:#b63a28;background:#fff5f1}.inline-editing-row{outline:2px solid rgba(15,143,131,.55);outline-offset:2px}.inline-activity-input{height:32px!important;min-height:32px!important;border:1px solid rgba(15,143,131,.42);border-radius:999px!important;background:#fff;padding:0 12px!important;font:inherit;font-size:14px!important;font-weight:850!important;line-height:1!important;color:var(--ink);box-shadow:0 0 0 3px rgba(15,143,131,.08)}.activity-body .inline-chip-input{flex:0 1 190px!important;width:190px!important;max-width:min(48vw,260px)!important;margin:0!important;align-self:flex-start!important}.activity-body .inline-title-input{flex:1 1 100%!important;width:100%!important;border-radius:8px!important;font-size:16px!important}.activity-time+.inline-activity-input,.activity-row>.inline-activity-input[data-inline-editor='time']{width:78px!important;flex:0 0 78px!important}.inline-day-input{min-width:190px}.inline-compound-editor{display:inline-flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;vertical-align:top!important;min-height:32px!important;margin:0!important}.inline-budget-editor .budget-amount{width:112px}.inline-budget-editor .budget-currency{width:82px}.inline-transport-editor .transport-type{width:100px}.inline-transport-editor .transport-from,.inline-transport-editor .transport-to{width:132px}.activity-row[data-inline-locked-height='1'],.day-card[data-inline-locked-height='1']{overflow-anchor:none!important;transition:none!important}@media(max-width:780px){.activity-body .inline-chip-input{width:150px!important;max-width:52vw!important}.inline-compound-editor{flex-wrap:wrap!important;width:100%}.inline-budget-editor .inline-activity-input,.inline-transport-editor .inline-activity-input{width:auto!important;flex:1 1 96px!important}.activity-row .inline-field-chip,.activity-transport-add,.activity-transport-chip{height:32px!important;min-height:32px!important;padding-inline:12px!important;font-size:13px!important}.inline-day-input{width:min(70vw,260px)}}
    `;
    document.head.append(style);
  }

  function escapeAttr(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value || "").replace(/"/g, '\\"');
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();