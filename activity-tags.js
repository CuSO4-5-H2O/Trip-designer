(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room") || "LOCAL";
  const storageKey = `trip-planner-library:${roomId}`;
  const markerStart = "\u2063\u2063\u2063";
  const markerEnd = "\u2064\u2064\u2064";
  const zero = "\u200B";
  const one = "\u200C";
  const quickTags = ["预定", "待定", "已预定", "需购票"];
  const maxTags = 8;

  const dayList = document.querySelector("#dayList");
  const form = document.querySelector("#activityForm");
  const noteInput = document.querySelector("#activityNote");
  const cancelButton = document.querySelector("#cancelEditActivityBtn");
  const toast = document.querySelector("#toast");

  if (!dayList || !form || !noteInput) return;

  let activeRow = null;
  let toastTimer = 0;

  const popover = document.createElement("div");
  popover.className = "activity-tag-popover";
  popover.hidden = true;
  popover.innerHTML = `
    <div class="activity-tag-popover-head">
      <strong>添加标签</strong>
      <button type="button" class="activity-tag-popover-close" aria-label="关闭">×</button>
    </div>
    <div class="activity-tag-quick-list" role="group" aria-label="常用标签"></div>
    <form class="activity-tag-custom-form">
      <input type="text" maxlength="12" placeholder="自定义标签，例如：早鸟票" aria-label="自定义标签" />
      <button type="submit">添加</button>
    </form>
    <p>标签会随行程保存，并同步给同一房间的同行者。</p>
  `;
  document.body.append(popover);

  const quickList = popover.querySelector(".activity-tag-quick-list");
  const customForm = popover.querySelector(".activity-tag-custom-form");
  const customInput = customForm.querySelector("input");

  quickTags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `#${tag}`;
    button.dataset.tag = tag;
    button.addEventListener("click", () => addTagToActiveRow(tag));
    quickList.append(button);
  });

  popover.querySelector(".activity-tag-popover-close").addEventListener("click", closePopover);
  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const tag = normalizeTag(customInput.value);
    if (!tag) return;
    addTagToActiveRow(tag);
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest('[data-action="edit"], [data-action="transport"]');
    if (action) {
      const row = action.closest(".activity-row");
      if (row) prepareFormForVisibleEditing(row);
    }

    if (!popover.hidden && !popover.contains(event.target) && !event.target.closest(".activity-tag-add")) {
      closePopover();
    }
  });

  window.addEventListener("resize", () => {
    if (!popover.hidden && activeRow) positionPopover(activeRow.querySelector(".activity-tag-add"));
  });
  window.addEventListener("scroll", () => {
    if (!popover.hidden && activeRow) positionPopover(activeRow.querySelector(".activity-tag-add"));
  }, true);

  form.addEventListener("submit", () => {
    const tags = parseStoredTags(form.dataset.activityTags);
    noteInput.value = attachTags(stripTagPayload(noteInput.value).note, tags);
    window.setTimeout(clearFormTagState, 0);
  }, true);

  cancelButton?.addEventListener("click", () => window.setTimeout(clearFormTagState, 0));

  const observer = new MutationObserver(enhanceRows);
  observer.observe(dayList, { childList: true, subtree: true });
  enhanceRows();

  function enhanceRows() {
    dayList.querySelectorAll(".activity-row").forEach((row) => {
      if (row.querySelector(".activity-tag-strip")) return;
      const body = row.querySelector(".activity-body");
      if (!body) return;
      const strip = document.createElement("span");
      strip.className = "activity-tag-strip";
      body.append(strip);
      renderRowTags(row);
    });
  }

  function renderRowTags(row) {
    const strip = row.querySelector(".activity-tag-strip");
    if (!strip) return;
    const activity = getActivity(row.dataset.dayId, row.dataset.activityId);
    const tags = stripTagPayload(activity?.note || "").tags;
    strip.replaceChildren();

    tags.forEach((tag) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `activity-tag-chip ${getTagClass(tag)}`;
      chip.title = `移除 #${tag}`;
      chip.ariaLabel = `移除标签 ${tag}`;
      chip.innerHTML = `<span>#${escapeHtml(tag)}</span><b aria-hidden="true">×</b>`;
      chip.addEventListener("click", (event) => {
        event.stopPropagation();
        saveTagsThroughEditor(row, tags.filter((item) => item !== tag));
      });
      strip.append(chip);
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "activity-tag-add";
    addButton.textContent = tags.length ? "+" : "+ 标签";
    addButton.title = "添加事项标签";
    addButton.ariaLabel = "添加事项标签";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openPopover(row, addButton, tags);
    });
    strip.append(addButton);
  }

  function openPopover(row, anchor, tags) {
    activeRow = row;
    popover.hidden = false;
    popover.dataset.currentTags = JSON.stringify(tags);
    customInput.value = "";
    quickList.querySelectorAll("button").forEach((button) => {
      const selected = tags.includes(button.dataset.tag);
      button.disabled = selected;
      button.classList.toggle("selected", selected);
    });
    positionPopover(anchor);
    window.setTimeout(() => customInput.focus(), 0);
  }

  function positionPopover(anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    popover.style.width = `${width}px`;
    const preferredLeft = rect.left;
    const left = Math.max(12, Math.min(preferredLeft, window.innerWidth - width - 12));
    const estimatedHeight = 210;
    const below = rect.bottom + 8;
    const top = below + estimatedHeight <= window.innerHeight
      ? below
      : Math.max(12, rect.top - estimatedHeight - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function closePopover() {
    popover.hidden = true;
    activeRow = null;
  }

  function addTagToActiveRow(value) {
    if (!activeRow) return;
    const row = activeRow;
    const tag = normalizeTag(value);
    if (!tag) return;
    const current = parseStoredTags(popover.dataset.currentTags);
    if (current.includes(tag)) return;
    if (current.length >= maxTags) {
      showToast(`每条事项最多添加 ${maxTags} 个标签`);
      return;
    }
    closePopover();
    saveTagsThroughEditor(row, [...current, tag]);
  }

  function prepareFormForVisibleEditing(row) {
    afterAppFormFill(() => {
      const decoded = stripTagPayload(noteInput.value);
      noteInput.value = decoded.note;
      form.dataset.activityTags = JSON.stringify(decoded.tags);
      form.dataset.tagActivityId = row.dataset.activityId || "";
    });
  }

  function saveTagsThroughEditor(row, tags) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const editButton = row?.querySelector('[data-action="edit"]');
    if (!editButton) return;

    editButton.click();
    afterAppFormFill(() => {
      const decoded = stripTagPayload(noteInput.value);
      const normalizedTags = normalizeTags(tags);
      form.dataset.activityTags = JSON.stringify(normalizedTags);
      form.dataset.tagActivityId = row.dataset.activityId || "";
      noteInput.value = attachTags(decoded.note, normalizedTags);
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY);
        showToast(normalizedTags.length ? "标签已更新" : "标签已移除");
      });
    });
  }

  function afterAppFormFill(callback) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
  }

  function clearFormTagState() {
    delete form.dataset.activityTags;
    delete form.dataset.tagActivityId;
  }

  function getLibrary() {
    try {
      return JSON.parse(localStorage.getItem(storageKey));
    } catch {
      return null;
    }
  }

  function getActivity(dayId, activityId) {
    const library = getLibrary();
    if (!library?.lists?.length) return null;
    const list = library.lists.find((item) => item.id === library.activeListId) || library.lists[0];
    const day = list?.trip?.days?.find((item) => item.id === dayId);
    return day?.activities?.find((item) => item.id === activityId) || null;
  }

  function attachTags(note, tags) {
    const cleanNote = stripTagPayload(note).note;
    const normalizedTags = normalizeTags(tags);
    if (!normalizedTags.length) return cleanNote;
    return `${cleanNote}${encodeTagPayload(normalizedTags)}`;
  }

  function stripTagPayload(value) {
    const note = String(value || "");
    const start = note.indexOf(markerStart);
    const end = start >= 0 ? note.indexOf(markerEnd, start + markerStart.length) : -1;
    if (start < 0 || end < 0) return { note, tags: [] };
    const encoded = note.slice(start + markerStart.length, end);
    return {
      note: `${note.slice(0, start)}${note.slice(end + markerEnd.length)}`,
      tags: decodeTagPayload(encoded),
    };
  }

  function encodeTagPayload(tags) {
    const bytes = new TextEncoder().encode(JSON.stringify(tags));
    let bits = "";
    bytes.forEach((byte) => {
      bits += byte.toString(2).padStart(8, "0").replace(/0/g, zero).replace(/1/g, one);
    });
    return `${markerStart}${bits}${markerEnd}`;
  }

  function decodeTagPayload(encoded) {
    try {
      const binary = [...encoded].map((character) => character === one ? "1" : character === zero ? "0" : "").join("");
      if (!binary || binary.length % 8 !== 0) return [];
      const bytes = new Uint8Array(binary.length / 8);
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(binary.slice(index * 8, index * 8 + 8), 2);
      }
      return normalizeTags(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return [];
    }
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, maxTags);
  }

  function normalizeTag(value) {
    return [...String(value || "")
      .trim()
      .replace(/^#+/, "")
      .replace(/[\s,，;；]+/g, "")]
      .slice(0, 12)
      .join("");
  }

  function parseStoredTags(value) {
    try {
      return normalizeTags(JSON.parse(value || "[]"));
    } catch {
      return [];
    }
  }

  function getTagClass(tag) {
    if (tag === "预定") return "tag-reserve";
    if (tag === "待定") return "tag-pending";
    if (tag === "已预定") return "tag-booked";
    if (tag === "需购票") return "tag-ticket";
    return "tag-custom";
  }

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();