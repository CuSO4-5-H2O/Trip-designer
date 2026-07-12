const quickPlanParams = new URLSearchParams(location.search);
const quickPlanRoomId = quickPlanParams.get("room");
const quickPlanStorageKey = quickPlanRoomId ? `trip-planner-library:${quickPlanRoomId}` : "";
let quickPlanRenderTimer = 0;
let draggedSegmentIndex = -1;

window.addEventListener("load", initQuickPlan);
window.addEventListener("tripplanner:render", scheduleQuickPlanRender);

function initQuickPlan() {
  if (!quickPlanStorageKey) return;
  injectQuickPlanPanel();
  renderQuickPlanSegments();
  window.setTimeout(renderQuickPlanSegments, 140);
}

function scheduleQuickPlanRender() {
  clearTimeout(quickPlanRenderTimer);
  quickPlanRenderTimer = window.setTimeout(renderQuickPlanSegments, 80);
}

function injectQuickPlanPanel() {
  const timelineHead = document.querySelector(".timeline-head");
  if (!timelineHead || document.querySelector("#quickPlanPanel")) return;
  timelineHead.insertAdjacentHTML("afterend", `
    <section class="quick-plan-panel" id="quickPlanPanel">
      <div class="section-heading quick-plan-heading">
        <p>\u5feb\u901f\u89c4\u5212</p>
        <span>\u57ce\u5e02 + \u5929\u6570\u4e00\u952e\u6dfb\u52a0\uff0c\u57ce\u5e02\u6bb5\u53ef\u62d6\u52a8</span>
      </div>
      <div class="quick-plan-form">
        <label class="field quick-city-field">
          <span>\u57ce\u5e02</span>
          <input id="quickPlanCity" type="text" placeholder="\u4f8b\u5982\uff1a\u4e1c\u4eac" />
        </label>
        <label class="field quick-days-field">
          <span>\u5929\u6570</span>
          <input id="quickPlanDays" type="number" min="1" max="60" step="1" value="2" inputmode="numeric" />
        </label>
        <button class="primary-action quick-add" id="quickPlanAddBtn" type="button">\u4e00\u952e\u6dfb\u52a0</button>
      </div>
      <div class="quick-plan-batch">
        <textarea id="quickPlanBatch" rows="2" placeholder="\u6279\u91cf\uff1a\u4e1c\u4eac3\u5929\uff0c\u5927\u962a2\u5929\uff0c\u4eac\u90fd1\u5929"></textarea>
        <button class="ghost-action quick-batch" id="quickPlanBatchBtn" type="button">\u6279\u91cf\u6dfb\u52a0</button>
      </div>
      <div class="quick-segment-list" id="quickSegmentList" aria-label="\u57ce\u5e02\u6bb5\u5217\u8868"></div>
    </section>
  `);
  document.querySelector("#quickPlanAddBtn")?.addEventListener("click", addSingleQuickPlanSegment);
  document.querySelector("#quickPlanBatchBtn")?.addEventListener("click", addBatchQuickPlanSegments);
  document.querySelector("#quickPlanCity")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addSingleQuickPlanSegment();
  });
  document.querySelector("#quickPlanDays")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addSingleQuickPlanSegment();
  });
}

function renderQuickPlanSegments() {
  injectQuickPlanPanel();
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  const target = document.querySelector("#quickSegmentList");
  if (!trip || !target) return;
  const segments = getCitySegments(trip);
  target.replaceChildren(...segments.map((segment, index) => createQuickSegmentItem(segment, index, segments.length)));
}

function createQuickSegmentItem(segment, index, total) {
  const item = document.createElement("article");
  item.className = "quick-segment-item";
  item.draggable = true;
  item.dataset.segmentIndex = String(index);
  item.innerHTML = `
    <button class="quick-drag" type="button" aria-label="\u62d6\u52a8\u57ce\u5e02\u6bb5" title="\u62d6\u52a8\u57ce\u5e02\u6bb5">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" /></svg>
    </button>
    <label class="quick-segment-city">
      <span>\u57ce\u5e02</span>
      <input type="text" value="${escapeQuickHtml(segment.city)}" aria-label="\u57ce\u5e02\u540d\u79f0" />
    </label>
    <label class="quick-segment-days">
      <span>\u5929\u6570</span>
      <input type="number" min="1" max="60" step="1" value="${segment.count}" aria-label="\u57ce\u5e02\u5929\u6570" />
    </label>
    <div class="quick-segment-actions">
      <button type="button" data-action="up" title="\u4e0a\u79fb" aria-label="\u57ce\u5e02\u6bb5\u4e0a\u79fb" ${index === 0 ? "disabled" : ""}>\u2191</button>
      <button type="button" data-action="down" title="\u4e0b\u79fb" aria-label="\u57ce\u5e02\u6bb5\u4e0b\u79fb" ${index === total - 1 ? "disabled" : ""}>\u2193</button>
      <button type="button" data-action="delete" class="danger" title="\u5220\u9664\u57ce\u5e02\u6bb5" aria-label="\u5220\u9664\u57ce\u5e02\u6bb5">\u00d7</button>
    </div>
  `;

  item.addEventListener("dragstart", (event) => {
    draggedSegmentIndex = index;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  });
  item.addEventListener("dragend", () => {
    draggedSegmentIndex = -1;
    item.classList.remove("dragging");
    document.querySelectorAll(".quick-segment-item.drop-before, .quick-segment-item.drop-after").forEach((node) => node.classList.remove("drop-before", "drop-after"));
  });
  item.addEventListener("dragover", (event) => {
    if (draggedSegmentIndex < 0 || draggedSegmentIndex === index) return;
    event.preventDefault();
    const before = isBeforeQuickDrop(item, event);
    item.classList.toggle("drop-before", before);
    item.classList.toggle("drop-after", !before);
  });
  item.addEventListener("drop", (event) => {
    if (draggedSegmentIndex < 0 || draggedSegmentIndex === index) return;
    event.preventDefault();
    moveQuickSegment(draggedSegmentIndex, index, isBeforeQuickDrop(item, event) ? "before" : "after");
  });

  const cityInput = item.querySelector(".quick-segment-city input");
  const daysInput = item.querySelector(".quick-segment-days input");
  cityInput?.addEventListener("change", (event) => updateQuickSegmentCity(index, event.target.value));
  daysInput?.addEventListener("change", (event) => updateQuickSegmentDays(index, event.target.value));
  cityInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    updateQuickSegmentCity(index, event.currentTarget.value);
    event.currentTarget.blur();
  });
  daysInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    updateQuickSegmentDays(index, event.currentTarget.value);
    event.currentTarget.blur();
  });
  item.querySelector('[data-action="up"]')?.addEventListener("click", () => moveQuickSegment(index, index - 1, "before"));
  item.querySelector('[data-action="down"]')?.addEventListener("click", () => moveQuickSegment(index, index + 1, "after"));
  item.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteQuickSegment(index));
  return item;
}

function addSingleQuickPlanSegment() {
  const cityInput = document.querySelector("#quickPlanCity");
  const daysInput = document.querySelector("#quickPlanDays");
  const city = normalizeQuickCity(cityInput?.value || "");
  const count = clampQuickDays(daysInput?.value || 1);
  if (!city) {
    showQuickToast("\u5148\u8f93\u5165\u57ce\u5e02");
    cityInput?.focus();
    return;
  }
  appendQuickSegments([{ city, count }], "add-quick-city");
  if (cityInput) cityInput.value = "";
  cityInput?.focus();
}

function addBatchQuickPlanSegments() {
  const batchInput = document.querySelector("#quickPlanBatch");
  const segments = parseQuickBatch(batchInput?.value || "");
  if (!segments.length) {
    showQuickToast("\u8f93\u5165\u683c\u5f0f\u5982\uff1a\u4e1c\u4eac3\u5929\uff0c\u5927\u962a2\u5929");
    batchInput?.focus();
    return;
  }
  appendQuickSegments(segments, "add-quick-batch");
  if (batchInput) batchInput.value = "";
}

function appendQuickSegments(segments, reason) {
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  if (!trip) return;
  const available = Math.max(0, 60 - trip.days.length);
  let used = 0;
  segments.forEach((segment) => {
    const count = Math.min(segment.count, Math.max(0, available - used));
    for (let index = 0; index < count; index += 1) trip.days.push(createQuickDay(segment.city));
    used += count;
  });
  if (!used) {
    showQuickToast("\u6700\u591a\u652f\u6301 60 \u5929");
    return;
  }
  trip.dayLimit = Math.max(trip.dayLimit || 30, trip.days.length);
  trip.selectedDayId = trip.days[trip.days.length - used]?.id || trip.days[0]?.id || "";
  publishQuickLibrary(library, reason);
  showQuickToast(`\u5df2\u6dfb\u52a0 ${used} \u5929`);
}

function updateQuickSegmentCity(segmentIndex, rawCity) {
  const city = normalizeQuickCity(rawCity);
  if (!city) return renderQuickPlanSegments();
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  const segments = getCitySegments(trip);
  const segment = segments[segmentIndex];
  if (!trip || !segment) return;
  const stamp = Date.now();
  for (let index = segment.start; index <= segment.end; index += 1) {
    trip.days[index].location = city;
    trip.days[index].updatedAt = stamp;
  }
  publishQuickLibrary(library, "update-quick-city");
  showQuickToast("\u57ce\u5e02\u5df2\u66f4\u65b0");
}

function updateQuickSegmentDays(segmentIndex, rawCount) {
  const nextCount = clampQuickDays(rawCount);
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  const segments = getCitySegments(trip);
  const segment = segments[segmentIndex];
  if (!trip || !segment) return;
  const delta = nextCount - segment.count;
  if (delta > 0) {
    const available = Math.max(0, 60 - trip.days.length);
    const addCount = Math.min(delta, available);
    const additions = Array.from({ length: addCount }, () => createQuickDay(segment.city));
    trip.days.splice(segment.end + 1, 0, ...additions);
    if (addCount < delta) showQuickToast("\u6700\u591a\u652f\u6301 60 \u5929");
  } else if (delta < 0) {
    const removeCount = Math.min(segment.count - 1, Math.abs(delta));
    trip.days.splice(segment.end - removeCount + 1, removeCount);
  }
  const stamp = Date.now();
  trip.updatedAt = stamp;
  trip.orderUpdatedAt = stamp;
  trip.dayLimit = Math.max(trip.days.length, trip.dayLimit || 30);
  trip.selectedDayId = trip.days[Math.min(segment.start, trip.days.length - 1)]?.id || trip.days[0]?.id || "";
  publishQuickLibrary(library, "update-quick-days");
  showQuickToast("\u5929\u6570\u5df2\u66f4\u65b0");
}

function deleteQuickSegment(segmentIndex) {
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  const segments = getCitySegments(trip);
  const segment = segments[segmentIndex];
  if (!trip || !segment) return;
  trip.days.splice(segment.start, segment.count);
  if (!trip.days.length) trip.days.push(createQuickDay("\u672a\u5b9a"));
  trip.selectedDayId = trip.days[Math.min(segment.start, trip.days.length - 1)]?.id || trip.days[0]?.id || "";
  trip.dayLimit = Math.max(trip.days.length, trip.dayLimit || 30);
  const stamp = Date.now();
  trip.updatedAt = stamp;
  trip.orderUpdatedAt = stamp;
  publishQuickLibrary(library, "delete-quick-segment");
  showQuickToast("\u57ce\u5e02\u6bb5\u5df2\u5220\u9664");
}

function moveQuickSegment(sourceIndex, targetIndex, position) {
  const library = readQuickLibrary();
  const trip = getQuickActiveTrip(library);
  const segments = getCitySegments(trip);
  if (!trip || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= segments.length || targetIndex >= segments.length) return;
  const blocks = segments.map((segment) => trip.days.slice(segment.start, segment.end + 1));
  const [moved] = blocks.splice(sourceIndex, 1);
  let insertIndex = targetIndex;
  if (sourceIndex < targetIndex) insertIndex -= 1;
  if (position === "after") insertIndex += 1;
  blocks.splice(Math.max(0, insertIndex), 0, moved);
  trip.days = blocks.flat();
  trip.selectedDayId = moved[0]?.id || trip.days[0]?.id || "";
  const stamp = Date.now();
  trip.updatedAt = stamp;
  trip.orderUpdatedAt = stamp;
  publishQuickLibrary(library, "reorder-quick-segments");
  showQuickToast("\u57ce\u5e02\u987a\u5e8f\u5df2\u8c03\u6574");
}

function getCitySegments(trip) {
  if (!trip?.days?.length) return [];
  const segments = [];
  trip.days.forEach((day, index) => {
    const city = getQuickCity(day.location);
    const last = segments[segments.length - 1];
    if (last && last.city === city) {
      last.end = index;
      last.count += 1;
      return;
    }
    segments.push({ city, start: index, end: index, count: 1 });
  });
  return segments;
}

function createQuickDay(city) {
  const stamp = Date.now();
  return {
    id: crypto.randomUUID(),
    location: city,
    stay: "",
    activities: [],
    updatedAt: stamp,
    orderUpdatedAt: stamp,
  };
}

function parseQuickBatch(value) {
  return String(value)
    .split(/[\uff0c,\uff1b;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)(?:\s*[xX*\u00d7-]?\s*)(\d+)\s*(?:\u5929|\u65e5|days?|d)?$/i);
      if (!match) return { city: normalizeQuickCity(item), count: 1 };
      return { city: normalizeQuickCity(match[1]), count: clampQuickDays(match[2]) };
    })
    .filter((item) => item.city && item.count > 0);
}

function getQuickCity(location) {
  const text = normalizeQuickCity(location);
  if (!text) return "\u672a\u5b9a";
  return text.split(/[\u00b7\u30fb\uff0f/|\uff0c,\u3001-]/)[0]?.trim() || text;
}

function normalizeQuickCity(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampQuickDays(value) {
  return Math.max(1, Math.min(60, Math.round(Number(value) || 1)));
}

function isBeforeQuickDrop(element, event) {
  const rect = element.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2;
}

function readQuickLibrary() {
  if (window.TripPlanner?.getLibrary) return window.TripPlanner.getLibrary();
  try { return JSON.parse(localStorage.getItem(quickPlanStorageKey)); }
  catch { return null; }
}

function getQuickActiveTrip(library) {
  if (!library?.lists?.length) return null;
  return (library.lists.find((list) => list.id === library.activeListId) || library.lists[0]).trip;
}

function publishQuickLibrary(library, reason) {
  if (!library || !window.TripPlanner?.saveExternalLibrary) {
    showQuickToast("行程数据还在加载，请稍后再试");
    return;
  }
  window.TripPlanner.saveExternalLibrary(library, reason);
  window.setTimeout(renderQuickPlanSegments, 80);
}

function showQuickToast(text) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeQuickHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
