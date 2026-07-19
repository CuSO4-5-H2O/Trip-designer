(() => {
  "use strict";

  function init() {
    const button = document.querySelector("#accountHomeBtn");
    if (!button) return;
    button.addEventListener("click", () => {
      const url = new URL(location.href);
      url.search = "";
      url.hash = "";
      location.assign(url.toString());
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
