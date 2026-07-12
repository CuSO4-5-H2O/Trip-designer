(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  if (!roomId) return;

  const root = document.documentElement;
  const storageKey = `trip-planner-library:${roomId}`;
  const healthyPattern = /已连接服务器|已同步|已保存到服务器|协作者已更新|同浏览器标签页已同步/;
  let revealed = false;
  let probing = false;
  let probeTimer = 0;
  let httpAvailable = false;

  root.classList.add("room-loading");

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    root.classList.remove("room-loading");
  };

  // Rendering must never depend on the WebSocket handshake. The local editor is
  // shown as soon as the DOM is ready; server synchronization continues in the
  // background and falls back to the room-state HTTP endpoint.
  window.setTimeout(reveal, 1500);
  window.addEventListener("pageshow", () => window.setTimeout(reveal, 50));
  window.addEventListener("error", reveal, { once: true });
  window.addEventListener("unhandledrejection", reveal, { once: true });

  window.addEventListener("DOMContentLoaded", () => {
    window.requestAnimationFrame(reveal);
    guardSyncLabel();
    scheduleProbe(800);
  }, { once: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleProbe(100);
  });

  function guardSyncLabel() {
    const syncText = document.querySelector("#syncText");
    if (!syncText || !window.MutationObserver) return;
    const observer = new MutationObserver(() => {
      const text = syncText.textContent.trim();
      if (!httpAvailable) return;
      if (healthyPattern.test(text) || text === "HTTP 同步可用" || text === "正在保存到服务器") return;
      setStatus("HTTP 同步可用", true, true);
    });
    observer.observe(syncText, { childList: true, characterData: true, subtree: true });
  }

  function scheduleProbe(delay) {
    clearTimeout(probeTimer);
    probeTimer = window.setTimeout(probeServer, delay);
  }

  async function probeServer() {
    if (probing) return;
    const syncText = document.querySelector("#syncText");
    const current = syncText?.textContent?.trim() || "";

    if (healthyPattern.test(current)) {
      scheduleProbe(30000);
      return;
    }

    probing = true;
    try {
      const response = await fetchWithTimeout(
        `/api/room-state?room=${encodeURIComponent(roomId)}`,
        { cache: "no-store" },
        7000,
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      httpAvailable = true;
      if (payload.state?.lists?.length) {
        publishServerState(payload.state, Number(payload.revision) || 0);
        setStatus("HTTP 同步可用", true, true);
      } else {
        setStatus("服务器已连接，房间为空", true, true);
      }
      reveal();
      scheduleProbe(15000);
    } catch {
      httpAvailable = false;
      setStatus("服务器无响应，离线保存", false, true);
      reveal();
      scheduleProbe(8000);
    } finally {
      probing = false;
    }
  }

  function publishServerState(state, revision) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The app can still receive the state through BroadcastChannel.
    }

    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(storageKey);
    const message = {
      type: "library",
      clientId: "http-bootstrap",
      library: state,
      revision,
      reason: "http-bootstrap",
    };
    channel.postMessage(message);
    window.setTimeout(() => channel.postMessage(message), 250);
    window.setTimeout(() => channel.close(), 700);
  }

  function setStatus(text, connected, force = false) {
    const syncText = document.querySelector("#syncText");
    const syncState = document.querySelector("#syncState");
    if (!syncText) return;
    if (!force && healthyPattern.test(syncText.textContent.trim())) return;
    if (syncText.textContent.trim() !== text) syncText.textContent = text;
    syncState?.classList.toggle("connected", Boolean(connected));
    syncState?.classList.toggle("offline", !connected);
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
})();
