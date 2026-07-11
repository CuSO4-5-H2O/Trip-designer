(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const appConfig = window.TRIP_PLANNER_CONFIG || {};
  const roomId = params.get("room") || "LOCAL";
  const storageKey = `trip-planner-library:${roomId}`;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    const launcher = document.querySelector(".travel-tools-launcher");
    const backdrop = document.querySelector(".travel-tools-backdrop");
    const aiNode = document.querySelector("#aiRecommendations");
    const aiPanel = document.querySelector('[data-tool-panel="ai"]');
    if (!launcher || !backdrop || !aiNode || !aiPanel) return;

    injectStyles();
    const status = document.createElement("div");
    status.className = "ai-connection-state";
    status.textContent = "正在检查 DeepSeek 连接状态…";
    aiPanel.prepend(status);

    const aiLaunchButton = launcher.querySelector('[data-open-tool="ai"]');
    const launchDot = document.createElement("i");
    launchDot.className = "ai-connection-dot";
    launchDot.setAttribute("aria-hidden", "true");
    aiLaunchButton?.append(launchDot);

    refreshStatus(status, launchDot);

    const observer = new MutationObserver(() => enhanceRecommendationCards(aiNode, backdrop));
    observer.observe(aiNode, { childList: true, subtree: true });
    enhanceRecommendationCards(aiNode, backdrop);
  }

  async function refreshStatus(status, dot) {
    try {
      const response = await fetch("/api/ai-status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.configured) throw new Error("not configured");
      status.textContent = `DeepSeek 已连接 · ${data.model || "可用"}`;
      status.classList.add("connected");
      dot?.classList.add("connected");
    } catch {
      status.textContent = "DeepSeek 尚未连接，请检查 Render 的 DEEPSEEK_API_KEY 并重新部署。";
      status.classList.remove("connected");
      dot?.classList.remove("connected");
    }
  }

  function enhanceRecommendationCards(aiNode, backdrop) {
    const cards = aiNode.querySelectorAll(".ai-recommendation-card:not([data-actions-ready])");
    cards.forEach((card) => {
      card.dataset.actionsReady = "true";
      const recommendation = readRecommendationFromCard(card);
      if (!recommendation.name) return;

      const actions = document.createElement("div");
      actions.className = "ai-recommendation-actions";

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "ai-card-action primary";
      addButton.textContent = "加入当前日期";
      addButton.addEventListener("click", () => addRecommendation(recommendation, addButton));

      const mapButton = document.createElement("button");
      mapButton.type = "button";
      mapButton.className = "ai-card-action";
      mapButton.textContent = "查看当天地图";
      mapButton.addEventListener("click", () => openDayMap(backdrop));

      actions.append(addButton, mapButton);
      card.append(actions);
    });
  }

  function readRecommendationFromCard(card) {
    const name = card.querySelector("h3")?.textContent?.trim() || "";
    const paragraphs = [...card.querySelectorAll(":scope > p")].map((node) => node.textContent.trim());
    const reason = paragraphs.find((text) => text && !text.startsWith("提示：")) || "";
    const tips = paragraphs.find((text) => text.startsWith("提示："))?.replace(/^提示：/, "") || "";
    const tags = [...card.querySelectorAll(".ai-recommendation-meta span")]
      .map((node) => node.textContent.trim())
      .filter(Boolean);
    return {
      name,
      reason,
      tips,
      category: tags[0] || "",
      area: tags[1] || "",
      suggestedTime: tags[2] || "",
      duration: tags[3] || "",
    };
  }

  async function addRecommendation(recommendation, button) {
    const context = getSelectedDayContext();
    if (!context) {
      showNotice("共享行程仍在载入，请稍后再试");
      return;
    }

    button.disabled = true;
    button.textContent = "正在加入…";
    try {
      const activity = recommendationToActivity(recommendation);
      const result = await syncRoomMutation((library) => {
        const list = library.lists.find((item) => item.id === context.listId)
          || library.lists.find((item) => item.id === library.activeListId)
          || library.lists[0];
        const day = list?.trip?.days?.find((item) => item.id === context.dayId);
        if (!day) throw new Error("没有找到对应日期");

        const duplicate = day.activities.some((item) => {
          return normalizeKey(item.title) === normalizeKey(activity.title)
            && normalizeKey(item.place) === normalizeKey(activity.place);
        });
        if (duplicate) return { changed: false, message: "该推荐已经在行程中" };

        day.activities.push(activity);
        list.trip.selectedDayId = day.id;
        return { changed: true, message: `已加入第 ${context.dayIndex + 1} 天` };
      });

      button.textContent = result.message;
      if (!result.changed) button.disabled = false;
      showNotice(result.message);
    } catch (error) {
      button.disabled = false;
      button.textContent = "加入失败，重试";
      showNotice(error.message || "无法加入行程");
    }
  }

  function getSelectedDayContext() {
    const library = readLibrary();
    if (!library) return null;
    const list = library.lists.find((item) => item.id === library.activeListId) || library.lists[0];
    const select = document.querySelector("#aiDaySelect");
    const dayId = select?.value || list?.trip?.selectedDayId;
    const dayIndex = list?.trip?.days?.findIndex((item) => item.id === dayId) ?? -1;
    if (!list || dayIndex < 0) return null;
    return { listId: list.id, dayId, dayIndex };
  }

  function openDayMap(backdrop) {
    const context = getSelectedDayContext();
    if (!context) return;
    const mapTab = backdrop.querySelector('[data-tool-tab="map"]');
    const routeSelect = backdrop.querySelector("#routeDaySelect");
    mapTab?.click();
    if (routeSelect) {
      routeSelect.value = context.dayId;
      routeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function recommendationToActivity(item) {
    const noteParts = [];
    if (item.reason) noteParts.push(`AI 推荐：${item.reason}`);
    if (item.duration) noteParts.push(`建议时长：${item.duration}`);
    if (item.tips) noteParts.push(`提示：${item.tips}`);
    return {
      id: crypto.randomUUID(),
      time: parseSuggestedTime(item.suggestedTime),
      title: String(item.name || "当地推荐").trim().slice(0, 160),
      place: String(item.area || item.name || "").trim().slice(0, 160),
      note: noteParts.join("；").slice(0, 800),
      done: false,
      transport: null,
    };
  }

  function syncRoomMutation(mutator) {
    return new Promise((resolve, reject) => {
      const localLibrary = readLibrary();
      if (!localLibrary) {
        reject(new Error("共享行程仍在载入"));
        return;
      }
      const syncUrl = buildSyncUrl();
      if (!syncUrl) {
        reject(new Error("当前页面没有可用的同步服务"));
        return;
      }

      const helperClientId = `travel-tools-${crypto.randomUUID()}`;
      const socket = new WebSocket(syncUrl);
      let finished = false;
      const timeout = window.setTimeout(() => finish(new Error("同步超时，请检查网络后重试")), 9000);

      function finish(error, result) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        try { socket.close(); } catch {}
        if (error) reject(error);
        else resolve(result);
      }

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
          type: "join",
          clientId: helperClientId,
          roomId,
          name: "AI 行程助手",
          state: localLibrary,
        }));
      });

      socket.addEventListener("message", (event) => {
        if (finished) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type !== "state" || !message.state) return;

        try {
          const nextLibrary = cloneData(message.state);
          const result = mutator(nextLibrary) || { changed: true, message: "已更新行程" };
          if (!result.changed) {
            finish(null, result);
            return;
          }

          touchLibrary(nextLibrary);
          localStorage.setItem(storageKey, JSON.stringify(nextLibrary));
          broadcastLocalLibrary(nextLibrary, helperClientId);
          socket.send(JSON.stringify({
            type: "state",
            clientId: helperClientId,
            roomId,
            state: nextLibrary,
            reason: "add-ai-recommendation",
          }));
          window.setTimeout(() => finish(null, result), 300);
        } catch (error) {
          finish(error);
        }
      });

      socket.addEventListener("error", () => finish(new Error("无法连接行程同步服务")));
    });
  }

  function buildSyncUrl() {
    const configuredEndpoint = params.get("sync") || appConfig.syncEndpoint || "";
    const endpoint = configuredEndpoint.trim()
      || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/sync`;
    try {
      const url = new URL(endpoint, location.href);
      if (url.protocol === "http:") url.protocol = "ws:";
      if (url.protocol === "https:") url.protocol = "wss:";
      if (!/^wss?:$/.test(url.protocol)) return "";
      url.searchParams.set("room", roomId);
      return url.toString();
    } catch {
      return "";
    }
  }

  function broadcastLocalLibrary(library, clientId) {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(storageKey);
    channel.postMessage({
      type: "library",
      clientId,
      library,
      reason: "add-ai-recommendation",
    });
    window.setTimeout(() => channel.close(), 100);
  }

  function touchLibrary(library) {
    const now = Date.now();
    const list = library.lists.find((item) => item.id === library.activeListId) || library.lists[0];
    if (list?.trip) {
      list.trip.updatedAt = now;
      list.updatedAt = now;
    }
    library.updatedAt = now;
  }

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      return value?.lists?.length ? value : null;
    } catch {
      return null;
    }
  }

  function cloneData(value) {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function parseSuggestedTime(value) {
    const text = String(value || "");
    const exact = text.match(/\b([01]?\d|2[0-3])[:：]([0-5]\d)\b/);
    if (exact) return `${exact[1].padStart(2, "0")}:${exact[2]}`;
    const hour = text.match(/([01]?\d|2[0-3])\s*(?:点|时)/);
    if (hour) return `${hour[1].padStart(2, "0")}:00`;
    if (/清晨|早上|上午/.test(text)) return "09:00";
    if (/中午/.test(text)) return "12:00";
    if (/下午/.test(text)) return "15:00";
    if (/傍晚|日落/.test(text)) return "18:00";
    if (/晚上|夜间/.test(text)) return "19:00";
    return "12:00";
  }

  function normalizeKey(value) {
    return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, "");
  }

  function showNotice(text) {
    const toast = document.querySelector("#toast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.dataset.travelToolsActions = "true";
    style.textContent = `
      .ai-connection-state{margin:0 0 10px;padding:9px 11px;border-radius:10px;background:#fff3e9;color:#8b4b15;font-size:12px;font-weight:700}.ai-connection-state.connected{background:#eaf8f1;color:#16734b}
      .ai-connection-dot{width:7px;height:7px;border-radius:50%;background:#b7b7b7;margin-left:2px;display:inline-block}.ai-connection-dot.connected{background:#18a66a;box-shadow:0 0 0 3px rgba(24,166,106,.14)}
      .ai-recommendation-actions{display:flex;gap:8px;margin-top:auto;padding-top:10px}.ai-card-action{min-height:34px;padding:0 11px;border:1px solid var(--line,#dfe5e3);border-radius:9px;background:#fff;color:var(--muted,#68716f);font-size:12px;font-weight:800;cursor:pointer}.ai-card-action.primary{border-color:transparent;background:var(--ink,#17211f);color:#fff}.ai-card-action:disabled{cursor:default;opacity:.68}
      @media(max-width:680px){.ai-recommendation-actions{flex-direction:column}.ai-card-action{width:100%}}
    `;
    document.head.append(style);
  }
})();