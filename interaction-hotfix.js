(() => {
  "use strict";

  const retiredModalId = "quickActivityModal";
  let styleInstalled = false;
  let enhanceTimer = 0;
  let observer = null;
  let enhancing = false;

  function init() {
    installStyles();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("dragstart", handleDragStartCapture, true);
    scheduleEnhance();
    window.setTimeout(scheduleEnhance, 250);
    observeTimelineChanges();
  }

  function observeTimelineChanges() {
    if (observer) return;
    const root = document.querySelector("#dayList") || document.body;
    observer = new MutationObserver((mutations) => {
      if (enhancing) return;
      if (!mutations.some((mutation) => mutation.type === "childList")) return;
      scheduleEnhance();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = window.setTimeout(enhance, 60);
  }

  function enhance() {
    enhancing = true;
    try {
      ensureBlankAddZone();
      stabilizeActivityDrag();
      normalizeDayAddButtons();
    } finally {
      window.setTimeout(() => { enhancing = false; }, 0);
    }
  }

  function ensureBlankAddZone() {
    const dayList = document.querySelector("#dayList");
    if (!dayList) return;
    let zone = dayList.querySelector(":scope > .timeline-blank-add-zone");
    if (!zone) {
      zone = document.createElement("button");
      zone.type = "button";
      zone.className = "timeline-blank-add-zone";
      zone.innerHTML = `<span aria-hidden="true">+</span>`;
      dayList.append(zone);
    }
    zone.setAttribute("aria-label", "添加日期");
    zone.title = "添加日期";
    zone.dataset.hotfixAction = "add-day";
  }

  function stabilizeActivityDrag() {
    document.querySelectorAll(".activity-row[data-activity-id]").forEach((row) => {
      if (row.dataset.dragBubbleFixed) return;
      row.dataset.dragBubbleFixed = "1";
      ["dragstart", "dragover", "drop", "dragend"].forEach((type) => {
        row.addEventListener(type, (event) => {
          event.stopPropagation();
        });
      });
    });
  }

  function normalizeDayAddButtons() {
    document.querySelectorAll(".day-header-plus").forEach((button) => button.remove());
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      const extras = [...card.querySelectorAll(":scope > .day-card-add-floating")];
      const keep = extras[0];
      extras.slice(1).forEach((button) => button.remove());
      if (keep) {
        keep.dataset.hotfixAction = "add-activity";
        keep.type = "button";
        keep.setAttribute("aria-label", "添加事项");
        keep.title = "添加事项";
        keep.textContent = "+";
        return;
      }
      const button = document.createElement("button");
      button.className = "day-card-add-floating";
      button.type = "button";
      button.dataset.hotfixAction = "add-activity";
      button.setAttribute("aria-label", "添加事项");
      button.title = "添加事项";
      button.textContent = "+";
      card.append(button);
    });
  }

  function handleClick(event) {
    const addDayZone = event.target.closest?.(".timeline-blank-add-zone,[data-hotfix-action='add-day']");
    if (addDayZone) {
      stop(event);
      addDay();
      return;
    }

    const addActivityButton = event.target.closest?.(".day-card-add-floating,[data-hotfix-action='add-activity']");
    if (addActivityButton) {
      stop(event);
      const dayId = addActivityButton.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      addInlineActivity(dayId);
    }
  }

  function handleKeyDown(event) {
    const addDayZone = event.target.closest?.(".timeline-blank-add-zone");
    if (!addDayZone || !["Enter", " "].includes(event.key)) return;
    stop(event);
    addDay();
  }

  function handleDragStartCapture(event) {
    const dayCard = event.target.closest?.(".day-card[data-day-id]");
    if (!dayCard) return;
    if (event.target.closest(".activity-row[data-activity-id]")) return;
    if (event.target.closest(".day-drag-handle,.drag-handle")) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function addDay() {
    const topButton = document.querySelector("#addDayTopBtn");
    if (topButton && !topButton.disabled) {
      topButton.click();
      scheduleEnhance();
      return;
    }
    toast("已达到天数上限");
  }

  function addInlineActivity(dayId) {
    const quickAdd = window.TripPlannerQuickAdd;
    if (typeof quickAdd === "function") {
      quickAdd(dayId || getSelectedDayId());
      return;
    }
    addTemplateActivityFallback(dayId || getSelectedDayId());
  }

  function addTemplateActivityFallback(dayId) {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === dayId) || trip?.days?.find((item) => item.id === trip.selectedDayId) || trip?.days?.[0];
    if (!library || !list || !trip || !day) {
      toast("行程还没加载完成");
      return;
    }
    const stamp = Date.now();
    const activity = {
      id: crypto.randomUUID(),
      time: "",
      title: "新事项",
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
    window.TripPlanner?.saveExternalLibrary?.(library, "inline-template-fallback-add");
    toast("已在当天末尾添加事项");
    window.setTimeout(() => openInlineTitle(activity.id), 140);
  }

  function openInlineTitle(activityId) {
    const row = document.querySelector(`.activity-row[data-activity-id="${cssEscape(activityId)}"]`);
    const title = row?.querySelector("strong[data-select-field='title']");
    if (!row || !title) return;
    title.click();
  }

  function getSelectedDayId() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || "";
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1600);
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value || "").replace(/"/g, '\\"');
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "interactionHotfixStyles";
    style.textContent = `
      #addListBtn.list-plus-button{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-radius:10px!important;border:1px solid rgba(15,143,131,.28)!important;background:#fff!important;color:var(--teal-dark)!important;box-shadow:none!important;font-size:22px!important;font-weight:860!important;line-height:1!important}#addListBtn.list-plus-button:hover,#addListBtn.list-plus-button:focus-visible{background:var(--teal-soft)!important;border-color:rgba(15,143,131,.48)!important;box-shadow:0 0 0 3px rgba(15,143,131,.1)!important;transform:translateY(-1px)}.list-panel .section-heading{align-items:center}.day-card{position:relative}.day-card-add-floating{position:absolute;right:56px;top:20px;z-index:8;display:grid!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;place-items:center;padding:0!important;border:1px solid rgba(15,143,131,.34)!important;border-radius:999px!important;background:#dff5f1!important;color:var(--teal-dark)!important;box-shadow:0 10px 22px rgba(15,143,131,.08)!important;font-size:25px!important;font-weight:880!important;line-height:1!important;appearance:none!important;transition:background 120ms var(--ease),border-color 120ms var(--ease),box-shadow 120ms var(--ease)}.day-card-add-floating:hover,.day-card-add-floating:focus-visible{outline:none!important;background:#cff0ea!important;border-color:rgba(15,143,131,.56)!important;box-shadow:0 0 0 4px rgba(15,143,131,.1),0 14px 30px rgba(15,143,131,.12)!important}.timeline-blank-add-zone{display:grid;width:100%;min-height:86px;place-items:center;border:1px dashed rgba(15,143,131,.24);border-radius:var(--radius);background:rgba(255,255,255,.42);color:var(--teal-dark);cursor:pointer;transition:border-color 160ms var(--ease),background 160ms var(--ease),box-shadow 160ms var(--ease),transform 160ms var(--ease)}.timeline-blank-add-zone:hover,.timeline-blank-add-zone:focus-visible{outline:none;border-color:rgba(15,143,131,.46);background:rgba(225,244,240,.66);box-shadow:0 12px 28px rgba(15,143,131,.08);transform:translateY(-1px)}.timeline-blank-add-zone span{display:grid;width:34px;height:34px;place-items:center;border-radius:999px;background:var(--teal-soft);font-size:24px;font-weight:900}#quickActivityModal[hidden]{display:none!important}@media(max-width:780px){#addListBtn.list-plus-button{width:40px!important;min-width:40px!important;height:40px!important}.day-card-add-floating{right:56px;top:18px;width:38px!important;height:38px!important}.timeline-blank-add-zone{min-height:74px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
