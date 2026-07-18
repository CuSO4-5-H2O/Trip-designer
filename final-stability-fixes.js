(() => {
  "use strict";

  let observer = null;
  let timer = 0;
  let running = false;

  function init() {
    installStyles();
    harden();
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    observe();
  }

  function observe() {
    if (observer || !window.MutationObserver) return;
    const root = document.querySelector("#dayList") || document.body;
    observer = new MutationObserver((mutations) => {
      if (running) return;
      if (!mutations.some(isUsefulMutation)) return;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
  }

  function isUsefulMutation(mutation) {
    if (mutation.type === "attributes") {
      const node = mutation.target;
      return node instanceof Element && !node.closest(".inline-activity-input,.inline-compound-editor");
    }
    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => node.nodeType === 1 && (
      node.matches?.(".day-card,.activity-row,.day-meta,.smart-panel,#quickPlanPanel,.timeline-blank-add-zone") ||
      node.querySelector?.(".day-card,.activity-row,.day-meta,.smart-panel,#quickPlanPanel,.timeline-blank-add-zone")
    ));
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(harden, 90);
  }

  function harden() {
    running = true;
    try {
      cleanListButton();
      hideDuplicateDayMeta();
      dedupeCollapseButtons();
      normalizeRows();
      normalizeBlankAddZone();
      trimDuplicateFloatingAdds();
    } finally {
      window.setTimeout(() => { running = false; }, 0);
    }
  }

  function cleanListButton() {
    const button = document.querySelector("#addListBtn");
    if (!button) return;
    button.classList.add("list-plus-button");
    button.textContent = "+";
    button.setAttribute("aria-label", "新建、导入、恢复和导出");
    button.title = "新建、导入、恢复和导出";
  }

  function hideDuplicateDayMeta() {
    document.querySelectorAll("#dayList .day-meta").forEach((meta) => {
      meta.setAttribute("aria-hidden", "true");
      meta.classList.add("is-hidden-day-meta");
    });
  }

  function dedupeCollapseButtons() {
    document.querySelectorAll("#quickPlanPanel,.smart-map-panel,.ai-panel").forEach((panel) => {
      const toggles = [...panel.querySelectorAll("button")].filter((button) => /^(展开|收起)$/.test(button.textContent.trim()));
      if (toggles.length <= 1) return;
      const keep = toggles[toggles.length - 1];
      toggles.forEach((button) => { if (button !== keep) button.remove(); });
    });
  }

  function normalizeRows() {
    document.querySelectorAll("#dayList .activity-row[data-activity-id]").forEach((row) => {
      row.classList.add("stable-activity-row");
      row.setAttribute("draggable", "false");
      const time = row.querySelector(".activity-time");
      if (time && !time.textContent.trim()) time.textContent = "时间";
      const body = row.querySelector(".activity-body");
      if (!body) return;
      body.querySelectorAll("[data-select-field='place'],[data-select-field='note'],[data-select-field='budget'],[data-select-field='transport']").forEach((node) => node.classList.add("stable-chip"));
    });
  }

  function normalizeBlankAddZone() {
    const dayList = document.querySelector("#dayList");
    if (!dayList) return;
    let zone = dayList.querySelector(":scope > .timeline-blank-add-zone");
    if (!zone) {
      zone = document.createElement("button");
      zone.type = "button";
      zone.className = "timeline-blank-add-zone";
      zone.innerHTML = `<span aria-hidden="true">+</span>`;
      dayList.append(zone);
    }
    zone.disabled = Boolean(document.querySelector("#addDayTopBtn")?.disabled);
    zone.dataset.finalAction = "add-day";
    zone.setAttribute("aria-label", "添加日期");
    zone.title = "添加日期";
  }

  function trimDuplicateFloatingAdds() {
    document.querySelectorAll("#dayList .day-card[data-day-id]").forEach((card) => {
      const buttons = [...card.querySelectorAll(":scope > .day-card-add-floating")];
      buttons.slice(1).forEach((button) => button.remove());
      const button = buttons[0];
      if (!button) return;
      button.textContent = "+";
      button.dataset.finalAction = "add-activity";
      button.setAttribute("aria-label", "添加事项");
      button.title = "添加事项";
    });
  }

  function handleClick(event) {
    const addDay = event.target.closest?.(".timeline-blank-add-zone,[data-final-action='add-day']");
    if (addDay) {
      stop(event);
      clickAddDay();
      return;
    }

    const edit = event.target.closest?.(".edit-activity");
    if (edit) {
      const row = edit.closest(".activity-row[data-activity-id]");
      const title = row?.querySelector("strong[data-select-field='title']");
      if (title) {
        stop(event);
        title.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
    }
  }

  function handleKeyDown(event) {
    const zone = event.target.closest?.(".timeline-blank-add-zone");
    if (!zone || !["Enter", " "].includes(event.key)) return;
    stop(event);
    clickAddDay();
  }

  function clickAddDay() {
    const button = document.querySelector("#addDayTopBtn");
    if (button && !button.disabled) {
      button.click();
      schedule();
      return;
    }
    toast("已达到天数上限");
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  function toast(text) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = text;
    node.classList.add("show");
    window.setTimeout(() => node.classList.remove("show"), 1600);
  }

  function installStyles() {
    if (document.querySelector("#finalStabilityFixesStyles")) return;
    const style = document.createElement("style");
    style.id = "finalStabilityFixesStyles";
    style.textContent = `
      #addListBtn.list-plus-button{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;padding:0!important;border-radius:10px!important;font-size:24px!important;line-height:1!important;display:grid!important;place-items:center!important}
      #dayList .day-meta.is-hidden-day-meta{display:none!important}
      #dayList .day-card{overflow-anchor:none!important;contain:layout paint style!important}
      #dayList .day-content{padding-top:14px!important}
      #dayList .activity-list{display:grid!important;gap:10px!important;overflow-anchor:none!important}
      #dayList .activity-row.stable-activity-row{display:grid!important;grid-template-columns:82px minmax(0,1fr) auto!important;align-items:start!important;gap:14px!important;min-height:74px!important;padding:14px 16px!important;border-radius:8px!important;background:#fff!important;transition:border-color 120ms var(--ease),background 120ms var(--ease),box-shadow 120ms var(--ease)!important;transform:none!important;overflow-anchor:none!important}
      #dayList .activity-row.stable-activity-row.selected-context,#dayList .activity-row.stable-activity-row.inline-editing-row{border-color:rgba(15,143,131,.72)!important;box-shadow:0 0 0 3px rgba(15,143,131,.12)!important;background:#f7fffc!important}
      #dayList .activity-row .activity-time{min-width:74px!important;min-height:32px!important;display:inline-flex!important;align-items:center!important;color:var(--teal-dark)!important;font-weight:900!important;line-height:32px!important}
      #dayList .activity-row .activity-body{display:flex!important;align-items:center!important;align-content:center!important;gap:8px!important;flex-wrap:wrap!important;min-width:0!important;padding-top:0!important}
      #dayList .activity-row .activity-body>strong{min-height:32px!important;display:inline-flex!important;align-items:center!important;margin-right:8px!important;font-size:17px!important;line-height:1.25!important;max-width:100%!important;word-break:break-word!important}
      #dayList .activity-row .activity-body p{margin:0!important;min-height:32px!important;display:inline-flex!important;align-items:center!important;color:var(--muted)!important}
      #dayList .activity-row .stable-chip,#dayList .activity-row .inline-field-chip,#dayList .activity-row .activity-transport-add,#dayList .activity-row .activity-transport-chip{height:32px!important;min-height:32px!important;padding:0 13px!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;font-size:14px!important;font-weight:850!important;margin:0!important;vertical-align:middle!important;border:1px solid transparent!important;background:#f4f8f6!important;color:var(--muted)!important;white-space:nowrap!important}
      #dayList .activity-row [data-select-field='budget'],#dayList .activity-row .inline-budget-chip{background:#fff5f1!important;color:#b63a28!important;border-color:#f3d8d0!important}
      #dayList .activity-row .activity-actions{display:inline-flex!important;align-items:center!important;gap:8px!important;align-self:start!important;min-width:96px!important;justify-content:flex-end!important}
      #dayList .activity-row .activity-actions button{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:8px!important;display:grid!important;place-items:center!important;padding:0!important}
      #dayList .inline-activity-input{height:32px!important;min-height:32px!important;border-radius:999px!important;margin:0!important;align-self:center!important;vertical-align:middle!important}
      #dayList .activity-body .inline-title-input{height:36px!important;border-radius:8px!important;flex:1 1 320px!important;min-width:min(260px,100%)!important;width:auto!important}
      #dayList .activity-body .inline-chip-input{flex:0 1 190px!important;width:190px!important;max-width:min(54vw,260px)!important}
      #dayList .inline-compound-editor{min-height:32px!important;display:inline-flex!important;align-items:center!important;gap:8px!important;margin:0!important;vertical-align:middle!important}
      #dayList .timeline-blank-add-zone{min-height:76px!important;border-radius:8px!important;margin-top:10px!important}
      .smart-map-panel,.ai-panel,#quickPlanPanel{overflow-anchor:none!important;transition:none!important}
      @media(max-width:780px){#dayList .activity-row.stable-activity-row{grid-template-columns:64px minmax(0,1fr) auto!important;gap:10px!important;padding:12px!important;min-height:68px!important}#dayList .activity-row .activity-time{min-width:60px!important;font-size:14px!important}#dayList .activity-row .activity-actions{min-width:80px!important;gap:4px!important}#dayList .activity-row .activity-actions button{width:30px!important;height:30px!important;min-width:30px!important}#dayList .activity-row .activity-body>strong{font-size:16px!important}#dayList .activity-row .stable-chip,#dayList .activity-row .inline-field-chip,#dayList .activity-row .activity-transport-add,#dayList .activity-row .activity-transport-chip{font-size:13px!important;padding:0 10px!important}#dayList .activity-body .inline-title-input{flex-basis:100%!important;min-width:0!important}#dayList .inline-compound-editor{width:100%!important;flex-wrap:wrap!important}}
    `;
    document.head.append(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
