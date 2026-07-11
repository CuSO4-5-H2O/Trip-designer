(() => {
  "use strict";

  let tagAnchor = null;
  let budgetAnchor = null;
  let frame = 0;

  document.addEventListener("click", (event) => {
    const tagButton = event.target.closest?.(".activity-tag-add");
    if (tagButton) {
      tagAnchor = tagButton;
      requestAnimationFrame(positionTagPopover);
      window.setTimeout(positionTagPopover, 30);
    }

    const costChip = event.target.closest?.(".cost-chip");
    if (costChip) {
      budgetAnchor = costChip.closest(".activity-row") || costChip;
      requestAnimationFrame(positionBudgetEditor);
      window.setTimeout(positionBudgetEditor, 30);
    }
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const budgetEditor = document.querySelector("#budgetEditor:not(.hidden)");
    const budgetCard = budgetEditor?.querySelector(".budget-editor-card");
    if (budgetEditor && budgetCard && !budgetCard.contains(event.target) && !event.target.closest?.(".cost-chip")) {
      document.querySelector("#budgetCancelBtn")?.click();
      budgetAnchor = null;
    }
  }, true);

  window.addEventListener("resize", schedulePosition, { passive: true });
  window.addEventListener("scroll", schedulePosition, { passive: true, capture: true });

  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      positionTagPopover();
      positionBudgetEditor();
    });
  }

  function positionTagPopover() {
    const popover = document.querySelector(".activity-tag-popover:not([hidden])");
    if (!popover || !tagAnchor?.isConnected) return;
    positionBeside(popover, tagAnchor.getBoundingClientRect(), 300, true);
  }

  function positionBudgetEditor() {
    const editor = document.querySelector("#budgetEditor:not(.hidden)");
    const card = editor?.querySelector(".budget-editor-card");
    if (!card || !budgetAnchor?.isConnected) return;
    positionBeside(card, budgetAnchor.getBoundingClientRect(), 390, false);
  }

  function positionBeside(element, anchorRect, preferredWidth, important) {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const margin = viewportWidth <= 700 ? 8 : 12;
    const gap = 9;
    const width = Math.min(preferredWidth, viewportWidth - margin * 2);

    setStyle(element, "width", `${width}px`, important);
    setStyle(element, "right", "auto", true);
    setStyle(element, "bottom", "auto", true);

    const height = Math.min(element.scrollHeight || element.offsetHeight || 260, viewportHeight - margin * 2);
    let left;
    let top;

    if (viewportWidth > 700 && anchorRect.right + gap + width <= viewportWidth - margin) {
      left = anchorRect.right + gap;
      top = clamp(anchorRect.top, margin, viewportHeight - height - margin);
    } else if (viewportWidth > 700 && anchorRect.left - gap - width >= margin) {
      left = anchorRect.left - gap - width;
      top = clamp(anchorRect.top, margin, viewportHeight - height - margin);
    } else {
      left = clamp(anchorRect.left, margin, viewportWidth - width - margin);
      const below = anchorRect.bottom + gap;
      top = below + height <= viewportHeight - margin
        ? below
        : Math.max(margin, anchorRect.top - height - gap);
    }

    setStyle(element, "left", `${Math.round(left)}px`, true);
    setStyle(element, "top", `${Math.round(top)}px`, true);
  }

  function setStyle(element, property, value, important) {
    element.style.setProperty(property, value, important ? "important" : "");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
})();
