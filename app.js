const transportTypes = [
  { id: "plane", label: "飞机", icon: "M3 11l18-7-7 17-3-7-8-3Z" },
  { id: "train", label: "火车", icon: "M6 4h12v10a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4Zm3 16 2-2m4 2-2-2M8 8h8M8 12h8" },
  { id: "bus", label: "大巴", icon: "M5 6h14v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6Zm2 0V4h10v2M8 18v2m8-2v2M7 11h10" },
  { id: "boat", label: "船", icon: "M3 15l3-7h12l3 7-3 5H6l-3-5Zm6-7V4h6v4" },
  { id: "car", label: "车", icon: "M5 15l1.4-4.2A3 3 0 0 1 9.2 9h5.6a3 3 0 0 1 2.8 1.8L19 15M4 15h16v4H4v-4Zm3 4v2m10-2v2M7 15h10M8 17h.01M16 17h.01" },
];

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "long" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
});

const localClientIdKey = "trip-planner:client-id";
const clientId = getClientId();
const params = new URLSearchParams(location.search);
const appConfig = window.TRIP_PLANNER_CONFIG || {};
const roomId = params.get("room") || createRoomId();
const storageKey = `trip-planner-library:${roomId}`;
const legacyStorageKey = `trip-planner:${roomId}`;
const localNameKey = "trip-planner:member-name";
const channel = "BroadcastChannel" in window ? new BroadcastChannel(storageKey) : null;

let library = loadLibrary();
let state = getActiveTrip();
let selectedDayId = state.selectedDayId || state.days[0]?.id;
let ws = null;
let wsReady = false;
let applyingRemote = false;
let saveTimer = 0;
let reconnectTimer = 0;
let toastTimer = 0;
let members = new Map();

const els = {
  tripTitle: document.querySelector("#tripTitle"),
  startDate: document.querySelector("#startDate"),
  originCity: document.querySelector("#originCity"),
  memberName: document.querySelector("#memberName"),
  memberStrip: document.querySelector("#memberStrip"),
  roomCode: document.querySelector("#roomCode"),
  tripList: document.querySelector("#tripList"),
  addListBtn: document.querySelector("#addListBtn"),
  listNameInput: document.querySelector("#listNameInput"),
  dayCount: document.querySelector("#dayCount"),
  activityCount: document.querySelector("#activityCount"),
  stayCount: document.querySelector("#stayCount"),
  transportSummary: document.querySelector("#transportSummary"),
  dayList: document.querySelector("#dayList"),
  addDayBtn: document.querySelector("#addDayBtn"),
  addDayTopBtn: document.querySelector("#addDayTopBtn"),
  syncState: document.querySelector("#syncState"),
  syncText: document.querySelector("#syncText"),
  copyLinkBtn: document.querySelector("#copyLinkBtn"),
  detailLabel: document.querySelector("#detailLabel"),
  deleteDayBtn: document.querySelector("#deleteDayBtn"),
  detailLocation: document.querySelector("#detailLocation"),
  detailStay: document.querySelector("#detailStay"),
  transportTabs: document.querySelector("#transportTabs"),
  transportFrom: document.querySelector("#transportFrom"),
  transportTo: document.querySelector("#transportTo"),
  transportDepart: document.querySelector("#transportDepart"),
  transportArrive: document.querySelector("#transportArrive"),
  activityForm: document.querySelector("#activityForm"),
  activityTime: document.querySelector("#activityTime"),
  activityPlace: document.querySelector("#activityPlace"),
  activityTitle: document.querySelector("#activityTitle"),
  activityNote: document.querySelector("#activityNote"),
  toast: document.querySelector("#toast"),
  dayCardTemplate: document.querySelector("#dayCardTemplate"),
};

init();

function init() {
  ensureRoomParam();
  ensureLocalMember();
  renderTransportTabs();
  bindEvents();
  render();
  connectRealtime();
}

function createSeedTrip() {
  const start = toDateInputValue(new Date());
  return {
    version: 1,
    tripTitle: "东京春日行",
    startDate: start,
    originCity: "上海",
    selectedDayId: "",
    updatedAt: Date.now(),
    days: [
      {
        id: crypto.randomUUID(),
        location: "东京 · 浅草",
        stay: "浅草雷门酒店",
        transport: { type: "plane", from: "上海浦东", to: "东京成田", depart: "08:20", arrive: "12:10" },
        activities: [
          { id: crypto.randomUUID(), time: "09:30", title: "浅草寺", place: "台东区", note: "先逛雷门，再去仲见世通。", done: false },
          { id: crypto.randomUUID(), time: "14:10", title: "隅田川游船", place: "吾妻桥码头", note: "提前 20 分钟到码头。", done: false },
          { id: crypto.randomUUID(), time: "19:00", title: "入住酒店", place: "浅草", note: "确认次日早餐时间。", done: false },
        ],
      },
      {
        id: crypto.randomUUID(),
        location: "东京 · 涩谷",
        stay: "新宿站前酒店",
        transport: { type: "train", from: "浅草", to: "涩谷", depart: "10:00", arrive: "10:35" },
        activities: [
          { id: crypto.randomUUID(), time: "11:00", title: "明治神宫散步", place: "原宿", note: "", done: false },
          { id: crypto.randomUUID(), time: "16:30", title: "涩谷 Sky", place: "涩谷", note: "看日落，带证件。", done: false },
        ],
      },
      {
        id: crypto.randomUUID(),
        location: "河口湖",
        stay: "湖畔温泉旅馆",
        transport: { type: "bus", from: "新宿", to: "河口湖", depart: "08:45", arrive: "10:40" },
        activities: [
          { id: crypto.randomUUID(), time: "13:00", title: "湖边骑行", place: "河口湖大桥", note: "按天气调整。", done: false },
        ],
      },
    ],
  };
}

function createBlankTrip(title) {
  const firstDay = {
    id: crypto.randomUUID(),
    location: "",
    stay: "",
    transport: { type: "train", from: "", to: "", depart: "", arrive: "" },
    activities: [],
  };
  return {
    version: 1,
    tripTitle: title,
    startDate: toDateInputValue(new Date()),
    originCity: "",
    selectedDayId: firstDay.id,
    updatedAt: Date.now(),
    days: [firstDay],
  };
}

function createList(name, trip = createBlankTrip(name)) {
  trip.tripTitle = trip.tripTitle || name;
  trip.selectedDayId = trip.selectedDayId || trip.days[0]?.id || "";
  return {
    id: crypto.randomUUID(),
    name,
    trip,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function loadLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.lists?.length) {
      return normalizeLibrary(saved);
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  try {
    const legacyTrip = JSON.parse(localStorage.getItem(legacyStorageKey));
    if (legacyTrip?.days?.length) {
      return normalizeLibrary({
        version: 2,
        activeListId: "",
        lists: [createList(legacyTrip.tripTitle || "我的行程单", legacyTrip)],
        updatedAt: Date.now(),
      });
    }
  } catch {
    localStorage.removeItem(legacyStorageKey);
  }

  const seedTrip = createSeedTrip();
  seedTrip.selectedDayId = seedTrip.days[0].id;
  const seedList = createList(seedTrip.tripTitle, seedTrip);
  return normalizeLibrary({
    version: 2,
    activeListId: seedList.id,
    lists: [seedList],
    updatedAt: Date.now(),
  });
}

function normalizeLibrary(input) {
  const lists = (input.lists || [])
    .filter((list) => list?.trip?.days?.length)
    .map((list, index) => {
      const name = (list.name || list.trip.tripTitle || `行程单 ${index + 1}`).trim();
      list.id = list.id || crypto.randomUUID();
      list.name = name;
      list.trip.tripTitle = list.trip.tripTitle || name;
      list.trip.selectedDayId = list.trip.selectedDayId || list.trip.days[0].id;
      list.trip.updatedAt = list.trip.updatedAt || Date.now();
      list.createdAt = list.createdAt || Date.now();
      list.updatedAt = list.updatedAt || list.trip.updatedAt;
      return list;
    });

  if (lists.length === 0) {
    lists.push(createList("新行程单", createBlankTrip("新行程单")));
  }

  return {
    version: 2,
    activeListId: lists.some((list) => list.id === input.activeListId) ? input.activeListId : lists[0].id,
    lists,
    updatedAt: input.updatedAt || Date.now(),
  };
}

function wrapLegacyRemote(remoteTrip) {
  return normalizeLibrary({
    version: 2,
    activeListId: "",
    lists: [createList(remoteTrip.tripTitle || "共享行程单", remoteTrip)],
    updatedAt: remoteTrip.updatedAt || Date.now(),
  });
}

function bindEvents() {
  els.tripTitle.addEventListener("input", () => updateState({ tripTitle: els.tripTitle.value }));
  els.startDate.addEventListener("change", () => updateState({ startDate: els.startDate.value }));
  els.originCity.addEventListener("input", () => updateState({ originCity: els.originCity.value }));
  els.listNameInput.addEventListener("input", () => renameActiveList(els.listNameInput.value));
  els.addListBtn.addEventListener("click", addList);
  els.memberName.addEventListener("input", () => {
    localStorage.setItem(localNameKey, els.memberName.value.trim() || "我");
    announcePresence();
  });
  els.addDayBtn.addEventListener("click", addDay);
  els.addDayTopBtn.addEventListener("click", addDay);
  els.copyLinkBtn.addEventListener("click", copyShareLink);
  els.deleteDayBtn.addEventListener("click", deleteSelectedDay);
  els.detailLocation.addEventListener("input", () => updateSelectedDay({ location: els.detailLocation.value }));
  els.detailStay.addEventListener("input", () => updateSelectedDay({ stay: els.detailStay.value }));
  els.transportFrom.addEventListener("input", () => updateTransport({ from: els.transportFrom.value }));
  els.transportTo.addEventListener("input", () => updateTransport({ to: els.transportTo.value }));
  els.transportDepart.addEventListener("input", () => updateTransport({ depart: els.transportDepart.value }));
  els.transportArrive.addEventListener("input", () => updateTransport({ arrive: els.transportArrive.value }));
  els.activityForm.addEventListener("submit", addActivity);

  channel?.addEventListener("message", (event) => {
    if (event.data?.clientId === clientId || event.data?.type !== "library") return;
    applyRemoteState(event.data.library, "同浏览器标签页已同步");
  });

  window.addEventListener("beforeunload", () => {
    sendWs({ type: "leave", clientId });
  });
}

function render() {
  state = getActiveTrip();
  selectedDayId = selectedDayId || state.days[0]?.id;
  if (!state.days.some((day) => day.id === selectedDayId)) {
    selectedDayId = state.days[0]?.id || "";
  }
  state.selectedDayId = selectedDayId;

  els.tripTitle.value = state.tripTitle;
  els.startDate.value = state.startDate;
  els.originCity.value = state.originCity || "";
  els.memberName.value = localStorage.getItem(localNameKey) || "我";
  els.listNameInput.value = getActiveList().name;
  els.roomCode.textContent = roomId;

  renderTripLists();
  renderStats();
  renderMembers();
  renderDays();
  renderDetail();
}

function renderTripLists() {
  els.tripList.replaceChildren(
    ...library.lists.map((list) => {
      const row = document.createElement("div");
      const item = document.createElement("button");
      const deleteButton = document.createElement("button");
      const count = list.trip.days.reduce((total, day) => total + day.activities.length, 0);
      const isActive = list.id === library.activeListId;

      row.className = "trip-list-row";
      row.classList.toggle("active", isActive);

      item.className = "trip-list-item";
      item.type = "button";
      item.classList.toggle("active", isActive);
      item.innerHTML = `
        <span class="trip-list-name">${escapeHtml(list.name)}</span>
        <span class="trip-list-meta">${list.trip.days.length} 天 · ${count} 项</span>
      `;
      item.addEventListener("click", () => switchList(list.id));

      deleteButton.className = "trip-list-delete";
      deleteButton.type = "button";
      deleteButton.title = "删除行程单";
      deleteButton.ariaLabel = `删除${list.name}`;
      deleteButton.disabled = library.lists.length <= 1;
      deleteButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
        </svg>
      `;
      deleteButton.addEventListener("click", () => deleteList(list.id));

      row.append(item, deleteButton);
      return row;
    }),
  );
}

function renderStats() {
  const activityTotal = state.days.reduce((total, day) => total + day.activities.length, 0);
  const stayTotal = state.days.filter((day) => day.stay.trim()).length;
  els.dayCount.textContent = `${state.days.length} 天`;
  els.activityCount.textContent = activityTotal;
  els.stayCount.textContent = stayTotal;

  const counts = transportTypes.map((type) => ({
    ...type,
    count: state.days.filter((day) => day.transport.type === type.id).length,
  }));
  els.transportSummary.replaceChildren(
    ...counts
      .filter((type) => type.count > 0)
      .map((type) => createPill(`${type.label} ${type.count}`, "transport-chip", type.icon)),
  );
}

function renderMembers() {
  const local = {
    name: localStorage.getItem(localNameKey) || "我",
    clientId,
    at: Date.now(),
  };
  members.set(clientId, local);
  const freshMembers = Array.from(members.values()).filter((member) => Date.now() - member.at < 20000);
  els.memberStrip.replaceChildren(
    ...freshMembers.map((member) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "member";
      node.classList.toggle("editable", member.clientId === clientId);
      node.title = member.clientId === clientId ? "点击修改你的同行名称" : `${member.name} 正在查看`;
      node.innerHTML = `<span class="avatar">${escapeHtml(member.name.slice(0, 1).toUpperCase())}</span>${escapeHtml(member.name)}`;
      if (member.clientId === clientId) {
        node.addEventListener("click", focusMemberName);
      }
      return node;
    }),
  );
}
function renderDays() {
  const fragment = document.createDocumentFragment();
  state.days.forEach((day, index) => {
    const card = els.dayCardTemplate.content.firstElementChild.cloneNode(true);
    const dayDate = getDayDate(index);
    const isActive = day.id === selectedDayId;
    card.classList.toggle("active", isActive);
    card.querySelector(".day-index").textContent = `第 ${index + 1} 天`;
    card.querySelector(".day-date").textContent = dateFormatter.format(dayDate);
    card.querySelector(".day-weekday").textContent = weekdayFormatter.format(dayDate);
    card.querySelector(".day-main").addEventListener("click", () => {
      selectedDayId = day.id;
      state.selectedDayId = day.id;
      persistAndBroadcast("selection");
      render();
    });

    const meta = card.querySelector(".day-meta");
    meta.append(
      createEditablePill(day.location || "未填写地点", "meta-pill", "M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z M12 10.5h.01", "修改当天地点", () => focusDayField(day.id, "location")),
      createEditablePill(day.stay || "未填写住宿", "meta-pill", "M4 20V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12M4 12h16M8 12V9h8v3", "修改当天住宿", () => focusDayField(day.id, "stay")),
      createEditablePill(getTransportLabel(day.transport), "transport-chip", getTransportIcon(day.transport.type), "修改当天交通", () => focusDayField(day.id, "transport")),
    );

    const list = card.querySelector(".activity-list");
    if (day.activities.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "还没有事项，右侧可以添加。";
      list.append(empty);
    } else {
      day.activities
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
        .forEach((activity) => list.append(createActivityRow(day.id, activity)));
    }
    fragment.append(card);
  });
  els.dayList.replaceChildren(fragment);
}

function renderDetail() {
  const day = getSelectedDay();
  const index = state.days.findIndex((item) => item.id === day?.id);
  els.deleteDayBtn.disabled = state.days.length <= 1;
  if (!day) return;

  els.detailLabel.textContent = `第 ${index + 1} 天 · ${weekdayFormatter.format(getDayDate(index))}`;
  els.detailLocation.value = day.location;
  els.detailStay.value = day.stay;
  els.transportFrom.value = day.transport.from || "";
  els.transportTo.value = day.transport.to || "";
  els.transportDepart.value = day.transport.depart || "";
  els.transportArrive.value = day.transport.arrive || "";

  els.transportTabs.querySelectorAll(".transport-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === day.transport.type);
  });
}

function renderTransportTabs() {
  els.transportTabs.replaceChildren(
    ...transportTypes.map((type) => {
      const button = document.createElement("button");
      button.className = "transport-tab";
      button.type = "button";
      button.dataset.type = type.id;
      button.textContent = type.label;
      button.addEventListener("click", () => updateTransport({ type: type.id }));
      return button;
    }),
  );
}

function createActivityRow(dayId, activity) {
  const row = document.createElement("div");
  row.className = "activity-row";
  row.innerHTML = `
    <span class="activity-time">${escapeHtml(activity.time)}</span>
    <span class="activity-body">
      <strong>${escapeHtml(activity.title)}</strong>
      ${activity.place ? `<span>${escapeHtml(activity.place)}</span>` : ""}
      ${activity.note ? `<p>${escapeHtml(activity.note)}</p>` : ""}
    </span>
    <button class="remove-activity" type="button" aria-label="删除事项" title="删除事项">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>
    </button>
  `;
  row.querySelector("button").addEventListener("click", (event) => {
    event.stopPropagation();
    const day = state.days.find((item) => item.id === dayId);
    day.activities = day.activities.filter((item) => item.id !== activity.id);
    persistAndBroadcast("delete-activity");
    render();
  });
  return row;
}

function createPill(text, className, iconPath) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}" /></svg>${escapeHtml(text)}`;
  return pill;
}

function createEditablePill(text, className, iconPath, label, onClick) {
  const pill = document.createElement("button");
  pill.className = `${className} editable-pill`;
  pill.type = "button";
  pill.ariaLabel = label;
  pill.title = label;
  pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}" /></svg>${escapeHtml(text)}`;
  pill.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return pill;
}

function focusMemberName() {
  els.memberName.focus();
  els.memberName.select();
}

function focusDayField(dayId, field) {
  selectedDayId = dayId;
  state.selectedDayId = dayId;
  persistAndBroadcast("selection");
  render();
  requestAnimationFrame(() => {
    if (field === "location") {
      focusAndSelect(els.detailLocation);
      return;
    }
    if (field === "stay") {
      focusAndSelect(els.detailStay);
      return;
    }
    document.querySelector(".transport-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    els.transportTabs.querySelector(".transport-tab.active")?.focus();
  });
}

function focusAndSelect(input) {
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus();
  input.select();
}
function addList() {
  const name = `新行程单 ${library.lists.length + 1}`;
  const list = createList(name, createBlankTrip(name));
  library.lists.push(list);
  library.activeListId = list.id;
  state = list.trip;
  selectedDayId = state.selectedDayId;
  persistAndBroadcast("add-list");
  render();
  els.listNameInput.focus();
  els.listNameInput.select();
  showToast("已新建独立行程单");
}

function switchList(listId) {
  if (library.activeListId === listId) return;
  library.activeListId = listId;
  state = getActiveTrip();
  selectedDayId = state.selectedDayId || state.days[0]?.id || "";
  persistAndBroadcast("switch-list");
  render();
}

function deleteList(listId) {
  if (library.lists.length <= 1) {
    showToast("至少保留一个行程单");
    return;
  }
  const index = library.lists.findIndex((list) => list.id === listId);
  if (index < 0) return;

  const [deleted] = library.lists.splice(index, 1);
  if (library.activeListId === listId) {
    const nextList = library.lists[Math.max(0, index - 1)] || library.lists[0];
    library.activeListId = nextList.id;
    state = nextList.trip;
    selectedDayId = state.selectedDayId || state.days[0]?.id || "";
  }
  persistAndBroadcast("delete-list");
  render();
  showToast(`已删除 ${deleted.name}`);
}

function renameActiveList(rawName) {
  const list = getActiveList();
  const name = rawName.trim() || "未命名行程单";
  list.name = name;
  state.tripTitle = name;
  els.tripTitle.value = name;
  persistAndBroadcast("rename-list");
  renderTripLists();
}

function addDay() {
  const newDay = {
    id: crypto.randomUUID(),
    location: "",
    stay: "",
    transport: { type: "train", from: "", to: "", depart: "", arrive: "" },
    activities: [],
  };
  state.days.push(newDay);
  selectedDayId = newDay.id;
  persistAndBroadcast("add-day");
  render();
  requestAnimationFrame(() => {
    document.querySelector(".day-card.active")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  showToast("已添加新日期");
}

function deleteSelectedDay() {
  if (state.days.length <= 1) return;
  const index = state.days.findIndex((day) => day.id === selectedDayId);
  state.days = state.days.filter((day) => day.id !== selectedDayId);
  selectedDayId = state.days[Math.max(0, index - 1)]?.id || state.days[0].id;
  persistAndBroadcast("delete-day");
  render();
  showToast("已删除当天行程");
}

function addActivity(event) {
  event.preventDefault();
  const day = getSelectedDay();
  if (!day) return;
  day.activities.push({
    id: crypto.randomUUID(),
    time: els.activityTime.value,
    title: els.activityTitle.value.trim(),
    place: els.activityPlace.value.trim(),
    note: els.activityNote.value.trim(),
    done: false,
  });
  els.activityForm.reset();
  persistAndBroadcast("add-activity");
  render();
  showToast("事项已加入当天列表");
}

function updateState(patch) {
  Object.assign(state, patch);
  if (Object.hasOwn(patch, "tripTitle")) {
    getActiveList().name = patch.tripTitle.trim() || "未命名行程单";
  }
  persistAndBroadcast("update-trip");
  render();
}

function updateSelectedDay(patch) {
  const day = getSelectedDay();
  if (!day) return;
  Object.assign(day, patch);
  persistAndBroadcast("update-day");
  render();
}

function updateTransport(patch) {
  const day = getSelectedDay();
  if (!day) return;
  day.transport = { ...day.transport, ...patch };
  persistAndBroadcast("update-transport");
  render();
}

function persistAndBroadcast(reason) {
  if (applyingRemote) return;
  clearTimeout(saveTimer);
  const list = getActiveList();
  state.selectedDayId = selectedDayId;
  state.updatedAt = Date.now();
  list.trip = state;
  list.updatedAt = state.updatedAt;
  library.updatedAt = Date.now();
  localStorage.setItem(storageKey, JSON.stringify(library));
  setSyncText(wsReady ? "正在同步" : "本地保存", wsReady ? "connected" : "offline");
  saveTimer = window.setTimeout(() => setSyncText(wsReady ? "已同步" : "本地已保存", wsReady ? "connected" : "offline"), 450);
  channel?.postMessage({ type: "library", clientId, library, reason });
  sendWs({ type: "state", clientId, roomId, state: library, reason });
}

function connectRealtime() {
  if (location.protocol === "file:") {
    setSyncText("本地模式", "offline");
    return;
  }

  const syncUrl = buildSyncUrl();
  if (!syncUrl) {
    setSyncText("本地保存", "offline");
    return;
  }

  ws = new WebSocket(syncUrl);
  setSyncText("连接中", "offline");

  ws.addEventListener("open", () => {
    wsReady = true;
    setSyncText("已同步", "connected");
    sendWs({ type: "join", clientId, roomId, name: localStorage.getItem(localNameKey) || "我", state: library });
    announcePresence();
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.clientId === clientId) return;
    if (message.type === "state" && message.state) {
      applyRemoteState(message.state, message.clientId === "server" ? "已载入房间行程单" : "协作者已更新", message.clientId === "server");
    }
    if (message.type === "presence") {
      members.set(message.clientId, { name: message.name || "同行者", clientId: message.clientId, at: Date.now() });
      renderMembers();
    }
    if (message.type === "members") {
      members = new Map(message.members.map((member) => [member.clientId, { ...member, at: Date.now() }]));
      renderMembers();
    }
  });

  ws.addEventListener("error", () => {
    setSyncText("同步失败", "offline");
  });

  ws.addEventListener("close", () => {
    wsReady = false;
    setSyncText("离线保存", "offline");
    clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connectRealtime, 1800);
  });
}
function buildSyncUrl() {
  const configuredEndpoint = params.get("sync") || appConfig.syncEndpoint || "";
  const endpoint = configuredEndpoint.trim() || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/sync`;
  const url = normalizeSyncEndpoint(endpoint);
  if (!url) return "";
  url.searchParams.set("room", roomId);
  return url.toString();
}

function normalizeSyncEndpoint(endpoint) {
  try {
    const url = new URL(endpoint, location.href);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    return url;
  } catch {
    console.warn("Invalid sync endpoint", endpoint);
    return null;
  }
}
function applyRemoteState(nextData, message, force = false) {
  const nextLibrary = nextData?.lists ? normalizeLibrary(nextData) : wrapLegacyRemote(nextData);
  if (!nextLibrary?.lists?.length || (!force && nextLibrary.updatedAt < library.updatedAt)) return;
  applyingRemote = true;
  library = nextLibrary;
  state = getActiveTrip();
  selectedDayId = state.selectedDayId || state.days[0].id;
  localStorage.setItem(storageKey, JSON.stringify(library));
  applyingRemote = false;
  render();
  setSyncText("已同步", wsReady ? "connected" : "offline");
  showToast(message);
}

function sendWs(payload) {
  if (!wsReady || ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function announcePresence() {
  const name = localStorage.getItem(localNameKey) || "我";
  members.set(clientId, { name, clientId, at: Date.now() });
  renderMembers();
  sendWs({ type: "presence", clientId, roomId, name });
}

function setSyncText(text, mode) {
  els.syncText.textContent = text;
  els.syncState.classList.toggle("connected", mode === "connected");
  els.syncState.classList.toggle("offline", mode === "offline");
}

async function copyShareLink() {
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  try {
    await navigator.clipboard.writeText(url.toString());
    showToast("协作链接已复制");
  } catch {
    showToast(url.toString());
  }
}

function getActiveList() {
  return library.lists.find((list) => list.id === library.activeListId) || library.lists[0];
}

function getActiveTrip() {
  return getActiveList().trip;
}

function getSelectedDay() {
  return state.days.find((day) => day.id === selectedDayId);
}

function getDayDate(index) {
  const date = new Date(`${state.startDate}T00:00:00`);
  date.setDate(date.getDate() + index);
  return date;
}

function getTransportLabel(transport) {
  const type = transportTypes.find((item) => item.id === transport.type)?.label || "交通";
  const route = [transport.from, transport.to].filter(Boolean).join(" → ");
  const time = [transport.depart, transport.arrive].filter(Boolean).join("-");
  return [type, route, time].filter(Boolean).join(" · ");
}

function getTransportIcon(typeId) {
  return transportTypes.find((item) => item.id === typeId)?.icon || transportTypes[0].icon;
}

function ensureRoomParam() {
  if (params.get("room")) return;
  const url = new URL(location.href);
  url.searchParams.set("room", roomId);
  history.replaceState(null, "", url);
}

function ensureLocalMember() {
  if (!localStorage.getItem(localNameKey)) {
    localStorage.setItem(localNameKey, "我");
  }
}

function getClientId() {
  const storedClientId = localStorage.getItem(localClientIdKey);
  if (storedClientId) return storedClientId;
  const nextClientId = crypto.randomUUID();
  localStorage.setItem(localClientIdKey, nextClientId);
  return nextClientId;
}

function createRoomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function toDateInputValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}







