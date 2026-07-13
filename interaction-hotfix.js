(() => {
  "use strict";

  let styleInstalled = false;
  let enhanceTimer = 0;
  let observer = null;
  let enhancing = false;
  let activeQuickDayId = "";

  function init() {
    installStyles();
    ensureQuickActivityModal();
    window.TripPlannerQuickAdd = openAddActivity;
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
      ensureQuickActivityModal();
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
    document.querySelectorAll(".day-header-plus").forEach((button) => button.remove());
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      const extras = [...card.querySelectorAll(":scope > .day-card-add-floating")];
      const keep = extras[0];
      extras.slice(1).forEach((button) => button.remove());
      if (keep) {
        keep.dataset.hotfixAction = "add-activity";
        keep.type = "button";
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

  function ensureQuickActivityModal() {
    if (document.querySelector("#quickActivityModal")) return;
    const modal = document.createElement("div");
    modal.id = "quickActivityModal";
    modal.className = "quick-activity-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="quick-activity-backdrop" data-quick-activity-close="1"></div>
      <form class="quick-activity-card" id="quickActivityForm">
        <div class="quick-activity-head">
          <strong>添加事项</strong>
          <button type="button" class="quick-activity-close" data-quick-activity-close="1" aria-label="关闭">×</button>
        </div>
        <label><span>时间</span><input id="quickActivityTime" type="time"></label>
        <label><span>事项</span><input id="quickActivityTitle" type="text" placeholder="例如：参观博物馆" required></label>
        <label><span>地点</span><input id="quickActivityPlace" type="text" placeholder="地点，可不填"></label>
        <div class="quick-activity-actions">
          <button type="button" class="ghost-action" data-quick-activity-close="1">取消</button>
          <button type="submit" class="primary-action">保存</button>
        </div>
      </form>`;
    document.body.append(modal);
    modal.addEventListener("click", (event) => {
      if (!event.target.closest("[data-quick-activity-close]")) return;
      event.preventDefault();
      closeQuickActivityModal();
    });
    modal.querySelector("#quickActivityForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      saveQuickActivity();
    });
  }

  function handleClick(event) {
    const addDayZone = event.target.closest?.(".timeline-blank-add-zone,[data-hotfix-action='add-day']");
    if (addDayZone) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      addDay();
      return;
    }

    const addActivityButton = event.target.closest?.(".day-card-add-floating,[data-hotfix-action='add-activity']");
    if (addActivityButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const dayId = addActivityButton.closest(".day-card[data-day-id]")?.dataset.dayId || getSelectedDayId();
      openAddActivity(dayId);
      return;
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape" && !document.querySelector("#quickActivityModal")?.hidden) {
      event.preventDefault();
      closeQuickActivityModal();
      return;
    }
    const addDayZone = event.target.closest?.(".timeline-blank-add-zone");
    if (!addDayZone || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
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
    ensureQuickActivityModal();
    activeQuickDayId = dayId || getSelectedDayId();
    if (activeQuickDayId) window.TripPlanner?.selectDay?.(activeQuickDayId);
    const modal = document.querySelector("#quickActivityModal");
    modal.hidden = false;
    modal.classList.add("is-open");
    const time = modal.querySelector("#quickActivityTime");
    const title = modal.querySelector("#quickActivityTitle");
    const place = modal.querySelector("#quickActivityPlace");
    time.value = "";
    title.value = "";
    place.value = "";
    window.setTimeout(() => title.focus({ preventScroll: true }), 30);
  }

  function closeQuickActivityModal() {
    const modal = document.querySelector("#quickActivityModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
  }

  function saveQuickActivity() {
    const modal = document.querySelector("#quickActivityModal");
    const title = modal?.querySelector("#quickActivityTitle")?.value.trim();
    if (!title) {
      toast("请先填写事项");
      modal?.querySelector("#quickActivityTitle")?.focus({ preventScroll: true });
      return;
    }
    const library = window.TripPlanner?.getLibrary?.();
    const list = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    const trip = list?.trip;
    const day = trip?.days?.find((item) => item.id === activeQuickDayId) || trip?.days?.find((item) => item.id === trip.selectedDayId) || trip?.days?.[0];
    if (!library || !list || !trip || !day) {
      toast("行程还没加载完成");
      return;
    }
    const stamp = Date.now();
    day.activities ||= [];
    day.activities.push({
      id: crypto.randomUUID(),
      time: modal.querySelector("#quickActivityTime")?.value || "",
      title,
      place: modal.querySelector("#quickActivityPlace")?.value.trim() || "",
      note: "",
      tags: [],
      done: false,
      budget: null,
      transport: null,
      updatedAt: stamp,
    });
    day.updatedAt = stamp;
    day.orderUpdatedAt = stamp;
    trip.selectedDayId = day.id;
    trip.updatedAt = stamp;
    list.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, "quick-add-activity");
    closeQuickActivityModal();
    toast("事项已添加");
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
      #addListBtn.list-plus-button{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;border-radius:10px!important;border:1px solid rgba(15,143,131,.28)!important;background:#fff!important;color:var(--teal-dark)!important;box-shadow:none!important;font-size:22px!important;font-weight:860!important;line-height:1!important}#addListBtn.list-plus-button:hover,#addListBtn.list-plus-button:focus-visible{background:var(--teal-soft)!important;border-color:rgba(15,143,131,.48)!important;box-shadow:0 0 0 3px rgba(15,143,131,.1)!important;transform:translateY(-1px)}.list-panel .section-heading{align-items:center}.day-card{position:relative}.day-card-add-floating{position:absolute;right:56px;top:20px;z-index:8;display:grid!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;place-items:center;padding:0!important;border:1px solid rgba(15,143,131,.34)!important;border-radius:999px!important;background:#dff5f1!important;color:var(--teal-dark)!important;box-shadow:0 10px 22px rgba(15,143,131,.08)!important;font-size:25px!important;font-weight:880!important;line-height:1!important;appearance:none!important;transition:background 120ms var(--ease),border-color 120ms var(--ease),box-shadow 120ms var(--ease)}.day-card-add-floating:hover,.day-card-add-floating:focus-visible{outline:none!important;background:#cff0ea!important;border-color:rgba(15,143,131,.56)!important;box-shadow:0 0 0 4px rgba(15,143,131,.1),0 14px 30px rgba(15,143,131,.12)!important}.timeline-blank-add-zone{display:grid;width:100%;min-height:86px;place-items:center;border:1px dashed rgba(15,143,131,.24);border-radius:var(--radius);background:rgba(255,255,255,.42);color:var(--teal-dark);cursor:pointer;transition:border-color 160ms var(--ease),background 160ms var(--ease),box-shadow 160ms var(--ease),transform 160ms var(--ease)}.timeline-blank-add-zone:hover,.timeline-blank-add-zone:focus-visible{outline:none;border-color:rgba(15,143,131,.46);background:rgba(225,244,240,.66);box-shadow:0 12px 28px rgba(15,143,131,.08);transform:translateY(-1px)}.timeline-blank-add-zone span{display:grid;width:34px;height:34px;place-items:center;border-radius:999px;background:var(--teal-soft);font-size:24px;font-weight:900}.quick-activity-modal[hidden]{display:none!important}.quick-activity-modal{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px}.quick-activity-backdrop{position:absolute;inset:0;background:rgba(12,24,22,.32);backdrop-filter:blur(3px)}.quick-activity-card{position:relative;z-index:1;width:min(420px,calc(100vw - 28px));display:grid;gap:12px;padding:16px;border:1px solid rgba(15,143,131,.22);border-radius:14px;background:#fff;box-shadow:0 24px 80px rgba(12,24,22,.22)}.quick-activity-head{display:flex;align-items:center;justify-content:space-between}.quick-activity-close{width:34px;height:34px;border:1px solid rgba(15,143,131,.18);border-radius:999px;background:#fff;color:var(--ink);font-size:22px;line-height:1}.quick-activity-card label{display:grid;gap:6px;font-weight:800;color:var(--muted)}.quick-activity-card input{width:100%;min-height:44px;border:1px solid rgba(18,38,34,.16);border-radius:10px;padding:10px 12px;font:inherit;color:var(--ink);background:#fff}.quick-activity-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:4px}@media(max-width:780px){#addListBtn.list-plus-button{width:40px!important;min-width:40px!important;height:40px!important}.day-card-add-floating{right:56px;top:18px;width:38px!important;height:38px!important}.timeline-blank-add-zone{min-height:74px}.quick-activity-modal{align-items:end}.quick-activity-card{border-radius:16px 16px 0 0;width:100%;max-width:none}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
