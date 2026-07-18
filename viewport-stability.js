(() => {
  "use strict";

  const STABLE_CLICK_SELECTOR = [
    ".day-card-add-floating",
    ".inline-empty-add",
    ".activity-row [data-select-field]",
    "[data-day-field]",
    ".edit-activity",
  ].join(",");

  let restoring = false;

  function shouldProtect(node) {
    return Boolean(node?.closest?.("#dayList"));
  }

  function captureViewport() {
    const x = window.scrollX || 0;
    const y = window.scrollY || 0;
    return () => restoreViewport(x, y);
  }

  function restoreViewport(x, y) {
    if (restoring) return;
    restoring = true;
    let tick = 0;
    const restore = () => {
      if (Math.abs((window.scrollY || 0) - y) > 1 || Math.abs((window.scrollX || 0) - x) > 1) {
        window.scrollTo(x, y);
      }
    };
    const frame = () => {
      restore();
      tick += 1;
      if (tick < 5) window.requestAnimationFrame(frame);
      else restoring = false;
    };
    restore();
    window.requestAnimationFrame(frame);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 90);
    window.setTimeout(restore, 220);
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.(STABLE_CLICK_SELECTOR);
    if (!target || !shouldProtect(target)) return;
    const restore = captureViewport();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 120);
    window.setTimeout(restore, 260);
  }, true);

  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function patchedFocus(options) {
    if (!shouldProtect(this)) return nativeFocus.call(this, options);
    const restore = captureViewport();
    try {
      return nativeFocus.call(this, { ...(options || {}), preventScroll: true });
    } finally {
      restore();
    }
  };

  const inputSelect = HTMLInputElement.prototype.select;
  HTMLInputElement.prototype.select = function patchedInputSelect() {
    if (!shouldProtect(this)) return inputSelect.call(this);
    const restore = captureViewport();
    try {
      return inputSelect.call(this);
    } finally {
      restore();
    }
  };

  const textAreaSelect = HTMLTextAreaElement.prototype.select;
  HTMLTextAreaElement.prototype.select = function patchedTextAreaSelect() {
    if (!shouldProtect(this)) return textAreaSelect.call(this);
    const restore = captureViewport();
    try {
      return textAreaSelect.call(this);
    } finally {
      restore();
    }
  };
})();