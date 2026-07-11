(() => {
  "use strict";

  const delays = new Map([
    ["tripTitle", 320],
    ["originCity", 360],
    ["memberName", 420],
    ["listNameInput", 320],
    ["detailLocation", 280],
    ["detailStay", 280],
    ["budgetLimitInput", 360],
    ["dayLimitInput", 120],
  ]);
  const pending = new Map();

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!event.isTrusted || !(target instanceof HTMLInputElement)) return;
    const delay = delays.get(target.id);
    if (!delay) return;

    event.stopImmediatePropagation();
    schedule(target, delay);
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && delays.has(target.id)) flush(target);
  }, true);

  document.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && delays.has(target.id)) flush(target);
  }, true);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key === "Enter" && target instanceof HTMLInputElement && delays.has(target.id)) flush(target);
  }, true);

  document.addEventListener("pointerup", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "dayLimitInput") flush(target);
  }, true);

  window.addEventListener("beforeunload", () => {
    [...pending.keys()].forEach((element) => flush(element, true));
  });

  function schedule(element, delay) {
    const existing = pending.get(element);
    if (existing) clearTimeout(existing);
    pending.set(element, window.setTimeout(() => flush(element), delay));
  }

  function flush(element, synchronous = false) {
    const timer = pending.get(element);
    if (!timer) return;
    clearTimeout(timer);
    pending.delete(element);

    const dispatch = () => {
      if (!element.isConnected && !synchronous) return;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    };

    if (synchronous) dispatch();
    else queueMicrotask(dispatch);
  }
})();
