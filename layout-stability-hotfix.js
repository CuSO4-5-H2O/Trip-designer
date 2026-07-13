(() => {
  "use strict";

  const QUICK_STATE_KEY = "tripdesigner:quick-plan-expanded";
  let styleInstalled = false;
  let timer = 0;

  function init() {
    installStyles();
    document.addEventListener("click", handleClick, true);
    schedule();
    window.setTimeout(schedule, 250);
    window.setInterval(schedule, 1400);
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(stabilizeLayout, 50);
  }

  function stabilizeLayout() {
    stabilizeQuickPlan();
    compressCollapsedDays();
  }

  function stabilizeQuickPlan() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel) return;

    if (!panel.dataset.layoutDefaulted) {
      panel.dataset.layoutDefaulted = "1";
      const expanded = sessionStorage.getItem(QUICK_STATE_KEY) === "1";
      panel.classList.toggle("is-collapsed", !expanded);
    }

    const heading = panel.querySelector(".quick-plan-heading") || panel.querySelector(".section-heading") || panel;
    let toggles = [...panel.querySelectorAll(".quick-plan-toggle,[data-quick-collapse],[data-layout-quick-toggle]")];
    let keep = toggles[0];
    if (!keep) {
      keep = document.createElement("button");
      keep.className = "mini-action quick-plan-toggle";
      keep.type = "button";
      heading.append(keep);
    }

    keep.classList.remove("is-hidden-duplicate-action");
    keep.hidden = false;
    keep.removeAttribute("aria-hidden");
    keep.tabIndex = 0;
    keep.dataset.layoutQuickToggle = "1";
    delete keep.dataset.liteAction;
    keep.textContent = panel.classList.contains("is-collapsed") ? "展开" : "收起";

    toggles = [...panel.querySelectorAll(".quick-plan-toggle,[data-quick-collapse],[data-layout-quick-toggle]")];
    toggles.forEach((button) => {
      if (button === keep) return;
      button.remove();
    });
  }

  function compressCollapsedDays() {
    document.querySelectorAll(".day-card.is-collapsed").forEach((card) => {
      card.classList.add("layout-compressed-day");
    });
    document.querySelectorAll(".day-card:not(.is-collapsed).layout-compressed-day").forEach((card) => {
      card.classList.remove("layout-compressed-day");
    });
  }

  function handleClick(event) {
    const toggle = event.target.closest?.("[data-layout-quick-toggle]");
    if (!toggle) return;
    const panel = toggle.closest("#quickPlanPanel");
    if (!panel) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const collapsed = !panel.classList.contains("is-collapsed");
    panel.classList.toggle("is-collapsed", collapsed);
    sessionStorage.setItem(QUICK_STATE_KEY, collapsed ? "0" : "1");
    toggle.textContent = collapsed ? "展开" : "收起";
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "layoutStabilityHotfixStyles";
    style.textContent = `
      #quickPlanPanel.is-collapsed{padding:10px 12px;margin-bottom:12px}
      #quickPlanPanel.is-collapsed .quick-plan-form,
      #quickPlanPanel.is-collapsed .quick-plan-batch,
      #quickPlanPanel.is-collapsed .quick-entry-actions,
      #quickPlanPanel.is-collapsed .quick-segment-list{display:none!important}
      #quickPlanPanel .quick-plan-heading{margin-bottom:0}
      #quickPlanPanel .quick-plan-toggle{min-width:56px;min-height:34px;justify-content:center}
      .day-card.layout-compressed-day{min-height:0!important}
      .day-card.layout-compressed-day .day-content{display:none!important;padding:0!important}
      .day-card.layout-compressed-day .day-main{min-height:62px}
      .day-card,.day-list,.smart-panel{content-visibility:visible!important;contain-intrinsic-size:auto!important}
      @media(max-width:900px){.day-card:not(.active) .day-content{display:none!important}.day-card:not(.active){min-height:0!important}.day-card:not(.active) .day-main{min-height:58px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();