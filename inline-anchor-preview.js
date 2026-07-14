(() => {
  "use strict";

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    updateFromTarget(event.target);
  }, true);

  document.addEventListener("focusout", (event) => {
    updateFromTarget(event.target);
  }, true);

  function updateFromTarget(target) {
    const input = target?.closest?.(".inline-activity-input");
    if (!input) return;
    const editor = input.closest(".inline-compound-editor") || input;
    const anchor = editor.previousElementSibling;
    if (!anchor) return;

    const field = input.dataset.inlineEditor || input.dataset.inlineDayEditor || anchor.dataset.selectField || anchor.dataset.dayField || "";
    if (editor.classList.contains("inline-budget-editor")) {
      const amount = Number(editor.querySelector(".budget-amount")?.value || 0) || 0;
      const currency = editor.querySelector(".budget-currency")?.value || "CNY";
      anchor.textContent = amount ? `预算 ${currency} ${amount}` : "预算";
      return;
    }
    if (editor.classList.contains("inline-transport-editor")) {
      const type = editor.querySelector(".transport-type")?.selectedOptions?.[0]?.textContent || "车";
      const from = editor.querySelector(".transport-from")?.value?.trim() || "";
      const to = editor.querySelector(".transport-to")?.value?.trim() || "";
      anchor.textContent = [type, [from, to].filter(Boolean).join(" → ")].filter(Boolean).join(" · ") || "添加交通";
      return;
    }

    const value = input.value.trim();
    if (field === "time") anchor.textContent = value;
    else if (field === "title") anchor.textContent = value || "新事项";
    else if (field === "place") anchor.textContent = value || "地点";
    else if (field === "note") anchor.textContent = value || "描述";
    else if (field === "location") anchor.textContent = `城市 ${value || "未填写地点"}`;
    else if (field === "stay") anchor.textContent = `住宿 ${value || "未填写"}`;
  }
})();
