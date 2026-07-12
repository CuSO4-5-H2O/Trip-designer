(() => {
  "use strict";

  const BUILD_ID = "render-20260713c";
  const params = new URLSearchParams(location.search);
  const roomId = params.get("room");
  const syncText = document.querySelector("#syncText");
  const syncState = document.querySelector("#syncState");

  if (!roomId || !syncText || !syncState) return;

  let httpAvailable = false;
  let probing = false;
  let timer = 0;

  syncState.title = `${BUILD_ID} · ${location.host}`;
  document.documentElement.dataset.build = BUILD_ID;

  const observer = new MutationObserver(() => {
    if (!httpAvailable) return;
    const current = syncText.textContent.trim();
    if (/已连接服务器|已同步|已保存到服务器|HTTP 同步可用/.test(current)) return;
    setStatus(`HTTP 同步可用 · ${BUILD_ID}`, true);
  });
  observer.observe(syncText, { childList: true, characterData: true, subtree: true });

  window.addEventListener("DOMContentLoaded", () => schedule(100), { once: true });
  window.addEventListener("pageshow", () => schedule(100));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule(100);
  });

  schedule(100);

  function schedule(delay) {
    clearTimeout(timer);
    timer = window.setTimeout(probe, delay);
  }

  async function probe() {
    if (probing) return;
    probing = true;
    try {
      const response = await fetchWithTimeout(
        `/api/room-state?room=${encodeURIComponent(roomId)}&build=${encodeURIComponent(BUILD_ID)}`,
        { cache: "no-store", headers: { "X-Trip-Build": BUILD_ID } },
        6000,
      );
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);

      httpAvailable = true;
      if (payload.state?.lists?.length) publish(payload.state, Number(payload.revision) || 0);
      setStatus(`HTTP 同步可用 · ${BUILD_ID}`, true);
      schedule(15000);
    } catch {
      httpAvailable = false;
      setStatus(`离线保存 · ${BUILD_ID}`, false);
      schedule(8000);
    } finally {
      probing = false;
    }
  }

  function publish(library, revision) {
    const storageKey = `trip-planner-library:${roomId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(library));
    } catch {}

    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(storageKey);
    channel.postMessage({
      type: "library",
      clientId: "connection-guard",
      library,
      revision,
      reason: "connection-guard",
    });
    window.setTimeout(() => channel.close(), 500);
  }

  function setStatus(text, connected) {
    if (syncText.textContent.trim() !== text) syncText.textContent = text;
    syncState.classList.toggle("connected", connected);
    syncState.classList.toggle("offline", !connected);
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }
})();
