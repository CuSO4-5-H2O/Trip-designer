(() => {
  "use strict";

  const NAME_KEY = "trip-planner:member-name";

  function init() {
    installStyles();
    installRoomButton();
    bindRoomCode();
  }

  function currentRoom() {
    return window.TripRoom?.id || new URLSearchParams(window.location.search).get("room") || "";
  }

  function normalizeRoom(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z_-]/g, "")
      .slice(0, 32);
  }

  function makeRoomId() {
    const bytes = window.crypto.getRandomValues(new Uint8Array(4));
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  function getName() {
    try {
      return window.localStorage.getItem(NAME_KEY) || "我";
    } catch {
      return "我";
    }
  }

  function saveName(name) {
    const normalized = String(name || "我").trim() || "我";
    try {
      window.localStorage.setItem(NAME_KEY, normalized);
    } catch {}
    const memberInput = document.querySelector("#memberName");
    if (memberInput) {
      memberInput.value = normalized;
      memberInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function installRoomButton() {
    const actions = document.querySelector(".top-actions");
    if (!actions || document.querySelector("#roomLoginBtn")) return;
    const button = document.createElement("button");
    button.id = "roomLoginBtn";
    button.className = "room-login-button";
    button.type = "button";
    button.title = "切换房间或复制当前房间链接";
    button.innerHTML = `<span>房间</span><strong>${escapeHtml(currentRoom() || "未进入")}</strong>`;
    button.addEventListener("click", openDialog);
    const syncState = document.querySelector("#syncState");
    actions.insertBefore(button, syncState?.nextElementSibling || actions.firstChild);
  }

  function bindRoomCode() {
    const roomCode = document.querySelector("#roomCode");
    if (!roomCode || roomCode.dataset.roomLoginBound === "1") return;
    roomCode.dataset.roomLoginBound = "1";
    roomCode.classList.add("room-code-link");
    roomCode.title = "点击切换房间";
    const room = currentRoom();
    if (room) roomCode.textContent = room;
    roomCode.addEventListener("click", openDialog);
  }

  function openDialog() {
    document.querySelector(".room-login-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "room-login-overlay";
    overlay.innerHTML = `
      <section class="room-login-dialog" role="dialog" aria-modal="true" aria-labelledby="roomLoginTitle">
        <button class="room-login-close" type="button" aria-label="关闭">×</button>
        <p class="room-login-eyeline">行程房间</p>
        <h2 id="roomLoginTitle">进入同一个房间</h2>
        <p class="room-login-copy">同一房间号会打开同一份云端行程数据。把完整链接发给朋友，或让对方输入同一个房间号。</p>
        <label>
          <span>你的昵称</span>
          <input id="roomLoginName" autocomplete="name" value="${escapeAttr(getName())}" />
        </label>
        <label>
          <span>房间号</span>
          <input id="roomLoginRoom" autocomplete="off" inputmode="latin" value="${escapeAttr(currentRoom())}" placeholder="例如 1075424A" />
        </label>
        <div class="room-login-actions">
          <button class="primary" id="roomEnterBtn" type="button">进入房间</button>
          <button class="secondary" id="roomCopyBtn" type="button">复制链接</button>
          <button class="secondary" id="roomNewBtn" type="button">新建房间</button>
        </div>
        <p class="room-login-status" id="roomLoginStatus" aria-live="polite"></p>
      </section>`;
    document.body.append(overlay);

    const nameInput = overlay.querySelector("#roomLoginName");
    const roomInput = overlay.querySelector("#roomLoginRoom");
    overlay.querySelector(".room-login-close")?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) overlay.remove();
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") overlay.remove();
    });
    overlay.querySelector("#roomEnterBtn")?.addEventListener("click", () => enterRoom(nameInput.value, roomInput.value));
    overlay.querySelector("#roomCopyBtn")?.addEventListener("click", () => copyRoomLink(roomInput.value));
    overlay.querySelector("#roomNewBtn")?.addEventListener("click", () => {
      roomInput.value = makeRoomId();
      enterRoom(nameInput.value, roomInput.value);
    });
    roomInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") enterRoom(nameInput.value, roomInput.value);
    });
    nameInput.focus({ preventScroll: true });
    nameInput.select?.();
  }

  function enterRoom(name, roomValue) {
    const room = normalizeRoom(roomValue);
    if (!room) {
      setStatus("请输入房间号");
      return;
    }
    saveName(name);
    if (window.TripRoom?.switchTo) {
      window.TripRoom.switchTo(room);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.location.assign(url.toString());
  }

  function copyRoomLink(roomValue) {
    const room = normalizeRoom(roomValue || currentRoom());
    if (!room) {
      setStatus("请输入房间号");
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    const link = url.toString();
    if (!navigator.clipboard?.writeText) {
      setStatus(link);
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => setStatus("房间链接已复制"),
      () => setStatus(link),
    );
  }

  function setStatus(text) {
    const status = document.querySelector("#roomLoginStatus");
    if (status) status.textContent = text;
  }

  function installStyles() {
    if (document.querySelector("#roomLoginStyles")) return;
    const style = document.createElement("style");
    style.id = "roomLoginStyles";
    style.textContent = `
      .room-login-button{height:40px;border:1px solid rgba(15,143,131,.24);border-radius:8px;background:#eef9f6;color:#087169;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:850;white-space:nowrap}
      .room-login-button span{font-size:12px;color:#60716d}.room-login-button strong{font-size:13px;letter-spacing:.02em}
      .room-code-link{cursor:pointer;color:#087169!important;text-decoration:underline;text-underline-offset:3px}
      .room-login-overlay{position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:20px;background:rgba(23,33,31,.28);backdrop-filter:blur(10px)}
      .room-login-dialog{position:relative;width:min(520px,100%);border:1px solid #cfe3de;border-radius:12px;background:#fff;padding:24px;box-shadow:0 28px 90px rgba(23,33,31,.24)}
      .room-login-close{position:absolute;right:14px;top:12px;width:34px;height:34px;border:1px solid #d5dfdc;border-radius:8px;background:#fff;color:#60716d;font-size:22px;line-height:1}
      .room-login-eyeline{margin:0 0 6px;color:#087169;font-size:12px;font-weight:900}
      .room-login-dialog h2{margin:0;font-size:28px;line-height:1.12;letter-spacing:0}
      .room-login-copy{margin:10px 0 18px;color:#60716d;line-height:1.7}
      .room-login-dialog label{display:grid;gap:7px;margin-top:12px}
      .room-login-dialog label span{font-size:13px;font-weight:850;color:#60716d}
      .room-login-dialog input{height:48px;border:1px solid #cfe3de;border-radius:9px;padding:0 13px;font-size:18px;font-weight:850;letter-spacing:0}
      .room-login-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:18px}
      .room-login-actions button{height:44px;border-radius:9px;border:1px solid #a9ded8;font-weight:900}
      .room-login-actions .primary{background:#17211f;color:#fff;border-color:#17211f}
      .room-login-actions .secondary{background:#e3f7f4;color:#087169}
      .room-login-status{min-height:22px;margin:12px 0 0;color:#087169;font-weight:850;word-break:break-all}
      @media(max-width:720px){.room-login-dialog{padding:20px}.room-login-actions{grid-template-columns:1fr}.room-login-button span{display:none}.room-login-button{height:38px;padding:0 10px}}
    `;
    document.head.append(style);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  const escapeAttr = escapeHtml;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
