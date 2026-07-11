window.TRIP_PLANNER_CONFIG = {
  // Put your Render Web Service websocket endpoint here when the frontend is hosted on GitHub Pages.
  // Example: syncEndpoint: "wss://your-trip-planner.onrender.com/sync"
  syncEndpoint: "",
};

(() => {
  loadStyle("context-editor-performance", "./context-editor-performance.css?v=context-perf-20260712b");
  loadStyle("activity-tags", "./activity-tags.css?v=tags-20260712a");

  if (!document.querySelector('script[data-activity-tags="true"]')) {
    const script = document.createElement("script");
    script.src = "./activity-tags.js?v=tags-20260712a";
    script.dataset.activityTags = "true";
    document.body.append(script);
  }

  function loadStyle(name, href) {
    if (document.querySelector(`link[data-trip-style="${name}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.tripStyle = name;
    document.head.append(link);
  }
})();
