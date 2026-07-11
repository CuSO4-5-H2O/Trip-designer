const orderClientId = `order-controls:${crypto.randomUUID()}`;
const orderParams = new URLSearchParams(location.search);
const orderRoomId = orderParams.get("room");
const orderConfig = window.TRIP_PLANNER_CONFIG || {};
const orderStorageKey = orderRoomId ? `trip-planner-library:${orderRoomId}` : "";
const orderChannel = orderStorageKey && "BroadcastChannel" in window ? new BroadcastChannel(orderStorageKey) : null;
let orderRenderTimer = 0;

window.addEventListener("load", initOrderControls);

function initOrderControls() {
  if (!orderStorageKey) return;
  enhanceOrderControls();
  const dayList = document.querySelector("#dayList");
  if (dayList) {
    new MutationObserver(() => {
      clearTimeout(orderRenderTimer);
      orderRenderTimer = window.setTimeout(enhanceOrderControls, 30);
    }).observe(dayList, { childList: true, subtree: true });
  }
  document.addEventListener("drop", handleOrderDrop, true);
}

function enhanceOrderControls() {
  document.querySelectorAll(".day-card[data-day-id]").forEach((card, index, cards) => {
    if (card.querySelector(".day-order-actions")) return;
    const main = card.querySelector(".day-main");
    if (!main) return;
    const actions = document.createElement("span");
    actions.className = "day-order-actions";
    actions.append(
      createOrderButton("day-up", "日期上移", "m18 15-6-6-6 6", index === 0, () => moveDayByOffset(card.dataset.dayId, -1)),
      createOrderButton("day-down", "日期下移", "m6 9 6 6 6-6", index === cards.length - 1, () => moveDayByOffset(card.dataset.dayId, 1)),
    );
    const handle = card.querySelector(".day-drag-handle") || createDragHandle("拖动调整日期顺序", "day-drag-handle");
    actions.append(handle);
    main.append(actions);
  });

  document.querySelectorAll(".activity-list").forEach((list) => {
    const rows = Array.from(list.querySelectorAll(".activity-row[data-activity-id]"));
    rows.forEach((row, index) => {
      const actions = row.querySelector(".activity-actions");
      if (!actions || row.querySelector(".activity-order-button")) return;
      actions.prepend(
        createOrderButton("up", "事项上移", "m18 15-6-6-6 6", index === 0, () => moveActivityByOffset(row.dataset.dayId, row.dataset.activityId, -1), "activity-order-button"),
        createOrderButton("down", "事项下移", "m6 9 6 6 6-6", index === rows.length - 1, () => moveActivityByOffset(row.dataset.dayId, row.dataset.activityId, 1), "activity-order-button"),
      );
    });
  });
}

function createOrderButton(action, label, iconPath, disabled, onClick, className = "order-button") {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.dataset.action = action;
  button.ariaLabel = label;
  button.title = label;
  button.disabled = disabled;
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}" /></svg>`;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

function createDragHandle(label, extraClass) {
  const handle = document.createElement("span");
  handle.className = `drag-handle ${extraClass}`;
  handle.draggable = true;
  handle.title = label;
  handle.ariaLabel = label;
  handle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" /></svg>`;
  return handle;
}

function handleOrderDrop(event) {
  const raw = event.dataTransfer?.getData("text/plain");
  if (!raw) return;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  if (payload?.type !== "day" && payload?.type !== "activity") return;

  if (payload.type === "day") {
    const targetCard = event.target.closest(".day-card[data-day-id]");
    if (!targetCard) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    moveDay(payload.dayId, targetCard.dataset.dayId, isBeforeDrop(targetCard, event) ? "before" : "after");
    return;
  }

  const targetRow = event.target.closest(".activity-row[data-activity-id]");
  const targetList = event.target.closest(".activity-list[data-day-id]");
  const targetCard = event.target.closest(".day-card[data-day-id]");
  const targetDayId = targetRow?.dataset.dayId || targetList?.dataset.dayId || targetCard?.dataset.dayId;
  if (!targetDayId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  moveActivity(payload.dayId, payload.activityId, targetDayId, targetRow?.dataset.activityId || "", targetRow ? (isBeforeDrop(targetRow, event) ? "before" : "after") : "end");
}

function moveDayByOffset(dayId, offset) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  const sourceIndex = trip.days.findIndex((day) => day.id === dayId);
  const targetIndex = sourceIndex + offset;
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= trip.days.length) return;
  moveDay(dayId, trip.days[targetIndex].id, offset < 0 ? "before" : "after", library);
}

function moveDay(sourceDayId, targetDayId, position, existingLibrary = null) {
  if (sourceDayId === targetDayId) return;
  const library = existingLibrary || readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  const sourceIndex = trip.days.findIndex((day) => day.id === sourceDayId);
  const targetIndex = trip.days.findIndex((day) => day.id === targetDayId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = trip.days.splice(sourceIndex, 1);
  let insertIndex = trip.days.findIndex((day) => day.id === targetDayId);
  if (position === "after") insertIndex += 1;
  trip.days.splice(insertIndex, 0, moved);
  trip.selectedDayId = sourceDayId;
  publishLibrary(library, "reorder-days");
}

function moveActivityByOffset(dayId, activityId, offset) {
  const library = readLibrary();
  const trip = getActiveTrip(library);
  const day = trip?.days.find((item) => item.id === dayId);
  if (!day) return;
  const sourceIndex = day.activities.findIndex((activity) => activity.id === activityId);
  const targetIndex = sourceIndex + offset;
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= day.activities.length) return;
  moveActivity(dayId, activityId, dayId, day.activities[targetIndex].id, offset < 0 ? "before" : "after", library);
}

function moveActivity(sourceDayId, activityId, targetDayId, targetActivityId, position, existingLibrary = null) {
  const library = existingLibrary || readLibrary();
  const trip = getActiveTrip(library);
  if (!trip) return;
  const sourceDay = trip.days.find((day) => day.id === sourceDayId);
  const targetDay = trip.days.find((day) => day.id === targetDayId);
  if (!sourceDay || !targetDay) return;
  const sourceIndex = sourceDay.activities.findIndex((activity) => activity.id === activityId);
  if (sourceIndex < 0) return;
  const [moved] = sourceDay.activities.splice(sourceIndex, 1);
  let insertIndex = targetDay.activities.length;
  if (targetActivityId) {
    insertIndex = targetDay.activities.findIndex((activity) => activity.id === targetActivityId);
    if (insertIndex < 0) insertIndex = targetDay.activities.length;
    if (position === "after") insertIndex += 1;
  }
  targetDay.activities.splice(insertIndex, 0, moved);
  trip.selectedDayId = targetDayId;
  publishLibrary(library, "reorder-activities");
}

function readLibrary() {
  try {
    return JSON.parse(localStorage.getItem(orderStorageKey));
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
  localStorage.setItem(orderStorageKey, JSON.stringify(library));
  orderChannel?.postMessage({ type: "library", clientId: orderClientId, library, reason });
  sendRemoteState(library, reason);
}

function sendRemoteState(library, reason) {
  const endpoint = buildSyncUrl();
  if (!endpoint) return;
  try {
    const socket = new WebSocket(endpoint);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "state", clientId: orderClientId, roomId: orderRoomId, state: library, reason }));
      window.setTimeout(() => socket.close(), 120);
    });
  } catch {
  }
}

function buildSyncUrl() {
  const configuredEndpoint = orderParams.get("sync") || orderConfig.syncEndpoint || "";
  const endpoint = configuredEndpoint.trim() || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/sync`;
  try {
    const url = new URL(endpoint, location.href);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return "";
    url.searchParams.set("room", orderRoomId);
    return url.toString();
  } catch {
    return "";
  }
}

function isBeforeDrop(element, event) {
  const rect = element.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2;
}
