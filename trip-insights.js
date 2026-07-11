const insightClientId = `trip-insights:${crypto.randomUUID()}`;
const insightParams = new URLSearchParams(location.search);
const insightRoomId = insightParams.get("room");
const insightConfig = window.TRIP_PLANNER_CONFIG || {};
const insightStorageKey = insightRoomId ? `trip-planner-library:${insightRoomId}` : "";
const insightChannel = insightStorageKey && "BroadcastChannel" in window ? new BroadcastChannel(insightStorageKey) : null;
const ratesStorageKey = "trip-planner-rates:v1";
let insightRenderTimer = 0;
let insightClickBound = false;
let editingBudgetTarget = null;

const fallbackExchangeSnapshot = {
  base: "CNY",
  rates: { CNY: 1, USD: 0.139, EUR: 0.128 },
  updatedAt: 0,
  source: "fallback",
};
let exchangeSnapshot = loadExchangeSnapshot();

const currencyOptions = [
  { code: "CNY", label: "人民币", short: "RMB", symbol: "￥", locale: "zh-CN", digits: 0 },
  { code: "USD", label: "美元", short: "USD", symbol: "$", locale: "en-US", digits: 2 },
  { code: "EUR", label: "欧元", short: "EUR", symbol: "€", locale: "de-DE", digits: 2 },
];


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
  if (!insightClickBound) {
    document.addEventListener("click", handleInsightClick, true);
    insightClickBound = true;
  }
  injectInsightSurfaces();
  renderTripInsights();
  refreshExchangeRates(false);
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
        <div class="section-heading budget-heading">
          <p>预算</p>
          <button class="currency-cycle" id="budgetCurrencyCycle" type="button" title="切换货币">
            <span id="budgetCurrencyLabel">人民币</span>
            <strong id="budgetCurrencyCode">CNY</strong>
          </button>
        </div>
        <div class="currency-tools">
          <div class="currency-segment" id="currencySegment" aria-label="预算货币"></div>
          <button class="rate-action" id="refreshRatesBtn" type="button">刷新汇率</button>
          <button class="rate-action primary" id="convertAllCurrencyBtn" type="button">统一全部</button>
        </div>
        <label class="field budget-limit-field">
          <span>总预算</span>
          <input id="budgetLimitInput" type="number" min="0" step="50" inputmode="decimal" placeholder="例如：6000" />
        </label>
        <div class="budget-meter" aria-hidden="true"><span id="budgetMeterFill"></span></div>
        <div class="budget-stats">
          <div><strong id="budgetSpent">￥0</strong><span>已安排</span></div>
          <div><strong id="budgetRemain">￥0</strong><span>剩余</span></div>
          <div><strong id="budgetDaily">￥0</strong><span>日均</span></div>
        </div>
        <div class="category-bars" id="categoryBars"></div>
        <p class="rate-status" id="rateStatus"></p>
      </section>
    `);
    document.querySelector("#budgetLimitInput")?.addEventListener("input", (event) => updateBudgetLimit(event.target.value));
    document.querySelector("#budgetCurrencyCycle")?.addEventListener("click", cycleActiveCurrency);
    document.querySelector("#refreshRatesBtn")?.addEventListener("click", () => refreshExchangeRates(true));
    document.querySelector("#convertAllCurrencyBtn")?.addEventListener("click", convertAllTripsToActiveCurrency);
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
    grid?.replaceChildren(...activityPresets.map((preset, index) => createPresetButton(preset, index)));
  }

  if (!document.querySelector("#budgetEditor")) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="budget-editor hidden" id="budgetEditor" role="dialog" aria-modal="true" aria-labelledby="budgetEditorTitle">
        <div class="budget-editor-card">
          <div class="budget-editor-head">
            <div>
              <p>事项预算</p>
              <h2 id="budgetEditorTitle">编辑金额</h2>
            </div>
            <button class="icon-button budget-close" id="budgetCloseBtn" type="button" aria-label="关闭预算编辑">×</button>
          </div>
          <label class="field">
            <span id="budgetCostLabel">金额</span>
            <input id="budgetCostInput" type="number" min="0" step="0.01" inputmode="decimal" />
          </label>
          <label class="field">
            <span>分类</span>
            <select id="budgetCategorySelect"></select>
          </label>
          <div class="budget-editor-actions">
            <button class="ghost-action" id="budgetCancelBtn" type="button">取消</button>
            <button class="primary-action" id="budgetSaveBtn" type="button">保存</button>
          </div>
        </div>
      </div>
    `);
    const select = document.querySelector("#budgetCategorySelect");
    select?.replaceChildren(...budgetCategories.map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      return option;
    }));
    document.querySelector("#budgetCloseBtn")?.addEventListener("click", closeBudgetEditor);
    document.querySelector("#budgetCancelBtn")?.addEventListener("click", closeBudgetEditor);
    document.querySelector("#budgetSaveBtn")?.addEventListener("click", saveBudgetEditor);
    document.querySelector("#budgetEditor")?.addEventListener("click", (event) => {
      if (event.target.id === "budgetEditor") closeBudgetEditor();
    });
  }

  if (!document.querySelector("#mobileQuickbar")) {
    document.body.insertAdjacentHTML("beforeend", `
      <nav class="mobile-quickbar" id="mobileQuickbar" aria-label="移动端快捷导航">
        <button type="button" data-insight-scroll="#dayList">列表</button>
        <button type="button" data-insight-scroll="#activityForm">添加</button>
        <button type="button" data-insight-scroll="#budgetPanel">预算</button>
      </nav>
    `);
  }
}

function createPresetButton(preset, index) {
  const button = document.createElement("button");
  button.className = "preset-button";
  button.type = "button";
  button.dataset.presetIndex = String(index);
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${preset.icon}" /></svg>
    <span>${escapeHtml(preset.title)}</span>
    <strong>${formatMoney(preset.cost, "CNY")}</strong>
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
  renderCurrencyControls(trip);
  renderPresetPrices(trip);
  renderActivityCostChips(trip);
  renderDayCostBadges(trip);
}

function renderBudgetPanel(trip) {
  const currency = getBudgetCurrency(trip);
  const activities = trip.days.flatMap((day) => day.activities || []);
  const total = activities.reduce((sum, activity) => sum + getActivityBudget(trip, activity).cost, 0);
  const limit = toAmount(trip.budget?.limit);
  const remain = Math.max(0, limit - total);
  const daily = trip.days.length ? total / trip.days.length : 0;
  const percent = limit ? Math.min(100, Math.round((total / limit) * 100)) : 0;

  const limitInput = document.querySelector("#budgetLimitInput");
  if (limitInput && document.activeElement !== limitInput) limitInput.value = limit || "";
  setText("#budgetSpent", formatMoney(total, currency));
  setText("#budgetRemain", limit ? formatMoney(remain, currency) : "--");
  setText("#budgetDaily", formatMoney(daily, currency));
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
        <strong>${formatMoney(value, currency)}</strong>
      </div>
    `;
  }).join("");
  const target = document.querySelector("#categoryBars");
  if (target) target.innerHTML = bars;
  renderRateStatus();
}

function renderCurrencyControls(trip) {
  const currency = getBudgetCurrency(trip);
  const option = getCurrencyOption(currency);
  setText("#budgetCurrencyLabel", option.label);
  setText("#budgetCurrencyCode", option.code);
  const segment = document.querySelector("#currencySegment");
  if (segment && !segment.children.length) {
    segment.replaceChildren(...currencyOptions.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.currency = item.code;
      button.textContent = item.short;
      button.addEventListener("click", () => setActiveTripCurrency(item.code));
      return button;
    }));
  }
  segment?.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.currency === currency);
  });
  setText("#budgetCostLabel", `金额 (${option.short})`);
}

function renderPresetPrices(trip) {
  const currency = getBudgetCurrency(trip);
  document.querySelectorAll(".preset-button[data-preset-index]").forEach((button) => {
    const preset = activityPresets[Number(button.dataset.presetIndex)];
    const price = button.querySelector("strong");
    if (preset && price) price.textContent = formatMoney(convertCurrency(preset.cost, "CNY", currency), currency);
  });
}

function renderActivityCostChips(trip) {
  const currency = getBudgetCurrency(trip);
  document.querySelectorAll(".activity-row[data-day-id][data-activity-id]").forEach((row) => {
    const result = findActivity(trip, row.dataset.dayId, row.dataset.activityId);
    if (!result) return;
    let chip = row.querySelector(".cost-chip");
    if (!chip) {
      chip = document.createElement("button");
      chip.className = "cost-chip";
      chip.type = "button";
      chip.title = "点击修改预算";
      chip.dataset.budgetAction = "edit";
      row.querySelector(".activity-body")?.append(chip);
    }
    chip.dataset.budgetAction = "edit";
    const budget = getActivityBudget(trip, result.activity);
    chip.textContent = budget.cost ? formatMoney(budget.cost, currency) : "加预算";
  });
}

function renderDayCostBadges(trip) {
  const currency = getBudgetCurrency(trip);
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
    badge.textContent = total ? `当日 ${formatMoney(total, currency)}` : "当日未估算";
  });
}

function handleInsightClick(event) {
  const scrollButton = event.target.closest?.("[data-insight-scroll]");
  if (scrollButton) {
    const target = document.querySelector(scrollButton.dataset.insightScroll);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  const chip = event.target.closest?.(".cost-chip");
  if (!chip) return;
  const row = chip.closest(".activity-row[data-day-id][data-activity-id]");
  if (!row) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  editActivityBudget(row.dataset.dayId, row.dataset.activityId);
}

function addPresetActivity(preset) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip?.days?.length) return;
  normalizeBudget(trip);
  const currency = getBudgetCurrency(trip);
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
  trip.budget.items[activityId] = { cost: roundCurrency(convertCurrency(preset.cost, "CNY", currency), currency), category: preset.category };
  publishLibrary(library, "add-preset-activity");
  showInsightToast(`已添加 ${preset.title}`);
}

function editActivityBudget(dayId, activityId) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  const result = findActivity(trip, dayId, activityId);
  if (!result) return;
  normalizeBudget(trip);
  const budget = getActivityBudget(trip, result.activity);
  const currency = getBudgetCurrency(trip);
  editingBudgetTarget = { dayId, activityId };
  const editor = document.querySelector("#budgetEditor");
  const amountInput = document.querySelector("#budgetCostInput");
  const categorySelect = document.querySelector("#budgetCategorySelect");
  const title = document.querySelector("#budgetEditorTitle");
  if (!editor || !amountInput || !categorySelect) return;
  amountInput.value = budget.cost ? String(roundCurrency(budget.cost, currency)) : "";
  categorySelect.value = budget.category || inferCategory(result.activity);
  if (title) title.textContent = result.activity.title || "编辑金额";
  renderCurrencyControls(trip);
  editor.classList.remove("hidden");
  window.setTimeout(() => amountInput.focus(), 60);
}

function saveBudgetEditor() {
  if (!editingBudgetTarget) return;
  const library = readLibrary();
  const trip = getActiveTrip(library);
  const result = findActivity(trip, editingBudgetTarget.dayId, editingBudgetTarget.activityId);
  if (!trip || !result) return;
  normalizeBudget(trip);
  const amountInput = document.querySelector("#budgetCostInput");
  const categorySelect = document.querySelector("#budgetCategorySelect");
  const currency = getBudgetCurrency(trip);
  trip.budget.items[editingBudgetTarget.activityId] = {
    cost: roundCurrency(toAmount(amountInput?.value), currency),
    category: budgetCategories.some((item) => item.id === categorySelect?.value) ? categorySelect.value : "other",
  };
  closeBudgetEditor();
  publishLibrary(library, "update-activity-budget");
  showInsightToast("预算已更新");
}

function closeBudgetEditor() {
  editingBudgetTarget = null;
  document.querySelector("#budgetEditor")?.classList.add("hidden");
}

function updateBudgetLimit(value) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  normalizeBudget(trip);
  trip.budget.limit = roundCurrency(toAmount(value), getBudgetCurrency(trip));
  publishLibrary(library, "update-budget-limit");
}

function cycleActiveCurrency() {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  const current = getBudgetCurrency(trip);
  const index = currencyOptions.findIndex((item) => item.code === current);
  const next = currencyOptions[(index + 1) % currencyOptions.length].code;
  setActiveTripCurrency(next);
}

function setActiveTripCurrency(targetCurrency) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip || !getCurrencyOption(targetCurrency)) return;
  normalizeBudget(trip);
  convertTripBudget(trip, targetCurrency);
  publishLibrary(library, "convert-active-currency");
  showInsightToast(`已切换为 ${getCurrencyOption(targetCurrency).label}`);
}

function convertAllTripsToActiveCurrency() {
  const library = readLibrary();
  const activeTrip = getActiveTrip(library);
  if (!library?.lists?.length || !activeTrip) return;
  normalizeBudget(activeTrip);
  const targetCurrency = getBudgetCurrency(activeTrip);
  library.lists.forEach((list) => {
    if (list.trip) {
      normalizeBudget(list.trip);
      convertTripBudget(list.trip, targetCurrency);
      list.updatedAt = Date.now();
    }
  });
  publishLibrary(library, "convert-all-currency");
  showInsightToast(`全部行程已统一为 ${getCurrencyOption(targetCurrency).short}`);
}

function convertTripBudget(trip, targetCurrency) {
  const sourceCurrency = getBudgetCurrency(trip);
  if (sourceCurrency === targetCurrency) return;
  trip.budget.limit = roundCurrency(convertCurrency(trip.budget.limit || 0, sourceCurrency, targetCurrency), targetCurrency);
  Object.keys(trip.budget.items).forEach((activityId) => {
    const item = trip.budget.items[activityId];
    item.cost = roundCurrency(convertCurrency(item.cost || 0, sourceCurrency, targetCurrency), targetCurrency);
  });
  trip.budget.currency = targetCurrency;
  trip.budget.rates = exchangeSnapshot;
}

async function refreshExchangeRates(force) {
  const isFresh = Date.now() - (exchangeSnapshot.updatedAt || 0) < 12 * 60 * 60 * 1000;
  if (!force && isFresh && exchangeSnapshot.source === "frankfurter") return;
  try {
    const response = await fetch("https://api.frankfurter.app/latest?from=CNY&to=USD,EUR", { cache: "no-store" });
    if (!response.ok) throw new Error("rate response failed");
    const data = await response.json();
    const next = {
      base: "CNY",
      rates: { CNY: 1, USD: Number(data.rates?.USD) || fallbackExchangeSnapshot.rates.USD, EUR: Number(data.rates?.EUR) || fallbackExchangeSnapshot.rates.EUR },
      updatedAt: Date.now(),
      source: "frankfurter",
      date: data.date || "",
    };
    exchangeSnapshot = next;
    localStorage.setItem(ratesStorageKey, JSON.stringify(next));
    renderTripInsights();
    if (force) showInsightToast("汇率已刷新");
  } catch {
    exchangeSnapshot = exchangeSnapshot?.rates ? exchangeSnapshot : { ...fallbackExchangeSnapshot, updatedAt: Date.now() };
    if (force) showInsightToast("已使用固定汇率");
    renderRateStatus();
  }
}

function renderRateStatus() {
  const status = document.querySelector("#rateStatus");
  if (!status) return;
  const source = exchangeSnapshot.source === "frankfurter" ? "Frankfurter" : "固定汇率";
  const date = exchangeSnapshot.date || formatDateTime(exchangeSnapshot.updatedAt);
  status.textContent = `汇率：${source}${date ? ` · ${date}` : ""}`;
}

function normalizeBudget(trip) {
  trip.budget = trip.budget && typeof trip.budget === "object" ? trip.budget : { limit: 0 };
  trip.budget.currency = getCurrencyOption(trip.budget.currency)?.code || "CNY";
  trip.budget.items = trip.budget.items && typeof trip.budget.items === "object" ? trip.budget.items : {};
  trip.budget.rates = trip.budget.rates || exchangeSnapshot;
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
  const item = trip.budget?.items?.[activity.id] || {};
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
  if (window.TripPlanner?.saveExternalLibrary) {
    window.TripPlanner.saveExternalLibrary(library, reason);
    window.setTimeout(renderTripInsights, 80);
    return;
  }
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
  return;
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

function getBudgetCurrency(trip) {
  return getCurrencyOption(trip?.budget?.currency)?.code || "CNY";
}

function getCurrencyOption(code) {
  return currencyOptions.find((item) => item.code === code) || currencyOptions[0];
}

function convertCurrency(value, fromCurrency, toCurrency) {
  const rates = { ...fallbackExchangeSnapshot.rates, ...(exchangeSnapshot?.rates || {}) };
  const sourceRate = rates[fromCurrency] || 1;
  const targetRate = rates[toCurrency] || 1;
  return (toAmount(value) / sourceRate) * targetRate;
}

function roundCurrency(value, currency) {
  const digits = getCurrencyOption(currency).digits;
  const factor = 10 ** digits;
  return Math.round(toAmount(value) * factor) / factor;
}

function loadExchangeSnapshot() {
  try {
    const cached = JSON.parse(localStorage.getItem(ratesStorageKey));
    if (cached?.rates?.USD && cached?.rates?.EUR) return cached;
  } catch {
  }
  return fallbackExchangeSnapshot;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function toAmount(value) {
  return Math.max(0, Number(value) || 0);
}

function formatMoney(value, currency = "CNY") {
  const option = getCurrencyOption(currency);
  try {
    return new Intl.NumberFormat(option.locale, {
      style: "currency",
      currency: option.code,
      minimumFractionDigits: option.digits,
      maximumFractionDigits: option.digits,
    }).format(toAmount(value));
  } catch {
    return `${option.symbol}${roundCurrency(value, currency).toLocaleString("zh-CN")}`;
  }
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
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
