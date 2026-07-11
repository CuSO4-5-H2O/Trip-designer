(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room") || "LOCAL";
  const storageKey = `trip-planner-library:${roomId}`;
  const geocodeCache = new Map();
  let map = null;
  let mapLayerGroup = null;
  let leafletPromise = null;
  let activeTab = "map";

  const launcher = document.createElement("div");
  launcher.className = "travel-tools-launcher";
  launcher.innerHTML = `
    <button class="travel-tool-launch" type="button" data-open-tool="map" title="查看行程路线">🗺️ <span>路线地图</span></button>
    <button class="travel-tool-launch" type="button" data-open-tool="ai" title="获取当地旅行推荐">✦ <span>AI 推荐</span></button>
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "travel-tools-backdrop";
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="travel-tools-dialog" role="dialog" aria-modal="true" aria-label="旅行工具">
      <header class="travel-tools-head">
        <div>
          <h2>旅行工具</h2>
          <p>查看路线，并根据当前行程获取当地推荐。</p>
        </div>
        <button class="travel-tools-close" type="button" aria-label="关闭">×</button>
      </header>
      <nav class="travel-tools-tabs" aria-label="旅行工具切换">
        <button class="travel-tools-tab active" type="button" data-tool-tab="map">路线地图</button>
        <button class="travel-tools-tab" type="button" data-tool-tab="ai">AI 推荐</button>
      </nav>
      <div class="travel-tools-body">
        <section class="travel-tools-panel" data-tool-panel="map">
          <div class="travel-tools-controls">
            <label class="travel-tools-field">
              <span>查看范围</span>
              <select id="routeDaySelect"></select>
            </label>
            <button class="travel-tools-action" id="refreshRouteBtn" type="button">生成路线</button>
          </div>
          <div id="tripRouteMap"><div class="route-map-empty">选择日期后生成路线。地图会根据事项地点自动定位。</div></div>
        </section>
        <section class="travel-tools-panel" data-tool-panel="ai" hidden>
          <p class="ai-privacy-note">点击生成后，当前所选日期的地点和事项会发送至网站服务端，再由服务端调用 DeepSeek。请不要在备注中填写护照号、订单密码等敏感信息。</p>
          <div class="travel-tools-controls">
            <label class="travel-tools-field">
              <span>推荐日期</span>
              <select id="aiDaySelect"></select>
            </label>
            <label class="travel-tools-field">
              <span>偏好</span>
              <select id="aiPreferenceSelect">
                <option value="综合体验">综合体验</option>
                <option value="省钱实用">省钱实用</option>
                <option value="轻松慢游">轻松慢游</option>
                <option value="拍照出片">拍照出片</option>
                <option value="当地美食">当地美食</option>
                <option value="历史文化">历史文化</option>
              </select>
            </label>
            <button class="travel-tools-action" id="generateRecommendationsBtn" type="button">生成推荐</button>
          </div>
          <div id="aiRecommendations"><div class="travel-tools-status">选择日期和偏好后生成当地推荐。</div></div>
        </section>
      </div>
    </section>
  `;

  document.body.append(launcher, backdrop);

  const routeDaySelect = backdrop.querySelector("#routeDaySelect");
  const aiDaySelect = backdrop.querySelector("#aiDaySelect");
  const aiPreferenceSelect = backdrop.querySelector("#aiPreferenceSelect");
  const refreshRouteBtn = backdrop.querySelector("#refreshRouteBtn");
  const generateRecommendationsBtn = backdrop.querySelector("#generateRecommendationsBtn");
  const mapNode = backdrop.querySelector("#tripRouteMap");
  const aiNode = backdrop.querySelector("#aiRecommendations");

  launcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-tool]");
    if (!button) return;
    openTools(button.dataset.openTool);
  });

  backdrop.querySelector(".travel-tools-close").addEventListener("click", closeTools);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeTools();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) closeTools();
  });

  backdrop.querySelector(".travel-tools-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool-tab]");
    if (!button) return;
    setActiveTab(button.dataset.toolTab);
  });

  refreshRouteBtn.addEventListener("click", renderSelectedRoute);
  routeDaySelect.addEventListener("change", renderSelectedRoute);
  generateRecommendationsBtn.addEventListener("click", generateRecommendations);

  const dayList = document.querySelector("#dayList");
  if (dayList) {
    new MutationObserver(() => {
      if (!backdrop.hidden) refreshDaySelectors();
    }).observe(dayList, { childList: true, subtree: true });
  }

  function openTools(tab) {
    activeTab = tab;
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    refreshDaySelectors();
    setActiveTab(tab);
    if (tab === "map") renderSelectedRoute();
  }

  function closeTools() {
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function setActiveTab(tab) {
    activeTab = tab;
    backdrop.querySelectorAll("[data-tool-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.toolTab === tab);
    });
    backdrop.querySelectorAll("[data-tool-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.toolPanel !== tab;
    });
    if (tab === "map" && map) {
      requestAnimationFrame(() => map.invalidateSize());
    }
  }

  function getLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      return value?.lists?.length ? value : null;
    } catch {
      return null;
    }
  }

  function getActiveTrip() {
    const library = getLibrary();
    if (!library) return null;
    return library.lists.find((list) => list.id === library.activeListId)?.trip || library.lists[0]?.trip || null;
  }

  function refreshDaySelectors() {
    const trip = getActiveTrip();
    if (!trip?.days?.length) return;
    const currentRoute = routeDaySelect.value;
    const currentAi = aiDaySelect.value;
    const selectedIndex = Math.max(0, trip.days.findIndex((day) => day.id === trip.selectedDayId));

    routeDaySelect.replaceChildren(createOption("all", `全部行程（最多显示 25 个地点）`));
    aiDaySelect.replaceChildren();

    trip.days.forEach((day, index) => {
      const label = `第 ${index + 1} 天 · ${day.location || "未填写地点"}`;
      routeDaySelect.append(createOption(day.id, label));
      aiDaySelect.append(createOption(day.id, label));
    });

    routeDaySelect.value = [...routeDaySelect.options].some((option) => option.value === currentRoute)
      ? currentRoute
      : trip.days[selectedIndex].id;
    aiDaySelect.value = [...aiDaySelect.options].some((option) => option.value === currentAi)
      ? currentAi
      : trip.days[selectedIndex].id;
  }

  function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  async function renderSelectedRoute() {
    const trip = getActiveTrip();
    if (!trip?.days?.length) {
      mapNode.innerHTML = `<div class="route-map-empty">共享行程仍在载入，请稍后再试。</div>`;
      return;
    }

    refreshRouteBtn.disabled = true;
    refreshRouteBtn.textContent = "定位中…";
    mapNode.innerHTML = `<div class="route-map-empty">正在定位行程地点…</div>`;

    try {
      const L = await loadLeaflet();
      const entries = collectRouteEntries(trip, routeDaySelect.value).slice(0, 25);
      if (!entries.length) {
        mapNode.innerHTML = `<div class="route-map-empty">所选日期还没有可定位的事项。请为事项填写地点或名称。</div>`;
        destroyMap();
        return;
      }

      const located = [];
      for (const entry of entries) {
        const point = await geocodeEntry(entry, trip);
        if (point) located.push({ ...entry, ...point });
      }

      if (!located.length) {
        mapNode.innerHTML = `<div class="route-map-empty">没有找到这些地点。请把地点填写得更具体，例如“雅典卫城”或“罗马斗兽场”。</div>`;
        destroyMap();
        return;
      }

      if (!map) {
        mapNode.replaceChildren();
        map = L.map(mapNode, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
      } else {
        map.invalidateSize();
      }

      mapLayerGroup?.remove();
      mapLayerGroup = L.layerGroup().addTo(map);
      const bounds = [];

      located.forEach((entry, index) => {
        const latLng = [entry.lat, entry.lng];
        bounds.push(latLng);
        const icon = L.divIcon({
          className: "",
          html: `<span class="route-number-marker">${index + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker(latLng, { icon }).addTo(mapLayerGroup);
        marker.bindPopup(buildPopup(entry, index));
      });

      if (bounds.length > 1) {
        L.polyline(bounds, { weight: 4, opacity: 0.72, dashArray: "8 7" }).addTo(mapLayerGroup);
        map.fitBounds(bounds, { padding: [36, 36] });
      } else {
        map.setView(bounds[0], 14);
      }
    } catch (error) {
      mapNode.innerHTML = `<div class="route-map-empty">路线生成失败：${safeText(error.message || "未知错误")}</div>`;
      destroyMap();
    } finally {
      refreshRouteBtn.disabled = false;
      refreshRouteBtn.textContent = "生成路线";
    }
  }

  function collectRouteEntries(trip, selectedValue) {
    const chosenDays = selectedValue === "all"
      ? trip.days
      : trip.days.filter((day) => day.id === selectedValue);
    const entries = [];
    chosenDays.forEach((day) => {
      const dayIndex = trip.days.indexOf(day);
      day.activities.forEach((activity) => {
        if (!(activity.place || activity.title)) return;
        entries.push({ day, dayIndex, activity });
      });
    });
    return entries;
  }

  async function geocodeEntry(entry, trip) {
    const query = [entry.activity.place || entry.activity.title, entry.day.location, trip.originCity]
      .filter(Boolean)
      .join(", ");
    if (geocodeCache.has(query)) return geocodeCache.get(query);
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "地点定位失败");
    const result = data.result || null;
    geocodeCache.set(query, result);
    return result;
  }

  function buildPopup(entry, index) {
    const transport = entry.activity.transport;
    const route = transport
      ? [transport.from, transport.to].filter(Boolean).join(" → ")
      : "";
    const node = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${entry.activity.title || entry.activity.place}`;
    node.append(title);
    const details = [
      `第 ${entry.dayIndex + 1} 天`,
      entry.activity.time,
      entry.activity.place,
      route,
    ].filter(Boolean);
    if (details.length) {
      const p = document.createElement("p");
      p.style.margin = "6px 0 0";
      p.textContent = details.join(" · ");
      node.append(p);
    }
    return node;
  }

  function destroyMap() {
    if (!map) return;
    map.remove();
    map = null;
    mapLayerGroup = null;
  }

  async function loadLeaflet() {
    if (window.L) return window.L;
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet="true"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.leaflet = "true";
        document.head.append(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error("地图组件加载失败"));
      document.head.append(script);
    });
    return leafletPromise;
  }

  async function generateRecommendations() {
    const trip = getActiveTrip();
    if (!trip?.days?.length) {
      aiNode.innerHTML = `<div class="travel-tools-status">共享行程仍在载入，请稍后再试。</div>`;
      return;
    }
    const dayIndex = trip.days.findIndex((day) => day.id === aiDaySelect.value);
    const day = trip.days[dayIndex];
    if (!day) return;

    generateRecommendationsBtn.disabled = true;
    generateRecommendationsBtn.textContent = "生成中…";
    aiNode.innerHTML = `<div class="travel-tools-status">DeepSeek 正在分析当天安排并生成当地推荐…</div>`;

    try {
      const response = await fetch("/api/travel-recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          preference: aiPreferenceSelect.value,
          trip: {
            title: trip.tripTitle,
            startDate: trip.startDate,
            originCity: trip.originCity,
            destinations: trip.days.map((item) => item.location).filter(Boolean),
          },
          day: {
            number: dayIndex + 1,
            location: day.location,
            stay: day.stay,
            activities: day.activities.map((activity) => ({
              time: activity.time,
              title: activity.title,
              place: activity.place,
              note: activity.note,
            })),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "推荐生成失败");
      renderRecommendations(data);
    } catch (error) {
      aiNode.innerHTML = `<div class="travel-tools-status">${safeText(error.message || "推荐生成失败")}</div>`;
    } finally {
      generateRecommendationsBtn.disabled = false;
      generateRecommendationsBtn.textContent = "生成推荐";
    }
  }

  function renderRecommendations(data) {
    aiNode.replaceChildren();
    if (data.summary) {
      const summary = document.createElement("p");
      summary.className = "ai-recommendation-summary";
      summary.textContent = data.summary;
      aiNode.append(summary);
    }

    const grid = document.createElement("div");
    grid.className = "ai-recommendation-grid";
    const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
    recommendations.forEach((item) => {
      const card = document.createElement("article");
      card.className = "ai-recommendation-card";
      const heading = document.createElement("h3");
      heading.textContent = item.name || "当地推荐";
      const reason = document.createElement("p");
      reason.textContent = item.reason || item.description || "";
      const meta = document.createElement("div");
      meta.className = "ai-recommendation-meta";
      [item.category, item.area, item.suggestedTime, item.duration].filter(Boolean).forEach((value) => {
        const tag = document.createElement("span");
        tag.textContent = value;
        meta.append(tag);
      });
      card.append(heading, reason, meta);
      if (item.tips) {
        const tips = document.createElement("p");
        tips.textContent = `提示：${item.tips}`;
        card.append(tips);
      }
      grid.append(card);
    });
    aiNode.append(grid);

    const cautions = Array.isArray(data.cautions) ? data.cautions.filter(Boolean) : [];
    const warning = document.createElement("p");
    warning.className = "ai-warning";
    warning.textContent = cautions.length
      ? `注意：${cautions.join("；")}`
      : "AI 推荐可能不包含最新营业时间、票价和临时闭馆信息，请在出发前核对景点或商家的官方信息。";
    aiNode.append(warning);
  }

  function safeText(value) {
    return String(value).replace(/[<>]/g, "");
  }
})();
