(() => {
  "use strict";

  let styleInstalled = false;
  let observer = null;
  let passTimer = 0;

  function init() {
    installStyles();
    scheduleMobilePass(0);
    window.addEventListener("resize", () => scheduleMobilePass(80), { passive: true });
    observePanelCreation();
    window.setTimeout(() => scheduleMobilePass(0), 300);
    window.setTimeout(() => scheduleMobilePass(0), 900);
    window.setTimeout(() => scheduleMobilePass(0), 1800);
  }

  function scheduleMobilePass(delay = 80) {
    clearTimeout(passTimer);
    passTimer = window.setTimeout(runMobilePass, delay);
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function runMobilePass() {
    if (!isMobile()) return;
    collapseSmartPanelsOnce();
    collapseQuickPlanOnce();
  }

  function observePanelCreation() {
    if (observer || !window.MutationObserver || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (!isMobile()) return;
      const hasNewPanel = mutations.some((mutation) => [...mutation.addedNodes].some((node) =>
        node.nodeType === 1 && (
          node.matches?.(".smart-map-panel,.ai-panel,#quickPlanPanel") ||
          node.querySelector?.(".smart-map-panel,.ai-panel,#quickPlanPanel")
        )
      ));
      if (hasNewPanel) scheduleMobilePass(40);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function collapseSmartPanelsOnce() {
    document.querySelectorAll(".smart-map-panel,.ai-panel").forEach((panel) => {
      if (panel.dataset.mobileCollapsedOnce) return;
      panel.dataset.mobileCollapsedOnce = "1";
      panel.classList.add("is-collapsed");
      panel.querySelectorAll("[data-panel-collapse]").forEach((button) => {
        button.textContent = "展开";
      });
    });
  }

  function collapseQuickPlanOnce() {
    const panel = document.querySelector("#quickPlanPanel");
    if (!panel || panel.dataset.mobileCollapsedOnce) return;
    panel.dataset.mobileCollapsedOnce = "1";
    panel.classList.add("is-collapsed");
    panel.querySelectorAll("[data-quick-collapse]").forEach((button) => {
      button.textContent = "展开";
      button.setAttribute("aria-expanded", "false");
    });
  }

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "mobilePerformanceLiteStyles";
    style.textContent = `
      @media(max-width:900px){
        .workspace{display:flex!important;flex-direction:column!important;gap:12px!important;width:100%!important;max-width:100%!important}
        .timeline-section{order:1;display:flex!important;flex-direction:column!important;gap:12px!important;width:100%;min-width:0}
        .sidebar{order:2;width:100%;min-width:0}.detail-panel{order:3;width:100%;min-width:0}
        .timeline-head{order:1}.day-list,#dayList{order:2;display:grid!important;gap:12px!important}.quick-plan-panel{order:3}.smart-panel{order:4;display:grid!important;gap:12px!important;width:100%;min-width:0}
        .quick-plan-panel.is-collapsed .quick-plan-form,
        .quick-plan-panel.is-collapsed .quick-plan-batch,
        .quick-plan-panel.is-collapsed .quick-segment-list{display:none!important}
        .quick-plan-panel.is-collapsed{min-height:auto!important;padding-block:10px!important}
        .smart-map-panel.is-collapsed .map-canvas,
        .smart-map-panel.is-collapsed .map-provider-switch,
        .smart-map-panel.is-collapsed #mapStatus,
        .smart-map-panel.is-collapsed #routeStatus,
        .smart-map-panel.is-collapsed .route-summary,
        .smart-map-panel.is-collapsed .route-list,
        .ai-panel.is-collapsed .ai-status,
        .ai-panel.is-collapsed .ai-results,
        .ai-panel.is-collapsed .ai-quick-plan{display:none!important}
        .smart-map-panel.is-collapsed,.ai-panel.is-collapsed{min-height:auto!important;padding-block:12px!important}
        .day-card:not(.active) .day-content{display:none!important}
        .day-card:not(.active){min-height:0!important}
        .day-card:not(.active) .day-main{min-height:58px}
        .day-card{contain:layout paint;scroll-margin-top:12px}
        .activity-row{contain:layout paint;scroll-margin-top:12px}
        .day-main,.activity-row{touch-action:manipulation}
        .day-card button,.activity-row button,.mini-action,.icon-button,.primary-action,.ghost-action{min-width:44px;min-height:44px;touch-action:manipulation}
        .activity-actions{position:relative;z-index:4;pointer-events:auto;gap:6px!important}
        .day-order-actions{position:relative;z-index:4;pointer-events:auto}
        .day-card-add-floating,.day-header-plus{position:relative;z-index:5;pointer-events:auto}
        .activity-row .activity-body{min-width:0}
        .list-plus-menu{z-index:160!important}
        .timeline-add-day-menu{z-index:150!important}
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
