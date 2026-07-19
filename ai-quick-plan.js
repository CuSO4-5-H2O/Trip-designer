(() => {
  "use strict";

  let installed = false;
  let pendingPlan = null;
  let pendingMeta = null;
  let installTimer = 0;
  let installAttempts = 0;

  function init() {
    installStyles();
    scheduleInstall(0);
  }

  function scheduleInstall(delay = 120) {
    clearTimeout(installTimer);
    installTimer = window.setTimeout(() => {
      if (installPanel()) return;
      installAttempts += 1;
      if (installAttempts < 80) scheduleInstall(Math.min(600, 120 + installAttempts * 20));
    }, delay);
  }

  function installPanel() {
    if (installed) return true;
    const panel = document.querySelector(".ai-panel");
    if (!panel) return false;
    installed = true;
    const box = document.createElement("section");
    box.className = "ai-quick-plan";
    box.innerHTML = `
      <div class="ai-quick-head">
        <strong>文本快速添加</strong>
        <span>输入自然语言，AI 会生成天数和事项；确认后才写入当前 list</span>
      </div>
      <textarea id="aiQuickPlanText" rows="4" placeholder="例如：在内罗毕玩3天，第一天抵达并逛市区，第二天去基贝拉贫民窟和博物馆，第三天去长颈鹿中心后出发去马赛马拉"></textarea>
      <div class="ai-quick-actions">
        <button class="mini-action" id="aiQuickGenerate" type="button">生成行程</button>
        <button class="mini-action muted" id="aiQuickApply" type="button" disabled>应用到当前 list</button>
      </div>
      <div class="ai-quick-status" id="aiQuickStatus">生成后会先预览，不会自动覆盖已有行程。</div>
      <div class="ai-quick-preview" id="aiQuickPreview"></div>`;
    const status = panel.querySelector(".ai-status") || panel.lastElementChild;
    panel.insertBefore(box, status || null);
    box.querySelector("#aiQuickGenerate").onclick = generatePlan;
    box.querySelector("#aiQuickApply").onclick = applyPlan;
    return true;
  }

  async function generatePlan() {
    const text = document.querySelector("#aiQuickPlanText")?.value.trim() || "";
    const apply = document.querySelector("#aiQuickApply");
    const preview = document.querySelector("#aiQuickPreview");
    pendingPlan = null;
    pendingMeta = null;
    apply.disabled = true;
    preview.replaceChildren();
    if (!text) return setStatus("请先输入行程文本");
    setStatus("正在解析行程...");
    try {
      const library = window.TripPlanner?.getLibrary?.();
      const list = activeList(library);
      const response = await fetch("/api/ai/quick-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, trip: list?.trip || {} }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || data.detail || "解析失败");
      pendingPlan = data.plan;
      pendingMeta = { source: data.source || "", warning: data.warning || "", expectedDays: data.hints?.expectedDays || data.plan?.days?.length || 0 };
      renderPreview(pendingPlan, pendingMeta);
      apply.disabled = false;
      const sourceText = pendingMeta.source === "deepseek" ? "DeepSeek" : "规则解析";
      setStatus(`已生成 ${pendingPlan.days.length} 天（${sourceText}），确认后应用到当前 list`);
    } catch (error) {
      setStatus(error.message || "解析失败，请重试");
    }
  }

  function renderPreview(plan, meta = {}) {
    const preview = document.querySelector("#aiQuickPreview");
    const items = [];
    if (meta.warning) {
      const warning = document.createElement("article");
      warning.className = "ai-quick-day ai-quick-warning";
      warning.innerHTML = `<strong>已使用备用解析</strong><span>${escapeHtml(meta.warning)}</span>`;
      items.push(warning);
    }
    items.push(...plan.days.map((day, index) => {
      const item = document.createElement("article");
      item.className = "ai-quick-day";
      const titles = (day.activities || []).map((activity) => activity.title).filter(Boolean).slice(0, 6).join("、");
      item.innerHTML = `<strong>第 ${index + 1} 天 · ${escapeHtml(day.location || "未填写地点")}</strong><span>${escapeHtml(titles || "暂无事项")}</span>`;
      return item;
    }));
    preview.replaceChildren(...items);
  }

  async function applyPlan() {
    if (!pendingPlan) return;
    const library = window.TripPlanner?.getLibrary?.();
    const list = activeList(library);
    const trip = list?.trip;
    if (!library || !list || !trip) return setStatus("行程还没有加载完成");
    const stamp = Date.now();
    const hasOnlyBlankDay = trip.days.length === 1 && !trip.days[0].location && !trip.days[0].stay && !(trip.days[0].activities || []).length;
    const generatedDays = pendingPlan.days.map((day) => makeDay(day, stamp));
    if (hasOnlyBlankDay) trip.days = generatedDays;
    else trip.days.push(...generatedDays);
    trip.selectedDayId = generatedDays[0]?.id || trip.selectedDayId;
    trip.dayLimit = Math.max(Number(trip.dayLimit) || 30, trip.days.length);
    if (pendingPlan.title && (!trip.tripTitle || /^新行程单/.test(trip.tripTitle))) {
      trip.tripTitle = pendingPlan.title;
      list.name = pendingPlan.title;
    }
    if (pendingPlan.originCity && !trip.originCity) trip.originCity = pendingPlan.originCity;
    trip.updatedAt = stamp;
    trip.orderUpdatedAt = stamp;
    list.updatedAt = stamp;
    library.updatedAt = stamp;
    window.TripPlanner?.saveExternalLibrary?.(library, "ai-quick-plan-apply");
    setStatus(`已应用 ${generatedDays.length} 天，正在保存到云端...`);
    pendingPlan = null;
    pendingMeta = null;
    const apply = document.querySelector("#aiQuickApply");
    if (apply) apply.disabled = true;
    try {
      if (typeof window.TripDesignerFlushSync === "function") {
        const ok = await window.TripDesignerFlushSync("ai-quick-plan-apply-manual");
        if (ok === false) {
          setStatus("已应用到页面，本地待同步；点击同步条可重试");
        } else {
          markCloudSaved();
          window.setTimeout(markCloudSaved, 250);
          window.setTimeout(markCloudSaved, 900);
          setStatus(`已应用 ${generatedDays.length} 天并保存到云端`);
        }
      } else {
        setStatus(`已应用 ${generatedDays.length} 天，本地待同步`);
      }
    } catch {
      setStatus("已应用到页面，本地待同步；点击同步条可重试");
    }
  }

  function makeDay(day, stamp) {
    return {
      id: crypto.randomUUID(),
      location: day.location || "",
      stay: day.stay || "",
      activities: (day.activities || []).map((activity) => makeActivity(activity, stamp)),
      updatedAt: stamp,
      orderUpdatedAt: stamp,
    };
  }

  function makeActivity(activity, stamp) {
    return {
      id: crypto.randomUUID(),
      time: activity.time || "",
      title: activity.title || "待安排事项",
      place: activity.place || "",
      note: activity.note || "",
      tags: [],
      done: false,
      budget: activity.budget || null,
      transport: normalizeTransport(activity.transport),
      updatedAt: stamp,
    };
  }

  function normalizeTransport(value) {
    if (!value || typeof value !== "object") return null;
    const type = ["plane", "train", "bus", "boat", "car"].includes(value.type) ? value.type : "";
    const transport = { type, from: value.from || "", to: value.to || "", depart: value.depart || "", arrive: value.arrive || "" };
    return Object.values(transport).some(Boolean) ? transport : null;
  }

  function activeList(library) {
    return library?.lists?.find((list) => list.id === library.activeListId) || library?.lists?.[0];
  }

  function markCloudSaved() {
    const roomId = new URLSearchParams(location.search).get("room") || window.TripRoom?.id || "";
    if (roomId) window.__TripPendingLocalSave = { roomId, at: Date.now(), pending: false };
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (syncText) syncText.textContent = "已保存到云端";
    syncState?.classList.remove("offline", "mobile-sync-pending");
    syncState?.classList.add("connected");
  }

  function setStatus(text) {
    const status = document.querySelector("#aiQuickStatus");
    if (status) status.textContent = text;
  }

  function installStyles() {
    if (document.querySelector("#aiQuickPlanStyles")) return;
    const style = document.createElement("style");
    style.id = "aiQuickPlanStyles";
    style.textContent = `
      .ai-quick-plan{display:grid;gap:10px;margin:12px 0;padding:12px;border:1px solid #cfe3de;border-radius:12px;background:#f8fbfa}.ai-quick-head{display:grid;gap:3px}.ai-quick-head strong{font-size:16px}.ai-quick-head span,.ai-quick-status{color:#64736f;font-weight:700;font-size:13px}.ai-quick-plan textarea{width:100%;resize:vertical;min-height:96px;border:1px solid #cfe3de;border-radius:10px;padding:10px 12px;font:inherit;line-height:1.5}.ai-quick-actions{display:flex;gap:8px;flex-wrap:wrap}.ai-quick-preview{display:grid;gap:8px;max-height:240px;overflow:auto}.ai-quick-day{display:grid;gap:4px;padding:9px 10px;border:1px solid #e2ece9;border-radius:10px;background:#fff}.ai-quick-day span{color:#64736f;font-size:13px;line-height:1.4}.ai-quick-warning{border-color:#ffd8c2;background:#fff8f4}.ai-quick-warning strong{color:#b63a28}`;
    document.head.append(style);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
