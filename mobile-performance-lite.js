(() => {
  "use strict";

  let styleInstalled = false;
  let timer = 0;

  function init() {
    installStyles();
    document.addEventListener("click", scheduleTrim, true);
    window.addEventListener("resize", scheduleTrim);
    scheduleTrim();
    window.setTimeout(scheduleTrim, 300);
    window.setInterval(scheduleTrim, 1200);
  }

  function scheduleTrim() {
    clearTimeout(timer);
    timer = window.setTimeout(trimMobileTimeline, 80);
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function trimMobileTimeline() {
    if (!isMobile()) return;
    collapseSmartPanelsOnce();
    document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
      const list = card.querySelector(".activity-list");
      if (!list) return;
      if (card.classList.contains("active")) {
        list.dataset.mobileTrimmed = "";
        return;
      }
      if (list.dataset.mobileTrimmed === "1") return;
      const count = list.querySelectorAll(".activity-row").length;
      list.replaceChildren();
      const placeholder = document.createElement("div");
      placeholder.className = "mobile-trim-placeholder";
      placeholder.textContent = count ? `点击当天查看 ${count} 项` : "点击当天添加事项";
      list.append(placeholder);
      list.dataset.mobileTrimmed = "1";
    });
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
      @media(max-width:900px){.day-card:not(.active) .day-content{display:none!important}.mobile-trim-placeholder{padding:12px;border:1px dashed var(--line);border-radius:var(--radius-sm);color:var(--muted);font-size:13px;font-weight:800}.smart-map-panel.is-collapsed .map-canvas,.smart-map-panel.is-collapsed #mapStatus,.smart-map-panel.is-collapsed #routeStatus,.ai-panel.is-collapsed .ai-status,.ai-panel.is-collapsed .ai-results{display:none!important}.smart-map-panel.is-collapsed,.ai-panel.is-collapsed{min-height:auto}.day-list{content-visibility:auto;contain-intrinsic-size:1400px}.smart-panel{content-visibility:auto;contain-intrinsic-size:480px}.day-card{contain:layout paint}.activity-row{contain:layout paint}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
