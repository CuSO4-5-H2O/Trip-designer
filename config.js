window.TRIP_PLANNER_CONFIG = {
  // Put your Render Web Service websocket endpoint here when the frontend is hosted on GitHub Pages.
  // Example: syncEndpoint: "wss://your-trip-planner.onrender.com/sync"
  syncEndpoint: "",
};

(() => {
  loadStyle("activity-tags", "./activity-tags.css?v=tags-20260712a");
  loadStyle("context-editor-performance", "./context-editor-performance.css?v=context-perf-20260712b");
  loadStyle("context-popover-fixes", "./context-popover-fixes.css?v=context-popovers-20260712a");

  loadScript("input-performance", "./input-performance.js?v=input-perf-20260712a");
  loadScript("activity-tags", "./activity-tags.js?v=tags-20260712a");
  loadScript("context-popover-fixes", "./context-popover-fixes.js?v=context-popovers-20260712a");

  function loadStyle(name, href) {
    if (document.querySelector(`link[data-trip-style="${name}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.tripStyle = name;
    document.head.append(link);
  }

  function loadScript(name, src) {
    if (document.querySelector(`script[data-trip-script="${name}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.tripScript = name;
    document.body.append(script);
  }
})();
