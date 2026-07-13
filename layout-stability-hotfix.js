(() => {
  "use strict";

  const QUICK_STATE_KEY = "tripdesigner:quick-plan-expanded";
  let styleInstalled = false;
  let timer = 0;
  let observer = null;
  let stabilizing = false;

  function init() {
    installStyles();
    document.addEventListener("click", handleClick, true);
    schedule();
    window.setTimeout(schedule, 250);
    observeDomChanges();
  }

  function observeDomChanges() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      if (stabilizing) return;
      if (!mutations.some(isRelevantMutation)) return;
      schedule();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden"],
    });
  }

  function isRelevantMutation(mutation) {
    const node = mutation.target;
    if (!(node instanceof Element)) return false;
    return Boolean(
      node.closest?.("#quickPlanPanel,.smart-map-panel,.ai-panel,.day-card") ||
      node.matches?.("#quickPlanPanel,.smart-map-panel,.ai-panel,.day-card")
    );
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(stabilizeLayout, 80);
  }

  function stabilizeLayout() {
    stabilizing = true;
    try {
      stabilizeQuickPlan();
      stabilizeSmartPanels();
      compressCollapsedDays();
    } finally {
      window.setTimeout(() => {
        stabilizing = false;
      }, 0);
    }
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
    let keep = toggles.find((button) => button.dataset.layoutQuickToggle === "1") || toggles[0];
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
    const nextText = panel.classList.contains("is-collapsed") ? "展开" : "收起";
    if (keep.textContent !== nextText) keep.textContent = nextText;

    toggles = [...panel.querySelectorAll(".quick-plan-toggle,[data-quick-collapse],[data-layout-quick-toggle]")];
    toggles.forEach((button) => {
      if (button !== keep) button.remove();
    });
  }

  function stabilizeSmartPanels() {
    document.querySelectorAll(".smart-map-panel,.ai-panel").forEach((panel) => {
      const kind = panel.classList.contains("ai-panel") ? "ai" : "map";
      const button = panel.querySelector(`[data-panel-collapse="${kind}"]`);
      if (!button) return;
      const nextText = panel.classList.contains("is-collapsed") ? "展开" : "收起";
      if (button.textContent !== nextText) button.textContent = nextText;
    });
  }

  function compressCollapsedDays() {
    document.querySelectorAll(".day-card").forEach((card) => {
      const shouldCompress = card.classList.contains("is-collapsed");
      card.classList.toggle("layout-compressed-day", shouldCompress);
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
      .smart-map-panel,.ai-panel{transition:none!important;overflow:hidden}
      .smart-map-panel.is-collapsed,.ai-panel.is-collapsed{min-height:0!important;height:auto!important;padding-bottom:10px!important}
      .smart-map-panel.is-collapsed .map-canvas,
      .smart-map-panel.is-collapsed #mapStatus,
      .smart-map-panel.is-collapsed #routeStatus,
      .smart-map-panel.is-collapsed .route-status,
      .smart-map-panel.is-collapsed .route-list,
      .ai-panel.is-collapsed .ai-status,
      .ai-panel.is-collapsed .ai-results,
      .ai-panel.is-collapsed .ai-body,
      .ai-panel.is-collapsed .ai-result,
      .ai-panel.is-collapsed .ai-error,
      .ai-panel.is-collapsed .ai-actions{display:none!important}
      .day-card.layout-compressed-day{min-height:0!important}
      .day-card.layout-compressed-day .day-content{display:none!important;padding:0!important}
      .day-card.layout-compressed-day .day-main{min-height:62px}
      .day-card,.activity-row,.smart-panel,.smart-map-panel,.ai-panel{animation:none!important}
      .day-card,.day-list,.smart-panel{content-visibility:visible!important;contain-intrinsic-size:auto!important}
      @media(max-width:900px){.day-card.is-collapsed .day-content{display:none!important}.day-card.is-collapsed{min-height:0!important}.day-card.is-collapsed .day-main{min-height:58px}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
