(() => {
  const validTypeIds = new Set(transportTypes.map((item) => item.id));

  function getTransportTypes(transport) {
    const raw = Array.isArray(transport?.types)
      ? transport.types
      : transport?.type
        ? [transport.type]
        : [];
    return [...new Set(raw.filter((typeId) => validTypeIds.has(typeId)))];
  }

  function normalizeTransport(transport = {}) {
    const types = getTransportTypes(transport);
    return {
      ...transport,
      types,
      type: types[0] || "",
      from: transport.from || "",
      to: transport.to || "",
      depart: transport.depart || "",
      arrive: transport.arrive || "",
    };
  }

  function normalizeAllTransportData() {
    library.lists.forEach((list) => {
      list.trip.days.forEach((day) => {
        day.transport = normalizeTransport(day.transport);
      });
    });
  }

  function toggleDayTransport(dayId, typeId) {
    const day = state.days.find((item) => item.id === dayId);
    if (!day) return;

    selectedDayId = dayId;
    state.selectedDayId = dayId;
    const selected = getTransportTypes(day.transport);
    const next = selected.includes(typeId)
      ? selected.filter((item) => item !== typeId)
      : [...selected, typeId];

    day.transport = {
      ...normalizeTransport(day.transport),
      types: next,
      type: next[0] || "",
    };
    persistAndBroadcast("toggle-transport");
    render();
  }

  function createTransportButton(day, type) {
    const button = document.createElement("button");
    const route = [day.transport.from, day.transport.to].filter(Boolean).join(" → ");
    const time = [day.transport.depart, day.transport.arrive].filter(Boolean).join("-");
    button.className = "transport-chip transport-chip-button active";
    button.type = "button";
    button.title = `点击取消${type.label}`;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${type.icon}" /></svg><span>${escapeHtml([type.label, route, time].filter(Boolean).join(" · "))}</span>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDayTransport(day.id, type.id);
    });
    return button;
  }

  function createEmptyTransportButton(day) {
    const button = document.createElement("button");
    button.className = "transport-chip transport-chip-button empty";
    button.type = "button";
    button.title = "点击后在右侧选择交通工具";
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg><span>添加交通</span>`;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedDayId = day.id;
      state.selectedDayId = day.id;
      persistAndBroadcast("selection");
      render();
      document.querySelector(".transport-editor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return button;
  }

  renderStats = function renderStatsMulti() {
    const activityTotal = state.days.reduce((total, day) => total + day.activities.length, 0);
    const stayTotal = state.days.filter((day) => day.stay.trim()).length;
    els.dayCount.textContent = `${state.days.length} 天`;
    els.activityCount.textContent = activityTotal;
    els.stayCount.textContent = stayTotal;

    const counts = transportTypes.map((type) => ({
      ...type,
      count: state.days.filter((day) => getTransportTypes(day.transport).includes(type.id)).length,
    }));
    els.transportSummary.replaceChildren(
      ...counts
        .filter((type) => type.count > 0)
        .map((type) => createPill(`${type.label} ${type.count}`, "transport-chip", type.icon)),
    );
  };

  renderDays = function renderDaysMulti() {
    const fragment = document.createDocumentFragment();
    state.days.forEach((day, index) => {
      day.transport = normalizeTransport(day.transport);
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
        createPill(day.location || "未填写地点", "meta-pill", "M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z M12 10.5h.01"),
        createPill(day.stay || "未填写住宿", "meta-pill", "M4 20V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12M4 12h16M8 12V9h8v3"),
      );

      const selectedTypes = getTransportTypes(day.transport);
      if (selectedTypes.length === 0) {
        meta.append(createEmptyTransportButton(day));
      } else {
        selectedTypes.forEach((typeId) => {
          const type = transportTypes.find((item) => item.id === typeId);
          if (type) meta.append(createTransportButton(day, type));
        });
      }

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
  };

  renderDetail = function renderDetailMulti() {
    const day = getSelectedDay();
    const index = state.days.findIndex((item) => item.id === day?.id);
    els.deleteDayBtn.disabled = state.days.length <= 1;
    if (!day) return;

    day.transport = normalizeTransport(day.transport);
    els.detailLabel.textContent = `第 ${index + 1} 天 · ${weekdayFormatter.format(getDayDate(index))}`;
    els.detailLocation.value = day.location;
    els.detailStay.value = day.stay;
    els.transportFrom.value = day.transport.from || "";
    els.transportTo.value = day.transport.to || "";
    els.transportDepart.value = day.transport.depart || "";
    els.transportArrive.value = day.transport.arrive || "";

    const selectedTypes = getTransportTypes(day.transport);
    els.transportTabs.querySelectorAll(".transport-tab").forEach((button) => {
      const active = selectedTypes.includes(button.dataset.type);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  renderTransportTabs = function renderTransportTabsMulti() {
    els.transportTabs.replaceChildren(
      ...transportTypes.map((type) => {
        const button = document.createElement("button");
        button.className = "transport-tab";
        button.type = "button";
        button.dataset.type = type.id;
        button.setAttribute("aria-pressed", "false");
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${type.icon}" /></svg><span>${type.label}</span>`;
        button.addEventListener("click", () => {
          const day = getSelectedDay();
          if (day) toggleDayTransport(day.id, type.id);
        });
        return button;
      }),
    );
  };

  updateTransport = function updateTransportMulti(patch) {
    const day = getSelectedDay();
    if (!day) return;
    day.transport = { ...normalizeTransport(day.transport), ...patch };
    persistAndBroadcast("update-transport");
    render();
  };

  normalizeAllTransportData();
  renderTransportTabs();
  render();
})();
