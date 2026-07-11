window.TRIP_PLANNER_CONFIG = {
  // Put your Render Web Service websocket endpoint here when the frontend is hosted on GitHub Pages.
  // Example: syncEndpoint: "wss://your-trip-planner.onrender.com/sync"
  syncEndpoint: "",
};

(() => {
  if (!document.querySelector('link[data-activity-tags="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./activity-tags.css?v=tags-20260712a";
    link.dataset.activityTags = "true";
    document.head.append(link);
  }

  if (!document.querySelector('script[data-activity-tags="true"]')) {
    const script = document.createElement("script");
    script.src = "./activity-tags.js?v=tags-20260712a";
    script.dataset.activityTags = "true";
    document.body.append(script);
  }
})();