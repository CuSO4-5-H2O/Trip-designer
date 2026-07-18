(() => {
  "use strict";

  let observer = null;
  let retryTimer = 0;
  let activeDrag = null;

  function init() {
    installStyles();
    enhanceExistingRows();
    observeRows();
  }

  function observeRows() {
    if (observer || !window.MutationObserver) return;
    const root = document.querySelector("#dayList");
    if (!root) {
      retryTimer = window.setTimeout(observeRows, 250);
      return;
    }
    clearTimeout(retryTimer);
    observer = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1))) return;
      enhanceExistingRows();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function enhanceExistingRows() {
    document.querySelectorAll("#dayList .activity-row[data-activity-id]").forEach((row) => {
      if (row.dataset.dragScopeFixed === "1") return;
      row.dataset.dragScopeFixed = "1";
      row.setAttribute("draggable", "false");
      row.addEventListener("dragstart", stopAll);
      row.addEventListener("dragover", stopAll);
      row.addEventListener("drop", stopAll);
      row.addEventListener("dragend", stopAll);
      const handle = row.querySelector(".activity-drag-handle");
      if (!handle) return;
      handle.setAttribute("title", "拖动事项排序");
      handle.style.touchAction = "none";
      handle.addEventListener("pointerdown", startPointerDrag);
    });
  }

  function startPointerDrag(event) {
    const handle = event.currentTarget;
    const row = handle.closest(".activity-row[data-activity-id]");
    const list = row?.closest(".activity-list[data-day-id]");
    if (!row || !list || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    activeDrag = {
      pointerId: event.pointerId,
      row,
      list,
      startY: event.clientY,
      lastY: event.clientY,
      moved: false,
      originalOrder: rowIds(list),
    };
    row.classList.add("activity-pointer-dragging");
    list.classList.add("activity-drag-active");
    document.addEventListener("pointermove", movePointerDrag, true);
    document.addEventListener("pointerup", endPointerDrag, true);
    document.addEventListener("pointercancel", cancelPointerDrag, true);
  }

  function movePointerDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    activeDrag.lastY = event.clientY;
    if (Math.abs(activeDrag.lastY - activeDrag.startY) > 3) activeDrag.moved = true;
    const { row, list } = activeDrag;
    const siblings = [...list.querySelectorAll(".activity-row[data-activity-id]")].filter((item) => item !== row);
    const target = siblings.find((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (target) list.insertBefore(row, target);
    else list.append(row);
  }

  function endPointerDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const drag = activeDrag;
    cleanupPointerDrag();
    if (!drag.moved) return;
    const nextOrder = rowIds(drag.list);
    if (nextOrder.join("|") === drag.originalOrder.join("|")) return;
    saveOrderFromDom(drag.list, nextOrder);
  }

  function cancelPointerDrag(event) {
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return;
    const drag = activeDrag;
    const byId = new Map([...drag.list.querySelectorAll(".activity-row[data-activity-id]")].map((row) => [row.dataset.activityId, row]));
    drag.originalOrder.forEach((id) => {
      const row = byId.get(id);
      if (row) drag.list.append(row);
    });
    cleanupPointerDrag();
  }

  function cleanupPointerDrag() {
    if (!activeDrag) return;
    activeDrag.row.classList.remove("activity-pointer-dragging");
    activeDrag.list.classList.remove("activity-drag-active");
    activeDrag = null;
    document.removeEventListener("pointermove", movePointerDrag, true);
    document.removeEventListener("pointerup", endPointerDrag, true);
    document.removeEventListener("pointercancel", cancelPointerDrag, true);
  }

  function rowIds(list) {
    return [...list.querySelectorAll(".activity-row[data-activity-id]")].map((row) => row.dataset.activityId).filter(Boolean);
  }

  function saveOrderFromDom(list, orderedIds) {
    const dayId = list.dataset.dayId || list.closest(".day-card[data-day-id]")?.dataset.dayId;
    const library = window.TripPlanner?.getLibrary?.();
    const activeList = library?.lists?.find((item) => item.id === library.activeListId) || library?.lists?.[0];
    const trip = activeList?.trip;
    const day = trip?.days?.find((item) => item.id === dayId);
    if (!library || !activeList || !trip || !day) return;
    const byId = new Map((day.activities || []).map((activity) => [activity.id, activity]));
    const next = orderedIds.map((id) => byId.get(id)).filter(Boolean);
    for (const activity of day.activities || []) if (!orderedIds.includes(activity.id)) next.push(activity);
    const stamp = Date.now();
    day.activities = next;
    day.orderUpdatedAt = stamp;
    day.updatedAt = stamp;
    trip.orderUpdatedAt = stamp;
    trip.updatedAt = stamp;
    activeList.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, "pointer-reorder-activities");
  }

  function stopAll(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function installStyles() {
    if (document.querySelector("#activityDragScopeStyles")) return;
    const style = document.createElement("style");
    style.id = "activityDragScopeStyles";
    style.textContent = `
      .activity-row{transition:transform 120ms cubic-bezier(.22,1,.36,1),border-color 120ms ease,background 120ms ease}
      .activity-row .activity-drag-handle{cursor:grab;touch-action:none;user-select:none}
      .activity-row.activity-pointer-dragging{cursor:grabbing;border-color:rgba(15,143,131,.72)!important;background:#f0fbf8!important;box-shadow:0 10px 26px rgba(23,33,31,.12);z-index:3}
      .activity-list.activity-drag-active{outline:1px dashed rgba(15,143,131,.35);outline-offset:4px}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();