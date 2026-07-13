(() => {
  "use strict";

  let cleanupTimer = 0;
  let addDayMenu = null;
  let styleInstalled = false;

  function init() {
    installStyles();
    document.addEventListener("dblclick", handleDoubleClick, true);
    document.addEventListener("click", handleDocumentClick, true);
    scheduleCleanup();
    window.setTimeout(scheduleCleanup, 250);
    window.setInterval(scheduleCleanup, 1600);
  }

  function scheduleCleanup() {
    clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(cleanup, 40);
  }

  function cleanup() {
    const lowerAddDay = document.querySelector("#addDayBtn");
    if (lowerAddDay) {
      lowerAddDay.classList.add("is-hidden-duplicate-action");
      lowerAddDay.setAttribute("aria-hidden", "true");
      lowerAddDay.tabIndex = -1;
    }

    const quickPlan = document.querySelector("#quickPlanPanel");
    if (quickPlan?.querySelector("[data-quick-collapse]")) {
      quickPlan.querySelectorAll(".quick-plan-toggle").forEach((button) => {
        button.classList.add("is-hidden-duplicate-action");
        button.setAttribute("aria-hidden", "true");
        button.tabIndex = -1;
      });
    }
  }

  function handleDoubleClick(event) {
    const timeline = event.target.closest?.(".timeline-section");
    if (!timeline) return;
    if (event.target.closest(".day-card,.smart-panel,.quick-plan-panel,.detail-panel,button,input,textarea,select,a,label,[contenteditable='true']")) return;
    event.preventDefault();
    event.stopPropagation();
    showAddDayMenu(event.clientX, event.clientY);
  }

  function handleDocumentClick(event) {
    if (!addDayMenu) return;
    const add = event.target.closest?.("[data-timeline-action='add-day']");
    if (add) {
      event.preventDefault();
      closeAddDayMenu();
      clickAddDay();
      return;
    }
    if (!event.target.closest?.(".timeline-add-day-menu")) closeAddDayMenu();
  }

  function showAddDayMenu(x, y) {
    closeAddDayMenu();
    addDayMenu = document.createElement("div");
    addDayMenu.className = "timeline-add-day-menu";
    addDayMenu.innerHTML = `<button type="button" data-timeline-action="add-day"><span aria-hidden="true">+</span><strong>添加日期</strong></button>`;
    document.body.append(addDayMenu);
    const rect = addDayMenu.getBoundingClientRect();
    const left = Math.min(Math.max(12, x), window.innerWidth - rect.width - 12);
    const top = Math.min(Math.max(12, y), window.innerHeight - rect.height - 12);
    addDayMenu.style.left = `${left}px`;
    addDayMenu.style.top = `${top}px`;
  }

  function closeAddDayMenu() {
    addDayMenu?.remove();
    addDayMenu = null;
  }

  function clickAddDay() {
    const topButton = document.querySelector("#addDayTopBtn");
    if (topButton && !topButton.disabled) {
      topButton.click();
      return;
    }
    toast("已达到天数上限");
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1800);
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "timelineUiCleanupStyles";
    style.textContent = `
      .is-hidden-duplicate-action{display:none!important}.timeline-section{min-height:220px}.timeline-add-day-menu{position:fixed;z-index:110;padding:8px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(23,33,31,.18)}.timeline-add-day-menu button{display:inline-flex;align-items:center;gap:9px;min-height:44px;padding:0 14px;border:0;border-radius:10px;background:var(--teal-soft);color:var(--teal-dark);font:inherit;font-weight:900;cursor:pointer}.timeline-add-day-menu button:hover,.timeline-add-day-menu button:focus-visible{outline:none;background:var(--mint);transform:translateY(-1px)}.timeline-add-day-menu span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:999px;background:var(--teal);color:#fff;font-size:18px;line-height:1}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
