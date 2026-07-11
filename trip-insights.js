const insightClientId = `trip-insights:${crypto.randomUUID()}`;
const insightParams = new URLSearchParams(location.search);
const insightRoomId = insightParams.get("room");
const insightConfig = window.TRIP_PLANNER_CONFIG || {};
const insightStorageKey = insightRoomId ? `trip-planner-library:${insightRoomId}` : "";
const insightChannel = insightStorageKey && "BroadcastChannel" in window ? new BroadcastChannel(insightStorageKey) : null;
let insightRenderTimer = 0;

const activityPresets = [
  { title: "早餐", time: "08:30", category: "food", cost: 35, icon: "M4 3v7a4 4 0 0 0 4 4v7M8 3v18M14 3v18M14 3h3a3 3 0 0 1 0 6h-3" },
  { title: "咖啡休息", time: "10:30", category: "food", cost: 28, icon: "M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 2h2a2 2 0 0 1 0 4h-2" },
  { title: "景点游览", time: "11:00", category: "play", cost: 120, icon: "M3 21h18M6 21V9l6-5 6 5v12M9 21v-7h6v7" },
  { title: "午餐", time: "12:30", category: "food", cost: 60, icon: "M4 3v7a4 4 0 0 0 4 4v7M8 3v18M14 3v18M14 3h3a3 3 0 0 1 0 6h-3" },
  { title: "城市交通", time: "14:00", category: "transport", cost: 25, transport: { type: "train" }, icon: "M6 4h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4Zm3 16 2-2m4 2-2-2M8 8h8M8 12h8" },
  { title: "打车 / 自驾", time: "15:00", category: "transport", cost: 80, transport: { type: "car" }, icon: "M5 15l1.4-4.2A3 3 0 0 1 9.2 9h5.6a3 3 0 0 1 2.8 1.8L19 15M4 15h16v4H4v-4Z" },
  { title: "购物", time: "16:00", category: "shopping", cost: 200, icon: "M6 7h12l-1 14H7L6 7Zm3 0a3 3 0 0 1 6 0" },
  { title: "晚餐", time: "18:30", category: "food", cost: 90, icon: "M4 3v7a4 4 0 0 0 4 4v7M8 3v18M14 3v18M14 3h3a3 3 0 0 1 0 6h-3" },
  { title: "入住住宿", time: "20:00", category: "lodging", cost: 450, icon: "M4 20V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12M4 12h16M8 12V9h8v3" },
];

const budgetCategories = [
  { id: "transport", label: "交通" },
  { id: "lodging", label: "住宿" },
  { id: "food", label: "餐饮" },
  { id: "play", label: "游玩" },
  { id: "shopping", label: "购物" },
  { id: "other", label: "其他" },
];

window.addEventListener("load", initTripInsights);

function initTripInsights() {
  if (!insightStorageKey) return;
  injectInsightSurfaces();
  renderTripInsights();
  const shell = document.querySelector(".app-shell");
  if (shell) {
    new MutationObserver(() => {
      clearTimeout(insightRenderTimer);
      insightRenderTimer = window.setTimeout(renderTripInsights, 40);
    }).observe(shell, { childList: true, subtree: true });
  }
}

function injectInsightSurfaces() {
  const compactPanel = document.querySelector(".compact-panel");
  if (compactPanel && !document.querySelector("#budgetPanel")) {
    compactPanel.insertAdjacentHTML("afterend", `
      <section class="panel budget-panel" id="budgetPanel">
        <div class="section-heading">
          <p>预算</p>
          <span id="budgetStatus">￥0</span>
        </div>
        <label class="field budget-limit-field">
          <span>总预算</span>
          <input id="budgetLimitInput" type="number" min="0" step="50" placeholder="例如：6000" />
        </label>
        <div class="budget-meter" aria-hidden="true"><span id="budgetMeterFill"></span></div>
        <div class="budget-stats">
          <div><strong id="budgetSpent">￥0</strong><span>已安排</span></div>
          <div><strong id="budgetRemain">￥0</strong><span>剩余</span></div>
          <div><strong id="budgetDaily">￥0</strong><span>日均</span></div>
        </div>
        <div class="category-bars" id="categoryBars"></div>
      </section>
    `);
    document.querySelector("#budgetLimitInput")?.addEventListener("input", (event) => updateBudgetLimit(event.target.value));
  }

  const detailSticky = document.querySelector(".detail-sticky");
  const activityForm = document.querySelector("#activityForm");
  if (detailSticky && activityForm && !document.querySelector("#presetPanel")) {
    activityForm.insertAdjacentHTML("beforebegin", `
      <section class="preset-panel" id="presetPanel">
        <div class="section-heading compact-heading">
          <p>快速添加</p>
          <span>预设会带入时间和预算</span>
        </div>
        <div class="preset-grid" id="presetGrid"></div>
      </section>
    `);
    const grid = document.querySelector("#presetGrid");
    grid?.replaceChildren(...activityPresets.map(createPresetButton));
  }
}

function createPresetButton(preset) {
  const button = document.createElement("button");
  button.className = "preset-button";
  button.type = "button";
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${preset.icon}" /></svg>
    <span>${escapeHtml(preset.title)}</span>
    <strong>￥${preset.cost}</strong>
  `;
  button.addEventListener("click", () => addPresetActivity(preset));
  return button;
}

function renderTripInsights() {
  injectInsightSurfaces();
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  normalizeBudget(trip);
  renderBudgetPanel(trip);
  renderActivityCostChips(trip);
  renderDayCostBadges(trip);
}

function renderBudgetPanel(trip) {
  const activities = trip.days.flatMap((day) => day.activities || []);
  const total = activities.reduce((sum, activity) => sum + getActivityBudget(trip, activity).cost, 0);
  const limit = toAmount(trip.budget?.limit);
  const remain = Math.max(0, limit - total);
  const daily = trip.days.length ? total / trip.days.length : 0;
  const percent = limit ? Math.min(100, Math.round((total / limit) * 100)) : 0;

  const limitInput = document.querySelector("#budgetLimitInput");
  if (limitInput && document.activeElement !== limitInput) limitInput.value = limit || "";
  setText("#budgetStatus", limit ? `${percent}%` : "未设上限");
  setText("#budgetSpent", formatMoney(total));
  setText("#budgetRemain", limit ? formatMoney(remain) : "--");
  setText("#budgetDaily", formatMoney(daily));
  const fill = document.querySelector("#budgetMeterFill");
  if (fill) fill.style.width = `${percent}%`;

  const maxCategory = Math.max(1, ...budgetCategories.map((item) => categoryTotal(trip, activities, item.id)));
  const bars = budgetCategories.map((item) => {
    const value = categoryTotal(trip, activities, item.id);
    const width = Math.max(3, Math.round((value / maxCategory) * 100));
    return `
      <div class="category-row">
        <span>${item.label}</span>
        <div><i style="width:${width}%"></i></div>
        <strong>${formatMoney(value)}</strong>
      </div>
    `;
  }).join("");
  const target = document.querySelector("#categoryBars");
  if (target) target.innerHTML = bars;
}

function renderActivityCostChips(trip) {
  document.querySelectorAll(".activity-row[data-day-id][data-activity-id]").forEach((row) => {
    if (row.querySelector(".cost-chip")) return;
    const result = findActivity(trip, row.dataset.dayId, row.dataset.activityId);
    if (!result) return;
    const chip = document.createElement("button");
    chip.className = "cost-chip";
    chip.type = "button";
    chip.title = "点击修改预算";
    const budget = getActivityBudget(trip, result.activity);
    chip.textContent = budget.cost ? formatMoney(budget.cost) : "加预算";
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      editActivityBudget(row.dataset.dayId, row.dataset.activityId);
    });
    row.querySelector(".activity-body")?.append(chip);
  });
}

function renderDayCostBadges(trip) {
  document.querySelectorAll(".day-card[data-day-id]").forEach((card) => {
    const day = trip.days.find((item) => item.id === card.dataset.dayId);
    if (!day) return;
    const total = (day.activities || []).reduce((sum, activity) => sum + getActivityBudget(trip, activity).cost, 0);
    const meta = card.querySelector(".day-meta");
    if (!meta) return;
    let badge = card.querySelector(".day-cost-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "meta-pill day-cost-badge";
      meta.append(badge);
    }
    badge.textContent = total ? `当日 ${formatMoney(total)}` : "当日未估算";
  });
}

function addPresetActivity(preset) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip?.days?.length) return;
  const selectedDay = trip.days.find((day) => day.id === trip.selectedDayId) || trip.days[0];
  selectedDay.activities = selectedDay.activities || [];
  const activityId = crypto.randomUUID();
  selectedDay.activities.push({
    id: activityId,
    time: preset.time,
    title: preset.title,
    place: "",
    note: "",
    done: false,
    transport: preset.transport ? { type: preset.transport.type, from: "", to: "", depart: "", arrive: "" } : null,
  });
  normalizeBudget(trip);
  trip.budget.items[activityId] = { cost: preset.cost, category: preset.category };
  publishLibrary(library, "add-preset-activity");
  showInsightToast(`已添加 ${preset.title}`);
}

function editActivityBudget(dayId, activityId) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  const result = findActivity(trip, dayId, activityId);
  if (!result) return;
  normalizeBudget(trip);
  const currentBudget = getActivityBudget(trip, result.activity);
  const raw = window.prompt("输入这个事项的预算金额", currentBudget.cost ? String(currentBudget.cost) : "");
  if (raw === null) return;
  const cost = Math.max(0, Number(raw) || 0);
  const category = window.prompt("分类：transport / lodging / food / play / shopping / other", currentBudget.category || inferCategory(result.activity));
  trip.budget.items[activityId] = {
    cost,
    category: budgetCategories.some((item) => item.id === category) ? category : "other",
  };
  publishLibrary(library, "update-activity-budget");
  showInsightToast("预算已更新");
}

function updateBudgetLimit(value) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  normalizeBudget(trip);
  trip.budget.limit = Math.max(0, Number(value) || 0);
  publishLibrary(library, "update-budget-limit");
}

function normalizeBudget(trip) {
  trip.budget = trip.budget && typeof trip.budget === "object" ? trip.budget : { limit: 0 };
  trip.budget.items = trip.budget.items && typeof trip.budget.items === "object" ? trip.budget.items : {};
  trip.days.forEach((day) => {
    (day.activities || []).forEach((activity) => {
      const existing = trip.budget.items[activity.id] || {};
      const legacyCost = Number.isFinite(Number(activity.cost)) ? Number(activity.cost) : 0;
      trip.budget.items[activity.id] = {
        cost: toAmount(existing.cost || legacyCost),
        category: existing.category || activity.category || inferCategory(activity),
      };
      delete activity.cost;
      delete activity.category;
    });
  });
}

function inferCategory(activity) {
  const title = `${activity.title || ""} ${activity.note || ""}`;
  if (activity.transport?.type) return "transport";
  if (/酒店|住宿|入住|民宿|旅馆/.test(title)) return "lodging";
  if (/餐|饭|咖啡|早餐|午餐|晚餐|夜宵/.test(title)) return "food";
  if (/购物|商场|买/.test(title)) return "shopping";
  if (/景点|游览|门票|博物馆|公园|骑行/.test(title)) return "play";
  return "other";
}

function getActivityBudget(trip, activity) {
  normalizeBudget(trip);
  const item = trip.budget.items[activity.id] || {};
  return {
    cost: toAmount(item.cost),
    category: item.category || inferCategory(activity),
  };
}

function categoryTotal(trip, activities, category) {
  return activities
    .map((activity) => getActivityBudget(trip, activity))
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.cost, 0);
}

function findActivity(trip, dayId, activityId) {
  const day = trip?.days?.find((item) => item.id === dayId);
  const activity = day?.activities?.find((item) => item.id === activityId);
  if (!day || !activity) return null;
  return { day, activity };
}

function readLibrary() {
  try {
    return JSON.parse(localStorage.getItem(insightStorageKey));
  } catch {
    return null;
  }
}

function getActiveTrip(library) {
  if (!library?.lists?.length) return null;
  return (library.lists.find((list) => list.id === library.activeListId) || library.lists[0]).trip;
}

function publishLibrary(library, reason) {
  if (!library) return;
  const list = library.lists.find((item) => item.id === library.activeListId) || library.lists[0];
  const trip = list?.trip;
  const now = Date.now();
  if (trip) trip.updatedAt = now;
  if (list) list.updatedAt = now;
  library.updatedAt = now;
  localStorage.setItem(insightStorageKey, JSON.stringify(library));
  insightChannel?.postMessage({ type: "library", clientId: insightClientId, library, reason });
  sendRemoteState(library, reason);
  window.setTimeout(renderTripInsights, 80);
}

function sendRemoteState(library, reason) {
  const endpoint = buildSyncUrl();
  if (!endpoint) return;
  try {
    const socket = new WebSocket(endpoint);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "state", clientId: insightClientId, roomId: insightRoomId, state: library, reason }));
      window.setTimeout(() => socket.close(), 120);
    });
  } catch {
  }
}

function buildSyncUrl() {
  const configuredEndpoint = insightParams.get("sync") || insightConfig.syncEndpoint || "";
  const endpoint = configuredEndpoint.trim() || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/sync`;
  try {
    const url = new URL(endpoint, location.href);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return "";
    url.searchParams.set("room", insightRoomId);
    return url.toString();
  } catch {
    return "";
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function toAmount(value) {
  return Math.max(0, Number(value) || 0);
}

function formatMoney(value) {
  return `￥${Math.round(toAmount(value)).toLocaleString("zh-CN")}`;
}

function showInsightToast(text) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
