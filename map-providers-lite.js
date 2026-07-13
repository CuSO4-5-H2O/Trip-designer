(() => {
  "use strict";

  let scope = "list";
  let lastPlan = null;
  const modeLabels = { plane: "飞机", train: "火车", bus: "大巴", boat: "船", car: "车", walk: "步行" };

  function init() {
    window.TripDesignerMap = { getLastPlan: () => lastPlan, calculate };
    document.addEventListener("click", handleClick, true);
    installSoon();
    window.setTimeout(installSoon, 300);
    window.setInterval(installSoon, 2000);
  }

  function installSoon() {
    const panel = document.querySelector(".smart-map-panel");
    if (panel) installMapPanel(panel);
    const aiPanel = document.querySelector(".ai-panel");
    if (aiPanel) installPanelCollapse(aiPanel, "ai");
  }

  function installMapPanel(panel) {
    const head = panel.querySelector(".smart-panel-head");
    if (!head) return;
    const segmented = head.querySelector(".segmented") || panel.querySelector(".segmented");
    if (!head.querySelector(".map-provider-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.className = "map-provider-toolbar";
      if (segmented) toolbar.append(segmented);
      toolbar.insertAdjacentHTML("beforeend", `<button class="mini-action" id="mapCalculateBtn" type="button">计算路线</button><button class="mini-action" type="button" data-panel-collapse="map">收起</button>`);
      head.append(toolbar);
    }
    if (!panel.querySelector("#routeStatus")) panel.insertAdjacentHTML("beforeend", `<div class="route-status" id="routeStatus"></div>`);
    if (!document.querySelector("#mapStatus")?.textContent?.trim()) setMapStatus("点击计算路线");
  }

  function installPanelCollapse(panel, kind) {
    const head = panel.querySelector(".smart-panel-head");
    if (!head || head.querySelector(`[data-panel-collapse="${kind}"]`)) return;
    head.insertAdjacentHTML("beforeend", `<button class="mini-action" type="button" data-panel-collapse="${kind}">收起</button>`);
  }

  function handleClick(event) {
    const mapButton = event.target.closest?.("[data-map]");
    if (mapButton) {
      scope = mapButton.dataset.map || "list";
      lastPlan = null;
      setMapStatus("待计算路线");
      setRouteStatus("已切换选择，点击计算路线");
      return;
    }
    const calc = event.target.closest?.("#mapCalculateBtn");
    if (calc) {
      event.preventDefault();
      calculate();
      return;
    }
    const routeEdit = event.target.closest?.("[data-route-edit]");
    if (routeEdit) {
      event.preventDefault();
      const dayId = routeEdit.dataset.dayId || "";
      const activityId = routeEdit.dataset.activityId || "";
      if (!dayId || !activityId || !window.TripPlanner?.openActivityEditor) return;
      window.TripPlanner.openActivityEditor(dayId, activityId, "transport");
      document.querySelector("#activityForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const collapse = event.target.closest?.("[data-panel-collapse]");
    if (collapse) {
      event.preventDefault();
      togglePanel(collapse.dataset.panelCollapse);
      return;
    }
    const routeToggle = event.target.closest?.("#routeCollapseBtn");
    if (routeToggle) {
      event.preventDefault();
      const box = document.querySelector("#routeStatus");
      box?.classList.toggle("is-collapsed");
      routeToggle.textContent = box?.classList.contains("is-collapsed") ? "展开" : "收起";
    }
  }

  async function calculate() {
    if (!window.TripPlanner?.getLibrary) return;
    const entries = buildEntries();
    if (!entries.length) {
      setMapStatus(scope === "day" ? "当天还没有可定位地点" : "当前 list 还没有可定位地点");
      setRouteStatus("");
      return;
    }
    setMapStatus(scope === "day" ? "正在定位当天地点" : "正在定位当前 list 地点");
    setRouteStatus("正在计算路线和时间");
    try {
      const configResponse = await fetch("/api/map-config", { cache: "no-store" });
      const config = await configResponse.json();
      const provider = config.defaultProvider || "amap";
      const response = await fetch("/api/map/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, entries, scope }),
      });
      const plan = await response.json();
      if (!response.ok || !plan.ok) throw new Error(plan.error || "地图路线生成失败");
      lastPlan = plan;
      renderStaticMap(plan);
      renderRouteSummary(plan);
      const located = (plan.points || []).filter((point) => point.located !== false).length;
      const failed = (plan.points || []).length - located;
      setMapStatus(failed ? `已定位 ${located} 个地点，${failed} 个未定位` : `已定位 ${located} 个地点`);
    } catch (error) {
      lastPlan = null;
      setMapStatus(error.message || "地图加载失败");
      setRouteStatus("请检查地点是否足够具体，或稍后重试");
    }
  }

  function renderStaticMap(plan) {
    const canvas = document.querySelector("#tripMap");
    if (!canvas) return;
    const points = (plan.points || []).filter((point) => point.located !== false);
    canvas.classList.add("is-provider-map", "lite-map");
    canvas.innerHTML = `<div class="lite-map-inner"><strong>${points.length ? `已定位 ${points.length} 个地点` : "暂无定位结果"}</strong><ol>${points.slice(0, 24).map((point, index) => `<li><span>${index + 1}</span>${escapeHtml(point.label || point.query || "地点")}</li>`).join("")}</ol></div>`;
  }

  function renderRouteSummary(plan) {
    const summary = plan.summary || {};
    const segments = plan.segments || [];
    const total = `<div class="route-total"><strong>${formatDistance(summary.distance)} · ${formatDuration(summary.duration)}</strong><span>${segments.length} 段路线${plan.cached ? " · 已缓存" : ""}</span><span class="route-total-actions"><button class="mini-action" id="routeCollapseBtn" type="button">收起</button></span></div>`;
    const rows = segments.slice(0, 24).map((segment) => {
      const edit = segment.dayId && segment.activityId ? `<button class="route-edit-btn" type="button" data-route-edit="1" data-day-id="${escapeAttr(segment.dayId)}" data-activity-id="${escapeAttr(segment.activityId)}">修改</button>` : "";
      return `<div class="route-row"><span class="route-mode-chip">${modeLabels[segment.mode] || "车"}</span><strong>${escapeHtml(segment.from)} → ${escapeHtml(segment.to)}</strong><small>${formatDistance(segment.distance)} · ${formatDuration(segment.duration)}${segment.estimated ? " · 估算" : ""}</small>${edit}</div>`;
    }).join("");
    setRouteStatus(total + (rows ? `<div class="route-list">${rows}</div>` : ""));
  }

  function buildEntries() {
    const library = window.TripPlanner.getLibrary();
    const list = (library.lists || []).find((item) => item.id === library.activeListId) || library.lists?.[0];
    const trip = list?.trip;
    if (!trip?.days?.length) return [];
    const selected = trip.days.find((day) => day.id === trip.selectedDayId) || trip.days[0];
    const days = scope === "day" ? [selected] : trip.days;
    const out = [];
    const push = (query, label, dayLabel, mode = "car", dayId = "", activityId = "") => {
      query = String(query || "").trim();
      label = String(label || query).trim();
      if (!query || !label) return;
      const last = out[out.length - 1];
      if (last && normalize(last.query) === normalize(query) && normalize(last.label) === normalize(label)) return;
      out.push({ query, label, day: dayLabel, mode, dayId, activityId });
    };
    days.filter(Boolean).forEach((day) => {
      const dayIndex = trip.days.indexOf(day) + 1;
      const dayLabel = `第 ${dayIndex} 天`;
      const city = String(day.location || trip.originCity || "").trim();
      push(city, city || dayLabel, `${dayLabel} 城市`, "car", day.id, "");
      (day.activities || []).forEach((activity) => {
        const transport = activity.transport || {};
        const mode = transport.type || "car";
        if (transport.from) push(withContext(city, transport.from), `${activity.title || "行程"} 出发`, dayLabel, mode, day.id, activity.id);
        const target = transport.to || activity.place || activity.title;
        push(withContext(city, target), activity.place || activity.title || target, `${dayLabel} · ${activity.title || "事项"}`, mode, day.id, activity.id);
      });
      push(withContext(city, day.stay), day.stay, `${dayLabel} 住宿`, "car", day.id, "");
    });
    return out.slice(0, 40);
  }

  function togglePanel(kind) {
    const panel = kind === "ai" ? document.querySelector(".ai-panel") : document.querySelector(".smart-map-panel");
    if (!panel) return;
    panel.classList.toggle("is-collapsed");
    const button = panel.querySelector(`[data-panel-collapse="${kind}"]`);
    if (button) button.textContent = panel.classList.contains("is-collapsed") ? "展开" : "收起";
  }

  function withContext(city, place) {
    place = String(place || "").trim();
    city = String(city || "").trim();
    if (!place) return "";
    if (!city || place.includes(city)) return place;
    return `${city} ${place}`;
  }

  function setMapStatus(text) { const status = document.querySelector("#mapStatus"); if (status) status.textContent = text; }
  function setRouteStatus(html) { const box = document.querySelector("#routeStatus"); if (box) box.innerHTML = html || ""; }
  function normalize(value) { return String(value || "").replace(/\s+/g, "").toLowerCase(); }
  function formatDistance(meters = 0) { meters = Number(meters) || 0; return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`; }
  function formatDuration(seconds = 0) { const minutes = Math.max(1, Math.round((Number(seconds) || 0) / 60)); if (minutes < 60) return `${minutes} 分钟`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();