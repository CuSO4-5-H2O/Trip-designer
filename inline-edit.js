(() => {
  let editingActivityId = null;

  function getTransportTypeIds(transport) {
    if (Array.isArray(transport?.types)) return transport.types;
    return transport?.type ? [transport.type] : [];
  }

  function saveActivityEdit(dayId, activityId, editor) {
    const day = state.days.find((item) => item.id === dayId);
    const activity = day?.activities.find((item) => item.id === activityId);
    if (!activity) return;

    const time = editor.querySelector('[data-field="time"]').value;
    const title = editor.querySelector('[data-field="title"]').value.trim();
    const place = editor.querySelector('[data-field="place"]').value.trim();
    const note = editor.querySelector('[data-field="note"]').value.trim();
    if (!title) {
      showToast("事项标题不能为空");
      return;
    }

    Object.assign(activity, { time, title, place, note });
    editingActivityId = null;
    persistAndBroadcast("edit-activity");
    render();
    showToast("事项已更新");
  }

  function startActivityEdit(row, dayId, activity) {
    editingActivityId = activity.id;
    row.replaceChildren();
    row.classList.add("editing");

    const editor = document.createElement("div");
    editor.className = "activity-inline-editor";
    editor.innerHTML = `
      <input data-field="time" type="time" value="${escapeHtml(activity.time || "")}" aria-label="事项时间" />
      <input data-field="title" type="text" value="${escapeHtml(activity.title || "")}" aria-label="事项标题" />
      <input data-field="place" type="text" value="${escapeHtml(activity.place || "")}" aria-label="事项地点" />
      <textarea data-field="note" rows="2" aria-label="事项备注">${escapeHtml(activity.note || "")}</textarea>
      <div class="inline-edit-actions">
        <button class="inline-edit-save" type="button">保存</button>
        <button class="inline-edit-cancel" type="button">取消</button>
      </div>
    `;

    editor.querySelector(".inline-edit-save").addEventListener("click", () => saveActivityEdit(dayId, activity.id, editor));
    editor.querySelector(".inline-edit-cancel").addEventListener("click", () => {
      editingActivityId = null;
      render();
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        editingActivityId = null;
        render();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        saveActivityEdit(dayId, activity.id, editor);
      }
    });

    row.append(editor);
    editor.querySelector('[data-field="title"]').focus();
  }

  createActivityRow = function createEditableActivityRow(dayId, activity) {
    const row = document.createElement("div");
    row.className = "activity-row";

    if (editingActivityId === activity.id) {
      startActivityEdit(row, dayId, activity);
      return row;
    }

    row.innerHTML = `
      <span class="activity-time">${escapeHtml(activity.time || "")}</span>
      <span class="activity-body editable" role="button" tabindex="0" title="点击编辑">
        <strong>${escapeHtml(activity.title)}</strong>
        ${activity.place ? `<span>${escapeHtml(activity.place)}</span>` : ""}
        ${activity.note ? `<p>${escapeHtml(activity.note)}</p>` : ""}
      </span>
      <button class="remove-activity" type="button" aria-label="删除事项" title="删除事项">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" /></svg>
      </button>
    `;

    const body = row.querySelector(".activity-body");
    const openEditor = (event) => {
      event.stopPropagation();
      selectedDayId = dayId;
      state.selectedDayId = dayId;
      startActivityEdit(row, dayId, activity);
    };
    body.addEventListener("click", openEditor);
    body.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openEditor(event);
    });

    row.querySelector(".remove-activity").addEventListener("click", (event) => {
      event.stopPropagation();
      const day = state.days.find((item) => item.id === dayId);
      day.activities = day.activities.filter((item) => item.id !== activity.id);
      persistAndBroadcast("delete-activity");
      render();
    });
    return row;
  };

  function createTransportPicker(day) {
    const wrap = document.createElement("span");
    wrap.className = "transport-add-wrap";

    const trigger = document.createElement("button");
    trigger.className = "transport-add-button";
    trigger.type = "button";
    trigger.title = "添加交通工具";
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>';

    const menu = document.createElement("div");
    menu.className = "transport-add-menu";
    menu.hidden = true;

    const selected = new Set(getTransportTypeIds(day.transport));
    transportTypes.forEach((type) => {
      const option = document.createElement("button");
      option.className = "transport-add-option";
      option.classList.toggle("active", selected.has(type.id));
      option.type = "button";
      option.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${type.icon}" /></svg><span>${type.label}</span>`;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        const next = new Set(getTransportTypeIds(day.transport));
        next.has(type.id) ? next.delete(type.id) : next.add(type.id);
        day.transport = {
          ...(day.transport || {}),
          types: [...next],
          type: [...next][0] || "",
        };
        persistAndBroadcast("toggle-transport");
        render();
      });
      menu.append(option);
    });

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      document.querySelectorAll(".transport-add-menu").forEach((item) => { item.hidden = true; });
      document.querySelectorAll(".transport-add-button").forEach((item) => item.setAttribute("aria-expanded", "false"));
      menu.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    wrap.append(trigger, menu);
    return wrap;
  }

  const previousRenderDays = renderDays;
  renderDays = function renderDaysWithInlineControls() {
    previousRenderDays();
    state.days.forEach((day, index) => {
      const card = els.dayList.children[index];
      const meta = card?.querySelector(".day-meta");
      if (!meta) return;
      meta.append(createTransportPicker(day));
    });
  };

  document.addEventListener("click", () => {
    document.querySelectorAll(".transport-add-menu").forEach((item) => { item.hidden = true; });
    document.querySelectorAll(".transport-add-button").forEach((item) => item.setAttribute("aria-expanded", "false"));
  });

  render();
})();
