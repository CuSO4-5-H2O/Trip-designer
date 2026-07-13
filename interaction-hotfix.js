(() => {
  "use strict";

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
      window.setTimeout(() => {
        enhancing = false;
      }, 0);
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
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      card.querySelector(".day-main .day-header-plus")?.remove();
      if (card.querySelector(":scope > .day-card-add-floating")) return;
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
      event.preventDefault();
      event.stopPropagation();
      addDay();
      return;
    }

    const addActivityButton = event.target.closest?.(".day-header-plus,.day-card-add-floating,[data-lite-action='add-activity']");
    if (addActivityButton) {
      event.preventDefault();
      event.stopPropagation();
      const dayId = addActivityButton.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      openAddActivity(dayId);
      return;
    }
  }

  function handleKeyDown(event) {
    const addDayZone = event.target.closest?.(".timeline-blank-add-zone");
    if (!addDayZone || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
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

  function openAddActivity(dayId) {
    if (dayId) window.TripPlanner?.selectDay?.(dayId);
    window.setTimeout(() => {
      document.querySelector("#cancelEditActivityBtn")?.click?.();
      document.body.classList.add("detail-drawer-open");
      const title = document.querySelector("#activityTitle");
      title?.focus({ preventScroll: true });
      toast("正在添加事项");
    }, 80);
  }

  function getSelectedDayId() {
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    return list?.trip?.selectedDayId || list?.trip?.days?.[0]?.id || "";
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1600);
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "interactionHotfixStyles";
    style.textContent = `
      #addListBtn.list-plus-button{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-radius:10px!important;border:1px solid rgba(15,143,131,.28)!important;background:#fff!important;color:var(--teal-dark)!important;box-shadow:none!important;font-size:22px!important;font-weight:860!important;line-height:1!important}#addListBtn.list-plus-button:hover,#addListBtn.list-plus-button:focus-visible{background:var(--teal-soft)!important;border-color:rgba(15,143,131,.48)!important;box-shadow:0 0 0 3px rgba(15,143,131,.1)!important;transform:translateY(-1px)}.list-panel .section-heading{align-items:center}.day-card{position:relative}.day-card-add-floating{position:absolute;right:52px;top:19px;z-index:4;display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(15,143,131,.24);border-radius:999px;background:var(--teal-soft);color:var(--teal-dark);box-shadow:0 10px 22px rgba(15,143,131,.08);font-size:25px;font-weight:880;line-height:1;transition:transform 160ms var(--ease),border-color 160ms var(--ease),background 160ms var(--ease),box-shadow 160ms var(--ease)}.day-card-add-floating:hover,.day-card-add-floating:focus-visible{outline:none;background:#e5f8f4;border-color:rgba(15,143,131,.48);box-shadow:0 0 0 4px rgba(15,143,131,.1),0 14px 30px rgba(15,143,131,.12);transform:translateY(-1px)}.timeline-blank-add-zone{display:grid;width:100%;min-height:86px;place-items:center;border:1px dashed rgba(15,143,131,.24);border-radius:var(--radius);background:rgba(255,255,255,.42);color:var(--teal-dark);cursor:pointer;transition:border-color 160ms var(--ease),background 160ms var(--ease),box-shadow 160ms var(--ease),transform 160ms var(--ease)}.timeline-blank-add-zone:hover,.timeline-blank-add-zone:focus-visible{outline:none;border-color:rgba(15,143,131,.46);background:rgba(225,244,240,.66);box-shadow:0 12px 28px rgba(15,143,131,.08);transform:translateY(-1px)}.timeline-blank-add-zone span{display:grid;width:34px;height:34px;place-items:center;border-radius:999px;background:var(--teal-soft);font-size:24px;font-weight:900}@media(max-width:780px){#addListBtn.list-plus-button{width:40px!important;min-width:40px!important;height:40px!important}.day-card-add-floating{right:54px;top:18px;width:42px;height:42px}.timeline-blank-add-zone{min-height:74px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
