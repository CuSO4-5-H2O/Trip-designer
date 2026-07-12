(() => {
  "use strict";

  const providerStoreKey = "tripdesigner:map-provider";
  const scriptPromises = new Map();
  let scope = "list";
  let configPromise = null;
  let renderTimer = 0;
  let renderToken = 0;
  let activeRuntime = { provider: "", map: null, overlays: [] };

  const modeLabels = {
    plane: "飞机",
    train: "火车",
    bus: "大巴",
    boat: "船",
    car: "车",
    walk: "步行",
  };

  function init() {
    document.addEventListener("click", (event) => {
      const mapButton = event.target.closest?.("[data-map]");
      if (mapButton) {
        scope = mapButton.dataset.map || "list";
        scheduleRender(80);
      }
      if (event.target.closest?.(".day-main")) {
        scope = "day";
        scheduleRender(140);
      }
      if (event.target.closest?.(".trip-list-item")) {
        scope = "list";
        scheduleRender(160);
      }
    });

    document.addEventListener("change", (event) => {
      if (event.target?.id === "mapProviderSelect") {
        localStorage.setItem(providerStoreKey, event.target.value || "auto");
        resetRuntime();
        scheduleRender(10);
      }
    });

    const observer = new MutationObserver(() => scheduleRender(180));
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleRender(250);
  }

  function scheduleRender(delay = 80) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderProviderMap, delay);
  }

  async function renderProviderMap() {
    const panel = document.querySelector(".smart-map-panel");
    const canvas = document.querySelector("#tripMap");
    const status = document.querySelector("#mapStatus");
    if (!panel || !canvas || !status || !window.TripPlanner?.getLibrary) return;

    installToolbar(panel);
    const entries = buildEntries();
    if (!entries.length) {
      status.textContent = "还没有可定位地点";
      setRouteStatus("");
      resetRuntime(false);
      canvas.classList.add("is-provider-map");
      return;
    }

    const token = ++renderToken;
    status.textContent = "正在定位行程地点";
    setRouteStatus("正在计算路线和时间");

    try {
      const config = await loadConfig();
      const provider = chooseProvider(config);
      if (provider === "none") {
        status.textContent = "Render 未配置高德或 Google 地图 key";
        setRouteStatus("在 Render 环境变量中配置 gaodemap_key 或 googlemap 后可用");
        return;
      }

      await loadProviderScript(provider, config);
      const response = await fetch("/api/map/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, entries }),
      });
      const plan = await response.json();
      if (!response.ok || !plan.ok) throw new Error(plan.error || "地图路线生成失败");
      if (token !== renderToken) return;

      if (provider === "google") drawGoogle(canvas, plan);
      else drawAmap(canvas, plan);
      renderRouteSummary(plan);
      const located = (plan.points || []).filter((point) => point.located !== false).length;
      const failed = (plan.points || []).length - located;
      status.textContent = failed ? `已定位 ${located} 个地点，${failed} 个未定位` : `已定位 ${located} 个地点`;
    } catch (error) {
      if (token !== renderToken) return;
      status.textContent = error.message || "地图加载失败";
      setRouteStatus("请检查地点是否足够具体，或切换地图服务后重试");
    }
  }

  function installToolbar(panel) {
    const head = panel.querySelector(".smart-panel-head");
    if (!head || head.querySelector(".map-provider-toolbar")) return;
    const segmented = head.querySelector(".segmented");
    const toolbar = document.createElement("div");
    toolbar.className = "map-provider-toolbar";
    if (segmented) toolbar.append(segmented);
    toolbar.insertAdjacentHTML("beforeend", `
      <label class="map-provider-field">
        <span>地图</span>
        <select id="mapProviderSelect" aria-label="选择地图服务">
          <option value="auto">自动</option>
          <option value="amap">高德</option>
          <option value="google">Google</option>
        </select>
      </label>
    `);
    head.append(toolbar);
    const select = toolbar.querySelector("#mapProviderSelect");
    select.value = localStorage.getItem(providerStoreKey) || "auto";
    if (!panel.querySelector("#routeStatus")) {
      panel.insertAdjacentHTML("beforeend", `<div class="route-status" id="routeStatus"></div>`);
    }
  }

  function buildEntries() {
    const library = window.TripPlanner.getLibrary();
    const list = (library.lists || []).find((item) => item.id === library.activeListId) || library.lists?.[0];
    const trip = list?.trip;
    if (!trip?.days?.length) return [];
    const selected = trip.days.find((day) => day.id === trip.selectedDayId) || trip.days[0];
    const days = scope === "day" ? [selected] : trip.days;
    const out = [];
    const push = (query, label, dayLabel, mode = "car") => {
      query = String(query || "").trim();
      label = String(label || query).trim();
      if (!query || !label) return;
      const last = out[out.length - 1];
      if (last && normalize(last.query) === normalize(query) && normalize(last.label) === normalize(label)) return;
      out.push({ query, label, day: dayLabel, mode });
    };

    days.filter(Boolean).forEach((day) => {
      const dayIndex = trip.days.indexOf(day) + 1;
      const dayLabel = `第 ${dayIndex} 天`;
      const city = String(day.location || trip.originCity || "").trim();
      push(city, city || dayLabel, `${dayLabel} 城市`, "car");
      (day.activities || []).forEach((activity) => {
        const transport = activity.transport || {};
        const mode = transport.type || "car";
        if (transport.from) push(withContext(city, transport.from), `${activity.title || "行程"} 出发`, dayLabel, mode);
        const target = transport.to || activity.place || activity.title;
        push(withContext(city, target), activity.place || activity.title || target, `${dayLabel} · ${activity.title || "事项"}`, mode);
      });
      push(withContext(city, day.stay), day.stay, `${dayLabel} 住宿`, "car");
    });
    return out.slice(0, 40);
  }

  function withContext(city, place) {
    place = String(place || "").trim();
    city = String(city || "").trim();
    if (!place) return "";
    if (!city || place.includes(city)) return place;
    return `${city} ${place}`;
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  async function loadConfig() {
    if (!configPromise) {
      configPromise = fetch("/api/map-config", { cache: "no-store" }).then((response) => response.json());
    }
    return configPromise;
  }

  function chooseProvider(config) {
    const selected = localStorage.getItem(providerStoreKey) || "auto";
    if (selected === "amap" && config.providers?.amap?.configured) return "amap";
    if (selected === "google" && config.providers?.google?.configured) return "google";
    return config.defaultProvider || "none";
  }

  function loadProviderScript(provider, config) {
    if (provider === "amap") {
      if (window.AMap) return Promise.resolve();
      if (config.providers?.amap?.securityCode) {
        window._AMapSecurityConfig = { securityJsCode: config.providers.amap.securityCode };
      }
      return loadScript("amap", `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.providers.amap.key)}`);
    }
    if (window.google?.maps) return Promise.resolve();
    return loadScript("google", `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.providers.google.key)}&language=zh-CN`);
  }

  function loadScript(key, src) {
    if (scriptPromises.has(key)) return scriptPromises.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("地图脚本加载失败"));
      document.head.append(script);
    });
    scriptPromises.set(key, promise);
    return promise;
  }

  function drawAmap(canvas, plan) {
    prepareCanvas(canvas, "amap");
    const points = (plan.points || []).filter((point) => point.located !== false && Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const map = activeRuntime.map || new AMap.Map(canvas, { zoom: 4, center: [105, 35], viewMode: "2D" });
    activeRuntime = { provider: "amap", map, overlays: [] };
    map.clearMap();
    points.forEach((point, index) => {
      const marker = new AMap.Marker({
        position: [point.lng, point.lat],
        title: point.label,
        label: { content: String(index + 1), direction: "top" },
      });
      marker.setMap(map);
      activeRuntime.overlays.push(marker);
    });
    (plan.segments || []).forEach((segment) => {
      const path = (segment.polyline || []).map((point) => [point.lng, point.lat]);
      if (path.length < 2) return;
      const line = new AMap.Polyline({
        path,
        strokeColor: segment.estimated ? "#d97706" : "#0f766e",
        strokeWeight: 5,
        strokeOpacity: 0.82,
        strokeStyle: segment.estimated ? "dashed" : "solid",
      });
      line.setMap(map);
      activeRuntime.overlays.push(line);
    });
    if (activeRuntime.overlays.length) map.setFitView(activeRuntime.overlays, false, [28, 28, 28, 28], 15);
  }

  function drawGoogle(canvas, plan) {
    prepareCanvas(canvas, "google");
    const points = (plan.points || []).filter((point) => point.located !== false && Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const map = activeRuntime.map || new google.maps.Map(canvas, { zoom: 4, center: { lat: 35, lng: 105 }, mapTypeControl: false, streetViewControl: false });
    clearGoogleOverlays();
    activeRuntime = { provider: "google", map, overlays: [] };
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point, index) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.extend(position);
      activeRuntime.overlays.push(new google.maps.Marker({ position, map, label: String(index + 1), title: point.label }));
    });
    (plan.segments || []).forEach((segment) => {
      const path = (segment.polyline || []).map((point) => ({ lat: point.lat, lng: point.lng }));
      if (path.length < 2) return;
      activeRuntime.overlays.push(new google.maps.Polyline({
        path,
        map,
        strokeColor: segment.estimated ? "#d97706" : "#0f766e",
        strokeOpacity: 0.82,
        strokeWeight: 5,
        icons: segment.estimated ? [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }] : undefined,
      }));
    });
    if (points.length) map.fitBounds(bounds, 28);
  }

  function prepareCanvas(canvas, provider) {
    canvas.classList.add("is-provider-map");
    if (activeRuntime.provider && activeRuntime.provider !== provider) resetRuntime();
  }

  function resetRuntime(clearCanvas = true) {
    if (activeRuntime.provider === "google") clearGoogleOverlays();
    if (activeRuntime.provider === "amap" && activeRuntime.map?.destroy) activeRuntime.map.destroy();
    activeRuntime = { provider: "", map: null, overlays: [] };
    if (clearCanvas) {
      const canvas = document.querySelector("#tripMap");
      if (canvas) canvas.innerHTML = "";
    }
  }

  function clearGoogleOverlays() {
    (activeRuntime.overlays || []).forEach((overlay) => overlay.setMap?.(null));
  }

  function renderRouteSummary(plan) {
    const summary = plan.summary || {};
    const segments = plan.segments || [];
    const total = `<div class="route-total"><strong>${formatDistance(summary.distance)} · ${formatDuration(summary.duration)}</strong><span>${segments.length} 段路线${plan.cached ? " · 已缓存" : ""}</span></div>`;
    const rows = segments.slice(0, 8).map((segment) => `
      <div class="route-row">
        <span class="route-mode-chip">${modeLabels[segment.mode] || "车"}</span>
        <strong>${escapeHtml(segment.from)} → ${escapeHtml(segment.to)}</strong>
        <small>${formatDistance(segment.distance)} · ${formatDuration(segment.duration)}${segment.estimated ? " · 估算" : ""}</small>
      </div>
    `).join("");
    setRouteStatus(total + (rows ? `<div class="route-list">${rows}</div>` : ""));
  }

  function setRouteStatus(html) {
    const box = document.querySelector("#routeStatus");
    if (!box) return;
    box.innerHTML = html || "";
  }

  function formatDistance(meters = 0) {
    if (!Number.isFinite(Number(meters)) || Number(meters) <= 0) return "0 km";
    return Number(meters) >= 1000 ? `${(Number(meters) / 1000).toFixed(1)} km` : `${Math.round(Number(meters))} m`;
  }

  function formatDuration(seconds = 0) {
    seconds = Number(seconds) || 0;
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
