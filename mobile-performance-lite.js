(() => {
  "use strict";

  let styleInstalled = false;
  let timer = 0;

  function init() {
    installStyles();
    window.addEventListener("resize", scheduleMobilePass);
    document.addEventListener("click", scheduleMobilePass, true);
    scheduleMobilePass();
    window.setTimeout(scheduleMobilePass, 350);
    window.setInterval(scheduleMobilePass, 1500);
  }

  function scheduleMobilePass() {
    clearTimeout(timer);
    timer = window.setTimeout(runMobilePass, 80);
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function runMobilePass() {
    if (!isMobile()) return;
    collapseSmartPanelsOnce();
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

  function installStyles() {
    if (styleInstalled) return;
    styleInstalled = true;
    const style = document.createElement("style");
    style.id = "mobilePerformanceLiteStyles";
    style.textContent = `
      @media(max-width:900px){
        .day-card:not(.active) .day-content{display:none!important}
        .day-card:not(.active){min-height:0!important}
        .day-card:not(.active) .day-main{min-height:58px}
        .smart-map-panel.is-collapsed .map-canvas,
        .smart-map-panel.is-collapsed #mapStatus,
        .smart-map-panel.is-collapsed #routeStatus,
        .smart-map-panel.is-collapsed .route-summary,
        .smart-map-panel.is-collapsed .route-list,
        .ai-panel.is-collapsed .ai-status,
        .ai-panel.is-collapsed .ai-results{display:none!important}
        .smart-map-panel.is-collapsed,.ai-panel.is-collapsed{min-height:auto}
        .day-card{contain:layout paint}
        .activity-row{contain:layout paint}
      }
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();