(() => {
  "use strict";

  let observer = null;
  let retryTimer = 0;

  function init() {
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
      row.setAttribute("draggable", "true");
      row.querySelector(".activity-drag-handle")?.setAttribute("title", "拖动事项排序");
      row.addEventListener("dragstart", stopBubbleOnly);
      row.addEventListener("dragover", stopBubbleOnly);
      row.addEventListener("drop", stopBubbleOnly);
      row.addEventListener("dragend", stopBubbleOnly);
    });
  }

  function stopBubbleOnly(event) {
    event.stopPropagation();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();