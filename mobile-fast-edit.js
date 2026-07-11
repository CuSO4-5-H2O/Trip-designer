(() => {
  "use strict";

  const dayList = document.querySelector("#dayList");
  const detailPanel = document.querySelector(".detail-panel");
  const editor = document.querySelector(".detail-sticky");
  const activityForm = document.querySelector("#activityForm");
  const closeButton = document.querySelector("#mobileDetailCloseBtn");
  const cancelButton = document.querySelector("#cancelEditActivityBtn");

  if (!dayList || !detailPanel || !editor || !activityForm) return;

  let activeAnchor = null;
  let fallbackRect = null;
  let positionFrame = 0;
  let openingFrame = 0;

  const pointer = document.createElement("span");
  pointer.className = "context-editor-pointer";
  pointer.setAttribute("aria-hidden", "true");
  document.body.append(pointer);

  enhanceCards(dayList);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(".day-card")) enhanceDayCard(node);
        node.querySelectorAll?.(".day-card").forEach(enhanceDayCard);
      });
    });
    if (document.body.classList.contains("context-editor-open")) schedulePosition();
  });
  observer.observe(dayList, { childList: true, subtree: false });

  dayList.addEventListener("click", handleDayListClick);
  document.addEventListener("click", captureExistingEditActions, true);
  document.addEventListener("pointerdown", handleOutsidePointer, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEditor();
  });

  closeButton?.addEventListener("click", (event) => {
    event.preventDefault();
    closeEditor();
  });
  cancelButton?.addEventListener("click", () => window.setTimeout(closeEditor, 0));
  activityForm.addEventListener("submit", () => window.setTimeout(closeEditor, 70));

  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("scroll", (event) => {
    if (editor.contains(event.target)) return;
    schedulePosition();
  }, { passive: true, capture: true });

  function handleDayListClick(event) {
    const quickButton = event.target.closest("[data-context-action]");
    if (quickButton) {
      event.preventDefault();
      event.stopPropagation();
      const card = quickButton.closest(".day-card");
      if (!card) return;
      const action = quickButton.dataset.contextAction;
      selectDay(card);
      if (action === "add") resetActivityDraft();
      const focusSelector = action === "location"
        ? "#detailLocation"
        : action === "stay"
          ? "#detailStay"
          : "#activityTitle";
      openEditorFor(card, focusSelector);
      return;
    }

    const row = event.target.closest(".activity-row[data-day-id][data-activity-id]");
    if (!row || !event.isTrusted) return;
    if (event.target.closest("button, input, textarea, select, a, .activity-tag-strip, .cost-chip, .drag-handle")) return;

    const editButton = row.querySelector('[data-action="edit"]');
    if (!editButton) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = row.getBoundingClientRect();
    setActivityAnchor(row, rect);
    editButton.click();
    scheduleOpen("#activityTitle", rect);
  }

  function captureExistingEditActions(event) {
    if (!event.isTrusted) return;

    const mobileAdd = event.target.closest('[data-insight-scroll="#activityForm"]');
    if (mobileAdd) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const card = dayList.querySelector(".day-card.active") || dayList.querySelector(".day-card");
      if (!card) return;
      selectDay(card);
      resetActivityDraft();
      openEditorFor(card, "#activityTitle");
      return;
    }

    const action = event.target.closest('.edit-activity, .activity-transport-chip, .activity-transport-add, .editable-pill');
    if (!action) return;

    const row = action.closest(".activity-row[data-day-id][data-activity-id]");
    if (row) {
      const rect = row.getBoundingClientRect();
      setActivityAnchor(row, rect);
      const focusSelector = action.matches(".activity-transport-chip, .activity-transport-add")
        ? ".activity-transport"
        : "#activityTitle";
      scheduleOpen(focusSelector, rect);
      return;
    }

    const card = action.closest(".day-card[data-day-id]");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    setDayAnchor(card, rect);
    const label = `${action.getAttribute("aria-label") || ""} ${action.title || ""}`;
    scheduleOpen(label.includes("住宿") ? "#detailStay" : "#detailLocation", rect);
  }

  function handleOutsidePointer(event) {
    if (!document.body.classList.contains("context-editor-open")) return;
    if (editor.contains(event.target)) return;
    if (event.target.closest(".activity-row, .day-quick-actions, .editable-pill")) return;
    closeEditor();
  }

  function enhanceCards(root) {
    root.querySelectorAll(".day-card").forEach(enhanceDayCard);
  }

  function enhanceDayCard(card) {
    if (card.querySelector(".day-quick-actions")) return;
    const meta = card.querySelector(".day-meta");
    if (!meta) return;

    const actions = document.createElement("div");
    actions.className = "day-quick-actions";
    actions.innerHTML = `
      <button class="day-quick-button" type="button" data-context-action="location" aria-label="修改当天地点">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z M12 10.5h.01" /></svg>
        <span>改地点</span>
      </button>
      <button class="day-quick-button" type="button" data-context-action="stay" aria-label="修改住宿">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12M4 12h16M8 12V9h8v3" /></svg>
        <span>改住宿</span>
      </button>
      <button class="day-quick-button primary" type="button" data-context-action="add" aria-label="添加事项">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>加事项</span>
      </button>
    `;
    meta.after(actions);
  }

  function selectDay(card) {
    card.querySelector(".day-main")?.click();
  }

  function resetActivityDraft() {
    document.querySelector("#cancelEditActivityBtn:not(.hidden)")?.click();
  }

  function openEditorFor(anchor, focusSelector) {
    const rect = anchor.getBoundingClientRect();
    if (anchor.matches(".activity-row")) setActivityAnchor(anchor, rect);
    else setDayAnchor(anchor, rect);
    scheduleOpen(focusSelector, rect);
  }

  function setActivityAnchor(row, rect) {
    activeAnchor = {
      type: "activity",
      dayId: row.dataset.dayId,
      activityId: row.dataset.activityId,
    };
    fallbackRect = cloneRect(rect);
  }

  function setDayAnchor(card, rect) {
    activeAnchor = { type: "day", dayId: card.dataset.dayId };
    fallbackRect = cloneRect(rect);
  }

  function scheduleOpen(focusSelector, rect) {
    fallbackRect = cloneRect(rect || fallbackRect);
    cancelAnimationFrame(openingFrame);
    openingFrame = requestAnimationFrame(() => {
      document.body.classList.add("context-editor-open");
      detailPanel.setAttribute("aria-hidden", "false");
      requestAnimationFrame(() => {
        positionEditor();
        const field = editor.querySelector(focusSelector) || document.querySelector(focusSelector);
        field?.scrollIntoView?.({ block: "nearest" });
        field?.focus?.({ preventScroll: true });
        if (field instanceof HTMLInputElement && field.type !== "time" && typeof field.select === "function") field.select();
      });
    });
  }

  function closeEditor() {
    cancelAnimationFrame(openingFrame);
    document.body.classList.remove("context-editor-open");
    detailPanel.setAttribute("aria-hidden", "true");
    document.querySelectorAll(".context-editor-anchor").forEach((node) => node.classList.remove("context-editor-anchor"));
    pointer.style.display = "none";
    activeAnchor = null;
    fallbackRect = null;
  }

  function schedulePosition() {
    if (!document.body.classList.contains("context-editor-open")) return;
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(positionEditor);
  }

  function positionEditor() {
    if (!document.body.classList.contains("context-editor-open")) return;
    const anchor = findCurrentAnchor();
    const rect = anchor?.getBoundingClientRect() || fallbackRect;
    if (!rect) return;

    document.querySelectorAll(".context-editor-anchor").forEach((node) => node.classList.remove("context-editor-anchor"));
    anchor?.classList.add("context-editor-anchor");

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const margin = viewportWidth <= 680 ? 8 : 12;
    const gap = 10;
    const width = Math.min(viewportWidth <= 680 ? 400 : 430, viewportWidth - margin * 2);
    editor.style.width = `${width}px`;
    editor.style.maxHeight = `${Math.max(260, viewportHeight - margin * 2)}px`;

    const editorHeight = Math.min(editor.scrollHeight, viewportHeight - margin * 2);
    let left;
    let top;
    let side = "right";

    if (viewportWidth <= 680) {
      left = clamp(rect.left, margin, viewportWidth - width - margin);
      const below = rect.bottom + gap;
      top = below + editorHeight <= viewportHeight - margin
        ? below
        : Math.max(margin, rect.top - editorHeight - gap);
      side = top >= rect.bottom ? "below" : "above";
    } else if (rect.right + gap + width <= viewportWidth - margin) {
      left = rect.right + gap;
      top = clamp(rect.top, margin, viewportHeight - editorHeight - margin);
      side = "right";
    } else if (rect.left - gap - width >= margin) {
      left = rect.left - gap - width;
      top = clamp(rect.top, margin, viewportHeight - editorHeight - margin);
      side = "left";
    } else {
      left = clamp(rect.left, margin, viewportWidth - width - margin);
      const below = rect.bottom + gap;
      top = below + editorHeight <= viewportHeight - margin
        ? below
        : Math.max(margin, rect.top - editorHeight - gap);
      side = top >= rect.bottom ? "below" : "above";
    }

    editor.style.left = `${Math.round(left)}px`;
    editor.style.top = `${Math.round(top)}px`;
    fallbackRect = cloneRect(rect);
    positionPointer(rect, { left, top, width, height: editorHeight }, side);
  }

  function positionPointer(anchorRect, editorRect, side) {
    pointer.style.display = "block";
    if (side === "right") {
      pointer.style.left = `${Math.round(editorRect.left - 7)}px`;
      pointer.style.top = `${Math.round(clamp(anchorRect.top + 24, editorRect.top + 18, editorRect.top + editorRect.height - 24))}px`;
      pointer.style.transform = "rotate(-45deg)";
      return;
    }
    if (side === "left") {
      pointer.style.left = `${Math.round(editorRect.left + editorRect.width - 7)}px`;
      pointer.style.top = `${Math.round(clamp(anchorRect.top + 24, editorRect.top + 18, editorRect.top + editorRect.height - 24))}px`;
      pointer.style.transform = "rotate(135deg)";
      return;
    }
    pointer.style.left = `${Math.round(clamp(anchorRect.left + 28, editorRect.left + 18, editorRect.left + editorRect.width - 24))}px`;
    pointer.style.top = `${Math.round(side === "below" ? editorRect.top - 7 : editorRect.top + editorRect.height - 7)}px`;
    pointer.style.transform = side === "below" ? "rotate(45deg)" : "rotate(225deg)";
  }

  function findCurrentAnchor() {
    if (!activeAnchor) return null;
    const dayId = cssEscape(activeAnchor.dayId);
    if (activeAnchor.type === "activity") {
      const activityId = cssEscape(activeAnchor.activityId);
      return dayList.querySelector(`.activity-row[data-day-id="${dayId}"][data-activity-id="${activityId}"]`);
    }
    return dayList.querySelector(`.day-card[data-day-id="${dayId}"]`);
  }

  function cloneRect(rect) {
    if (!rect) return null;
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(String(value || ""));
    return String(value || "").replace(/["\\]/g, "\\$&");
  }
})();
