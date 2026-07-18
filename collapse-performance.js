(() => {
  "use strict";

  const STORAGE_PREFIX = "tripdesigner:collapsed-days:";
  const ANIMATION_MS = 170;
  let saveTimer = 0;
  let observer = null;
  let observeRetry = 0;

  function init() {
    installStyles();
    document.addEventListener("click", handleDayClick, true);
    document.addEventListener("keydown", handleDayKey, true);
    observeDayList();
    applyStoredState();
  }

  function handleDayKey(event) {
    if (!["Enter", " "].includes(event.key)) return;
    const main = event.target.closest?.(".day-main");
    if (!main || !shouldHandle(main, event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    toggleCard(main.closest(".day-card[data-day-id]"));
  }

  function handleDayClick(event) {
    const main = event.target.closest?.(".day-main");
    if (!main || !shouldHandle(main, event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    toggleCard(main.closest(".day-card[data-day-id]"));
  }

  function shouldHandle(main, target) {
    if (!main.closest("#dayList")) return false;
    if (target.closest(".day-delete-inline,.drag-handle,.day-drag-handle,.day-inline-actions,[data-day-field],input,textarea,select,.inline-activity-input,.inline-budget-editor,.inline-transport-editor,.activity-row,.activity-list,.inline-empty-add")) return false;
    const nestedButton = target.closest("button");
    return !nestedButton || nestedButton === main;
  }

  function toggleCard(card) {
    if (!card) return;
    const content = card.querySelector(".day-content");
    const main = card.querySelector(".day-main");
    if (!content || !main) return;

    const willCollapse = !card.classList.contains("is-collapsed");
    card.classList.add("fast-collapse-managed");
    card.classList.toggle("is-collapsed", willCollapse);
    card.classList.toggle("is-expanded", !willCollapse);
    main.setAttribute("aria-expanded", String(!willCollapse));

    animateContent(content, willCollapse);
    remember(card.dataset.dayId, willCollapse);
  }

  function animateContent(content, collapse) {
    content.style.overflow = "hidden";
    content.style.transition = `max-height ${ANIMATION_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${ANIMATION_MS}ms ease`;
    if (collapse) {
      content.style.maxHeight = `${content.scrollHeight}px`;
      content.style.opacity = "1";
      requestAnimationFrame(() => {
        content.style.maxHeight = "0px";
        content.style.opacity = "0";
      });
      window.setTimeout(() => {
        if (content.closest(".is-collapsed")) content.hidden = true;
      }, ANIMATION_MS + 30);
      return;
    }

    content.hidden = false;
    content.style.maxHeight = "0px";
    content.style.opacity = "0";
    requestAnimationFrame(() => {
      content.style.maxHeight = `${content.scrollHeight}px`;
      content.style.opacity = "1";
    });
    window.setTimeout(() => {
      if (!content.closest(".is-collapsed")) {
        content.style.maxHeight = "";
        content.style.overflow = "";
      }
    }, ANIMATION_MS + 30);
  }

  function observeDayList() {
    if (observer || !window.MutationObserver) return;
    const root = document.querySelector("#dayList");
    if (!root) {
      observeRetry = window.setTimeout(observeDayList, 250);
      return;
    }
    clearTimeout(observeRetry);
    observer = new MutationObserver((mutations) => {
      if (!mutations.some(hasDayCardStructureChange)) return;
      applyStoredState();
    });
    observer.observe(root, { childList: true });
  }

  function hasDayCardStructureChange(mutation) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.some((node) => node.nodeType === 1 && (node.matches?.(".day-card") || node.querySelector?.(".day-card")));
  }

  function applyStoredState() {
    const collapsed = readCollapsed();
    document.querySelectorAll("#dayList .day-card[data-day-id]").forEach((card) => {
      const isCollapsed = collapsed.has(card.dataset.dayId);
      const content = card.querySelector(".day-content");
      const main = card.querySelector(".day-main");
      card.classList.add("fast-collapse-managed");
      card.classList.toggle("is-collapsed", isCollapsed);
      card.classList.toggle("is-expanded", !isCollapsed);
      if (main) main.setAttribute("aria-expanded", String(!isCollapsed));
      if (content) {
        content.hidden = isCollapsed;
        if (isCollapsed) {
          content.style.maxHeight = "0px";
          content.style.opacity = "0";
        } else if (!content.style.transition) {
          content.style.maxHeight = "";
          content.style.opacity = "";
          content.style.overflow = "";
        }
      }
    });
  }

  function remember(dayId, collapsed) {
    if (!dayId) return;
    const set = readCollapsed();
    if (collapsed) set.add(dayId);
    else set.delete(dayId);
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => writeCollapsed(set), 60);
  }

  function readCollapsed() {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey()) || "[]"));
    } catch {
      return new Set();
    }
  }

  function writeCollapsed(set) {
    try { localStorage.setItem(storageKey(), JSON.stringify([...set])); } catch {}
  }

  function storageKey() {
    const room = window.TripRoom?.id || new URLSearchParams(location.search).get("room") || "LOCAL";
    return `${STORAGE_PREFIX}${room}`;
  }

  function installStyles() {
    if (document.querySelector("#collapsePerformanceStyles")) return;
    const style = document.createElement("style");
    style.id = "collapsePerformanceStyles";
    style.textContent = `
      .day-card.fast-collapse-managed .day-content{will-change:max-height,opacity}.day-card.fast-collapse-managed.is-collapsed .day-content{max-height:0!important;opacity:0!important;overflow:hidden!important}.day-card.fast-collapse-managed.is-expanded .day-content{opacity:1}.day-card.fast-collapse-managed .day-main{touch-action:manipulation}.day-card.fast-collapse-managed.is-collapsed{contain:layout paint}.day-card.fast-collapse-managed.is-collapsed .activity-list{pointer-events:none}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
