(() => {
  const mobileQuery = window.matchMedia("(max-width: 780px)");
  const dayButtonClass = "day-quick-button";

  function isMobileLayout() {
    return mobileQuery.matches;
  }

  function openDrawer() {
    if (!isMobileLayout()) return;
    document.body.classList.add("detail-drawer-open");
  }

  function closeDrawer() {
    document.body.classList.remove("detail-drawer-open");
  }

  function focusField(selector) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const field = document.querySelector(selector);
        if (!field) return;
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        field.focus();
        if (typeof field.select === "function") field.select();
      });
    });
  }

  function selectDay(card) {
    card.querySelector(".day-main")?.click();
    openDrawer();
  }

  function resetActivityDraft() {
    const cancelButton = document.querySelector("#cancelEditActivityBtn:not(.hidden)");
    cancelButton?.click();
  }

  function createQuickButton(label, iconPath, onClick, variant = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [dayButtonClass, variant].filter(Boolean).join(" ");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="${iconPath}" />
      </svg>
      <span>${label}</span>
    `;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function enhanceDayCard(card) {
    if (card.querySelector(".day-quick-actions")) return;
    const meta = card.querySelector(".day-meta");
    if (!meta) return;

    const quickActions = document.createElement("div");
    quickActions.className = "day-quick-actions";
    quickActions.append(
      createQuickButton("改地点", "M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z M12 10.5h.01", () => {
        selectDay(card);
        focusField("#detailLocation");
      }),
      createQuickButton("改住宿", "M4 20V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12M4 12h16M8 12V9h8v3", () => {
        selectDay(card);
        focusField("#detailStay");
      }),
      createQuickButton("+ 事项", "M12 5v14M5 12h14", () => {
        selectDay(card);
        resetActivityDraft();
        focusField("#activityTitle");
      }, "primary"),
    );
    meta.after(quickActions);
  }

  function enhanceCards() {
    document.querySelectorAll(".day-card").forEach(enhanceDayCard);
  }

  function bindDrawerControls() {
    document.querySelector("#mobileDetailCloseBtn")?.addEventListener("click", closeDrawer);
    document.querySelector(".detail-panel")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeDrawer();
    });

    document.addEventListener("click", (event) => {
      const dayMain = event.target.closest(".day-main");
      if (dayMain && !event.target.closest(".drag-handle")) {
        requestAnimationFrame(openDrawer);
      }

      if (event.target.closest(".edit-activity, .activity-transport-chip, .activity-transport-add, .editable-pill")) {
        requestAnimationFrame(openDrawer);
      }
    });

    document.querySelector("#activityForm")?.addEventListener("submit", () => {
      window.setTimeout(closeDrawer, 80);
    });
  }

  function init() {
    bindDrawerControls();
    enhanceCards();
    const observer = new MutationObserver(enhanceCards);
    observer.observe(document.querySelector("#dayList") || document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
