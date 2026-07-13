(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  const state = { text: "", fileName: "", busy: false };

  window.addEventListener("load", () => waitForQuickPlan(0));

  function waitForQuickPlan(attempt) {
    const panel = document.querySelector("#quickPlanPanel");
    if (panel && window.TripPlanner?.getLibrary) {
      installStyles();
      enhanceQuickPlan(panel);
      return;
    }
    if (attempt > 80) return;
    window.setTimeout(() => waitForQuickPlan(attempt + 1), 125);
  }

  function enhanceQuickPlan(panel) {
    const heading = panel.querySelector(".quick-plan-heading");
    if (!heading || heading.querySelector("[data-doc-import]")) return;

    const actions = document.createElement("span");
    actions.className = "quick-plan-actions";

    const importButton = document.createElement("button");
    importButton.className = "mini-action";
    importButton.type = "button";
    importButton.dataset.docImport = "1";
    importButton.textContent = "文档导入";
    importButton.title = "粘贴或上传文本/JSON/HTML，生成一个新的行程单";
    importButton.addEventListener("click", openImportDialog);

    const toggleButton = document.createElement("button");
    toggleButton.className = "mini-action";
    toggleButton.type = "button";
    toggleButton.dataset.quickCollapse = "1";
    toggleButton.addEventListener("click", () => setCollapsed(panel, !panel.classList.contains("is-collapsed"), toggleButton));

    actions.append(importButton, toggleButton);
    heading.append(actions);
    setCollapsed(panel, localStorage.getItem(collapseKey()) === "1", toggleButton);
  }

  function setCollapsed(panel, collapsed, button) {
    panel.classList.toggle("is-collapsed", collapsed);
    localStorage.setItem(collapseKey(), collapsed ? "1" : "0");
    if (button) button.textContent = collapsed ? "展开" : "收起";
  }

  function collapseKey() {
    return `trip-designer:quick-plan-collapsed:${roomId}`;
  }

  function openImportDialog() {
    closeImportDialog();
    const overlay = document.createElement("div");
    overlay.className = "doc-import-overlay";
    overlay.dataset.docImportDialog = "1";
    overlay.innerHTML = `
      <section class="doc-import-dialog" role="dialog" aria-modal="true" aria-label="文档导入行程">
        <div class="doc-import-head">
          <div>
            <p class="eyeline">导入</p>
            <h2>从文档生成新行程单</h2>
          </div>
          <button class="icon-button" type="button" data-doc-close aria-label="关闭">×</button>
        </div>
        <label class="field">
          <span>上传文件</span>
          <input type="file" data-doc-file accept=".txt,.md,.json,.html,.htm,.csv" />
        </label>
        <label class="field">
          <span>或粘贴行程文本</span>
          <textarea data-doc-text rows="10" placeholder="例如：第1天 东京\n09:00 浅草寺\n12:30 午餐 银座\n住宿：新宿酒店\n第2天 京都\n10:00 清水寺"></textarea>
        </label>
        <div class="doc-import-status" data-doc-status>导入会生成一个新的 list，不会覆盖当前行程。</div>
        <div class="doc-import-actions">
          <button class="ghost-action" type="button" data-doc-close>取消</button>
          <button class="primary-action" type="button" data-doc-submit>一键生成</button>
        </div>
      </section>
    `;
    document.body.append(overlay);
    overlay.querySelector("[data-doc-close]")?.addEventListener("click", closeImportDialog);
    overlay.querySelectorAll("[data-doc-close]").forEach((button) => button.addEventListener("click", closeImportDialog));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeImportDialog(); });
    overlay.querySelector("[data-doc-submit]")?.addEventListener("click", submitImport);
    overlay.querySelector("[data-doc-file]")?.addEventListener("change", readImportFile);
    overlay.querySelector("[data-doc-text]")?.focus();
  }

  function closeImportDialog() {
    document.querySelector("[data-doc-import-dialog]")?.remove();
  }

  function setStatus(text) {
    const node = document.querySelector("[data-doc-status]");
    if (node) node.textContent = text;
  }

  async function readImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    state.fileName = file.name;
    setStatus("正在读取文件...");
    try {
      state.text = await file.text();
      const textarea = document.querySelector("[data-doc-text]");
      if (textarea) textarea.value = state.text;
      setStatus(`已读取 ${file.name}，点击一键生成。`);
    } catch (error) {
      setStatus(`读取失败：${error.message}`);
    }
  }

  async function submitImport() {
    if (state.busy) return;
    const textarea = document.querySelector("[data-doc-text]");
    const text = String(textarea?.value || state.text || "").trim();
    if (!text) {
      setStatus("请先上传文件或粘贴行程文本。");
      textarea?.focus();
      return;
    }

    state.busy = true;
    setStatus("正在解析文档...");
    try {
      const list = await buildImportedList(text, state.fileName);
      appendImportedList(list);
      closeImportDialog();
      showToast(`已导入：${list.name}`);
    } catch (error) {
      setStatus(error.message || "导入失败，请检查文本格式。");
    } finally {
      state.busy = false;
    }
  }

  async function buildImportedList(text, fileName) {
    const exported = tryParseExport(text, fileName);
    if (exported) return remapList(exported, `导入 - ${exported.name || fileName || "行程"}`);

    const aiList = await tryDeepSeekImport(text, fileName);
    if (aiList?.trip?.days?.length) return aiList;

    const parsed = parsePlainTextItinerary(text, fileName);
    if (!parsed?.trip?.days?.length) throw new Error("没有识别到可导入的行程内容。");
    return parsed;
  }

  function tryParseExport(text, fileName) {
    const jsonText = extractJsonPayload(text);
    if (!jsonText) return null;
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed?.trip?.days?.length) return parsed;
      if (parsed?.list?.trip?.days?.length) return parsed.list;
      if (Array.isArray(parsed?.lists) && parsed.lists[0]?.trip?.days?.length) return parsed.lists[0];
      if (Array.isArray(parsed?.days)) return { name: fileName || parsed.tripTitle || "导入行程", trip: parsed };
    } catch {}
    return null;
  }

  function extractJsonPayload(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
    const scriptMatch = trimmed.match(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) return decodeHtml(scriptMatch[1].trim());
    const preMatch = trimmed.match(/<pre[^>]*data-trip-json[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) return decodeHtml(preMatch[1].trim());
    return "";
  }

  async function tryDeepSeekImport(text, fileName) {
    setStatus("正在尝试使用 DeepSeek 整理文档...");
    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip: { tripTitle: fileName || "文档导入", originCity: "" },
          day: { location: "", stay: "", activities: [{ title: "待解析文档", note: text.slice(0, 12000) }] },
          target: { type: "document-import", field: "full-itinerary", activity: { note: text.slice(0, 12000) } },
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok || !Array.isArray(json.recommendations) || !json.recommendations.length) return null;
      const stamp = Date.now();
      const firstDay = makeDay("", "", json.recommendations.map((item) => makeActivity(item, stamp)), stamp);
      return makeList(`AI导入 - ${fileName || firstTitle(text) || "行程"}`, [firstDay], stamp);
    } catch {
      return null;
    }
  }

  function parsePlainTextItinerary(text, fileName) {
    const stamp = Date.now();
    const lines = String(text || "").replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
    const segmentDays = parseCityDaySegments(lines.join("\n"));
    if (segmentDays.length) return makeList(`导入 - ${fileName || firstTitle(text) || "行程"}`, segmentDays, stamp);

    const days = [];
    let current = null;
    for (const line of lines) {
      const dayHeader = line.match(/^(?:第\s*)?(\d{1,2})\s*(?:天|日|day)\b\s*[:：-]?\s*(.*)$/i) || line.match(/^(\d{1,2})[./-](\d{1,2})(?:\s+|\s*[:：-]\s*)(.*)$/);
      if (dayHeader) {
        current = makeDay(cleanLocation(dayHeader[2] ? dayHeader[3] || dayHeader[2] : dayHeader[2] || ""), "", [], stamp);
        days.push(current);
        continue;
      }
      if (!current) {
        current = makeDay("", "", [], stamp);
        days.push(current);
      }
      const stay = line.match(/^(?:住宿|酒店|住处|hotel)\s*[:：-]?\s*(.+)$/i);
      if (stay) { current.stay = stay[1].trim(); continue; }
      const city = line.match(/^(?:城市|地点|目的地|city|place)\s*[:：-]?\s*(.+)$/i);
      if (city) { current.location = cleanLocation(city[1]); continue; }
      const activity = parseActivityLine(line, stamp);
      if (activity) current.activities.push(activity);
    }
    if (days.length === 1 && !days[0].activities.length && !days[0].location && !days[0].stay) return null;
    return makeList(`导入 - ${fileName || firstTitle(text) || "行程"}`, days, stamp);
  }

  function parseCityDaySegments(text) {
    const compact = String(text || "").replace(/\s+/g, " ").trim();
    if (!/\d+\s*(天|日|days?|d)\b/i.test(compact)) return [];
    const pieces = compact.split(/[，,；;、\n]+/).map((item) => item.trim()).filter(Boolean);
    const days = [];
    const stamp = Date.now();
    for (const piece of pieces) {
      const match = piece.match(/^(.+?)(\d{1,2})\s*(?:天|日|days?|d)$/i);
      if (!match) return [];
      const city = cleanLocation(match[1]);
      const count = Math.max(1, Math.min(60, Number(match[2]) || 1));
      for (let index = 0; index < count; index += 1) days.push(makeDay(city, "", [], stamp));
    }
    return days;
  }

  function parseActivityLine(line, stamp) {
    const timeMatch = line.match(/^(\d{1,2})[:：](\d{2})\s*(.+)$/);
    let time = "";
    let rest = line;
    if (timeMatch) {
      time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
      rest = timeMatch[3].trim();
    }
    const budgetMatch = rest.match(/(?:预算|费用|花费|cost|budget)\s*[:：]?\s*([¥￥€$]?\s*\d+(?:\.\d+)?)/i);
    const placeParts = rest.split(/\s+[@＠]\s+|\s+-\s+|\s+—\s+/).map((part) => part.trim()).filter(Boolean);
    const title = placeParts[0] || rest;
    const place = placeParts.length > 1 ? placeParts.slice(1).join(" ") : "";
    if (!title) return null;
    const activity = makeActivity({ time, title, place, note: budgetMatch ? `预算 ${budgetMatch[1].trim()}` : "" }, stamp);
    const budget = parseBudget(budgetMatch?.[1] || "");
    if (budget) activity.budget = budget;
    return activity;
  }

  function appendImportedList(list) {
    const library = window.TripPlanner?.getLibrary?.();
    if (!library?.lists) throw new Error("行程数据还在加载，请稍后再试。");
    library.lists.push(list);
    library.activeListId = list.id;
    window.TripPlanner.saveExternalLibrary(library, "document-import");
  }

  function remapList(source, fallbackName) {
    const stamp = Date.now();
    const days = (source.trip?.days || []).map((day) => makeDay(day.location || "", day.stay || "", (day.activities || []).map((activity) => makeActivity(activity, stamp)), stamp));
    return makeList(fallbackName, days, stamp);
  }

  function makeList(name, days, stamp) {
    const cleanName = String(name || "导入行程").replace(/^(导入 -\s*)+/, "导入 - ").slice(0, 80);
    const safeDays = days?.length ? days : [makeDay("", "", [], stamp)];
    return {
      id: crypto.randomUUID(),
      name: cleanName,
      createdAt: stamp,
      updatedAt: stamp,
      trip: {
        version: 1,
        tripTitle: cleanName,
        startDate: new Date(stamp).toISOString().slice(0, 10),
        originCity: "",
        selectedDayId: safeDays[0].id,
        dayLimit: Math.max(30, safeDays.length),
        updatedAt: stamp,
        orderUpdatedAt: stamp,
        budget: { currency: "CNY", items: {}, limit: 0, updatedAt: stamp },
        days: safeDays,
      },
    };
  }

  function makeDay(location, stay, activities, stamp) {
    return { id: crypto.randomUUID(), location: cleanLocation(location), stay: String(stay || "").trim(), activities: activities || [], updatedAt: stamp, orderUpdatedAt: stamp };
  }

  function makeActivity(item, stamp) {
    const transport = item.transport && typeof item.transport === "object" ? item.transport : null;
    return {
      id: crypto.randomUUID(),
      time: String(item.time || item.suggestedTime || "").slice(0, 5),
      title: String(item.title || item.name || "未命名事项").trim() || "未命名事项",
      place: String(item.place || item.area || "").trim(),
      note: String(item.note || item.reason || "").trim(),
      tags: Array.isArray(item.tags) ? item.tags : [],
      done: false,
      budget: item.budget || null,
      transport,
      updatedAt: stamp,
    };
  }

  function parseBudget(value) {
    const text = String(value || "").replace(/\s+/g, "");
    const match = text.match(/^([¥￥€$]?)(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const currency = match[1] === "€" ? "EUR" : match[1] === "$" ? "USD" : "CNY";
    return { amount: Number(match[2]), currency, category: "other" };
  }

  function cleanLocation(value) {
    return String(value || "").replace(/^(城市|地点|目的地)\s*[:：-]?\s*/i, "").trim();
  }

  function firstTitle(text) {
    return String(text || "").split(/\n/).map((line) => line.trim()).find(Boolean)?.slice(0, 24) || "";
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  function showToast(text) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function installStyles() {
    if (document.querySelector("#documentImportStyles")) return;
    const style = document.createElement("style");
    style.id = "documentImportStyles";
    style.textContent = `
      .quick-plan-actions{display:inline-flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap}.quick-plan-panel.is-collapsed .quick-plan-form,.quick-plan-panel.is-collapsed .quick-plan-batch,.quick-plan-panel.is-collapsed .quick-segment-list{display:none}.doc-import-overlay{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:18px;background:rgba(23,33,31,.28);backdrop-filter:blur(6px)}.doc-import-dialog{width:min(620px,calc(100vw - 28px));max-height:calc(100vh - 36px);overflow:auto;display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 28px 80px rgba(23,33,31,.18)}.doc-import-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.doc-import-head h2{margin:0;font-size:22px}.doc-import-dialog textarea{width:100%;min-height:220px;resize:vertical}.doc-import-status{padding:10px 12px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-weight:760;background:#fbfffd}.doc-import-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}@media(max-width:780px){.quick-plan-actions{width:100%;justify-content:flex-start}.doc-import-overlay{align-items:end;padding:0}.doc-import-dialog{width:100%;max-height:88vh;border-radius:18px 18px 0 0}.doc-import-dialog textarea{min-height:180px}}
    `;
    document.head.append(style);
  }
})();
