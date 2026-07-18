(() => {
  "use strict";

  window.TripAuthBootstrap = { showGate };

  function showGate() {
    const html = `<!doctype html>
<html lang="zh-CN" class="auth-gate-document">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>行程编辑器</title>
  <style>
    :root{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;color:#17211f;background:#eef6f2}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:24px;background:radial-gradient(circle at top left,#dff4ee,transparent 34%),linear-gradient(225deg,rgba(239,115,95,.08),transparent 38%),#f7faf8}.auth-gate-document .app-shell,.auth-gate-document .toast,.auth-gate-document .room-loading-overlay{display:none!important}.gate{width:min(1060px,100%);margin:0 auto;background:#fff;border:1px solid #cfe3de;border-radius:18px;box-shadow:0 24px 80px rgba(23,33,31,.13);padding:26px}.brand{display:flex;gap:14px;align-items:center;margin-bottom:18px}.brand-mark{width:52px;height:52px;border-radius:14px;background:#17211f;color:#fff;display:grid;place-items:center}.brand-mark svg{width:30px;height:30px;fill:currentColor}.eyeline{margin:0;color:#007d72;font-weight:900}.gate h1{margin:4px 0 0;font-size:32px;line-height:1.1;letter-spacing:0}.gate h2{margin:0;font-size:24px;letter-spacing:0}.gate p{color:#5e706c;line-height:1.7}.tabs{display:flex;gap:8px;margin:20px 0}.tabs button{height:42px;border-radius:12px;border:1px solid #cfe3de;background:#f8fbfa;padding:0 16px;font-weight:900;cursor:pointer}.tabs button.active{background:#17211f;color:#fff;border-color:#17211f}.grid{display:grid;gap:14px}.field{display:grid;gap:7px}.field span{font-weight:900;color:#5e706c}.field input{height:52px;border:1px solid #cfe3de;border-radius:12px;padding:0 14px;font-size:18px;font-weight:800}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.primary,.secondary,.danger{height:48px;border-radius:12px;border:1px solid #a9ded8;padding:0 18px;font-weight:900;font-size:16px;cursor:pointer}.primary{background:#17211f;color:#fff;border-color:#17211f}.secondary{background:#e3f7f4;color:#007d72}.danger{background:#fff0ed;color:#b63a28;border-color:#ffd1c9}.split{display:grid;grid-template-columns:1fr;gap:18px;margin-top:20px;padding-top:18px;border-top:1px dashed #cfe3de}.error{color:#b63a28;font-weight:900;min-height:22px}.room-row{display:grid;grid-template-columns:1fr auto;gap:10px}.room-row input{height:48px;border:1px solid #cfe3de;border-radius:12px;padding:0 14px;font-size:16px;font-weight:800;text-transform:uppercase}.muted{color:#6a7774;font-size:14px}.home{display:none}.home.active{display:block}.home-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:6px 0 18px}.home-actions{display:flex;gap:10px;flex-wrap:wrap}.room-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:14px}.room-card{display:grid;gap:10px;text-align:left;border:1px solid #cfe3de;border-radius:12px;background:#f9fcfb;padding:14px;cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.room-card:hover{transform:translateY(-1px);border-color:#7fd3cb;box-shadow:0 12px 34px rgba(23,33,31,.08)}.room-card strong{font-size:18px;color:#17211f}.room-card span{color:#5e706c;font-weight:800}.room-card .role{justify-self:start;border-radius:999px;background:#e3f7f4;color:#007d72;padding:5px 9px;font-size:12px;font-weight:900}.room-card.editor .role{background:#fff5dc;color:#8a6200}.room-card .room-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:#007d72}.empty{border:1px dashed #b8d9d4;border-radius:12px;padding:18px;color:#5e706c;background:#fbfefd}.auth-panel.hidden{display:none}.status-line{min-height:24px;color:#007d72;font-weight:900;margin-top:10px;word-break:break-all}@media(min-width:760px){.split{grid-template-columns:1.2fr 1fr}}@media(max-width:640px){body{padding:12px}.gate{padding:18px;border-radius:14px}.gate h1{font-size:28px}.room-row{grid-template-columns:1fr}.primary,.secondary,.danger{width:100%}.home-actions{width:100%}.home-actions button{flex:1 1 160px}.room-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main class="gate" aria-label="行程编辑器登录">
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5 10 4l3 7 6.5-2.5L14 20l-3-7-6.5 2.5Z"/></svg></span><div><p class="eyeline">行程编辑器</p><h1 id="pageTitle">登录或注册</h1></div></div>

    <section class="home" id="accountHome" aria-label="账号主页">
      <div class="home-top">
        <div><h2 id="homeTitle">我的房间</h2><p class="muted">这里会显示你自己新建的房间，以及别人邀请后加入到账号里的协作房间。进入同一个 room 才会共用同一份云端行程。</p></div>
        <div class="home-actions"><button class="primary" id="createRoom" type="button">新建房间</button><button class="secondary" id="refreshRooms" type="button">刷新</button><button class="danger" id="logout" type="button">退出登录</button></div>
      </div>
      <div class="room-row"><input id="joinRoomInput" placeholder="输入朋友分享的 room 号" /><button class="secondary" id="joinRoom" type="button">加入房间</button></div>
      <p class="status-line" id="homeStatus" aria-live="polite"></p>
      <div class="room-grid" id="roomGrid"></div>
    </section>

    <section class="auth-panel" id="authPanel">
      <p>登录后会进入账号主页。每个账号有自己的默认 room，也可以新建房间，或加入朋友分享的 room 一起修改同一份行程。</p>
      <div class="tabs"><button id="loginTab" class="active" type="button">登录</button><button id="registerTab" type="button">注册</button></div>
      <section class="grid" id="accountBox">
        <label class="field"><span>账号</span><input id="username" autocomplete="username" placeholder="3-32位字母数字" /></label>
        <label class="field"><span>密码</span><input id="password" autocomplete="current-password" type="password" placeholder="至少6位" /></label>
        <div class="error" id="authError"></div>
        <div class="actions"><button class="primary" id="submitAuth" type="button">登录</button><button class="secondary" id="clearAuth" type="button">清除本机登录</button></div>
      </section>
      <section class="split">
        <div><strong>已有共享链接？</strong><p class="muted">不登录也可以直接进入别人分享的 room；登录后可以把这个 room 加入你的账号主页。</p></div>
        <div class="room-row"><input id="roomInput" placeholder="输入 room 号，例如 1075424A" /><button class="secondary" id="enterRoom" type="button">进入</button></div>
      </section>
    </section>
  </main>
  <script>
    (${clientGate.toString()})();
  <\/script>
</body>
</html>`;
    document.open();
    document.write(html);
    document.close();
    window.stop?.();
  }

  function clientGate() {
    const tokenKey = "tripdesigner:auth-token";
    const accountKey = "tripdesigner:account";
    const lastRoomKey = "tripdesigner:last-room";
    let mode = "login";
    let accountState = null;
    const $ = (s) => document.querySelector(s);
    const token = localStorage.getItem(tokenKey);
    const rememberedRoom = normalizeRoom(localStorage.getItem(lastRoomKey));
    if (rememberedRoom) $("#roomInput").value = rememberedRoom;
    bindAuth();
    bindHome();
    if (token) restoreSession(token);

    function bindAuth() {
      $("#loginTab").onclick = () => setMode("login");
      $("#registerTab").onclick = () => setMode("register");
      $("#submitAuth").onclick = submit;
      $("#clearAuth").onclick = () => { localStorage.removeItem(tokenKey); localStorage.removeItem(accountKey); showAuth("本机登录已清除"); };
      $("#enterRoom").onclick = () => enterRoom($("#roomInput").value);
      $("#password").addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
    }

    function bindHome() {
      $("#createRoom").onclick = createRoom;
      $("#refreshRooms").onclick = () => loadRoomCards(accountState, true);
      $("#logout").onclick = () => { localStorage.removeItem(tokenKey); localStorage.removeItem(accountKey); accountState = null; showAuth("已退出登录"); };
      $("#joinRoom").onclick = () => joinRoom($("#joinRoomInput").value);
      $("#joinRoomInput").addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom($("#joinRoomInput").value); });
    }

    function setMode(next) { mode = next; $("#loginTab").classList.toggle("active", mode === "login"); $("#registerTab").classList.toggle("active", mode === "register"); $("#submitAuth").textContent = mode === "login" ? "登录" : "注册并进入主页"; setError(""); }

    async function restoreSession(authToken) {
      try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${authToken}` }, cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "登录已过期");
        localStorage.setItem(accountKey, JSON.stringify(data.account));
        renderHome(data.account);
      } catch (error) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(accountKey);
        showAuth(error.message || "请重新登录");
      }
    }

    async function submit() {
      const username = $("#username").value.trim();
      const password = $("#password").value;
      setError("正在处理...");
      try {
        const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "登录失败");
        localStorage.setItem(tokenKey, data.token);
        localStorage.setItem(accountKey, JSON.stringify(data.account));
        renderHome(data.account);
      } catch (error) {
        setError(error.message || "登录失败");
      }
    }

    function renderHome(account) {
      accountState = normalizeAccount(account);
      $("#pageTitle").textContent = "账号主页";
      $("#homeTitle").textContent = `${accountState.displayName || accountState.username} 的房间`;
      $("#authPanel").classList.add("hidden");
      $("#accountHome").classList.add("active");
      setHomeStatus("正在读取房间...");
      loadRoomCards(accountState, false);
    }

    function showAuth(message) {
      $("#pageTitle").textContent = "登录或注册";
      $("#authPanel").classList.remove("hidden");
      $("#accountHome").classList.remove("active");
      setError(message || "");
    }

    async function createRoom() {
      const authToken = localStorage.getItem(tokenKey);
      if (!authToken) return showAuth("请先登录");
      setHomeStatus("正在新建房间...");
      try {
        const res = await fetch("/api/auth/create-room", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: "{}" });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "新建房间失败");
        localStorage.setItem(accountKey, JSON.stringify(data.account));
        renderHome(data.account);
        setHomeStatus(`已新建房间 ${data.roomId}`);
      } catch (error) {
        setHomeStatus(error.message || "新建房间失败");
      }
    }

    async function joinRoom(value) {
      const room = normalizeRoom(value);
      if (!room) return setHomeStatus("请输入 room 号");
      const authToken = localStorage.getItem(tokenKey);
      if (!authToken) return showAuth("请先登录后加入房间");
      setHomeStatus("正在加入房间...");
      try {
        const res = await fetch("/api/auth/join-room", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ roomId: room }) });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "加入房间失败");
        localStorage.setItem(accountKey, JSON.stringify(data.account));
        $("#joinRoomInput").value = "";
        renderHome(data.account);
        setHomeStatus(`已加入房间 ${room}`);
      } catch (error) {
        setHomeStatus(error.message || "加入房间失败");
      }
    }

    async function loadRoomCards(account, manual) {
      const grid = $("#roomGrid");
      const rooms = normalizeAccount(account).rooms;
      if (!rooms.length) {
        grid.innerHTML = `<div class="empty">这个账号还没有房间。点击“新建房间”，或输入朋友分享的 room 号加入。</div>`;
        setHomeStatus("");
        return;
      }
      grid.innerHTML = rooms.map((room) => placeholderCard(room)).join("");
      grid.querySelectorAll(".room-card").forEach((card) => card.addEventListener("click", () => enterRoom(card.dataset.roomId)));
      const summaries = await Promise.all(rooms.map(loadRoomSummary));
      grid.innerHTML = summaries.map(roomCard).join("");
      grid.querySelectorAll(".room-card").forEach((card) => card.addEventListener("click", () => enterRoom(card.dataset.roomId)));
      setHomeStatus(manual ? "房间列表已刷新" : "");
    }

    async function loadRoomSummary(room) {
      try {
        const response = await fetch(`/api/room-state?room=${encodeURIComponent(room.roomId)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "room unavailable");
        const state = payload.state || {};
        const active = (state.lists || []).find((item) => item.id === state.activeListId) || (state.lists || [])[0] || null;
        const days = active?.trip?.days || [];
        const items = days.reduce((sum, day) => sum + (day.activities || []).length, 0);
        return { ...room, title: active?.name || active?.trip?.tripTitle || "未命名行程", days: days.length, items, revision: payload.revision || 0 };
      } catch {
        return { ...room, title: "未初始化房间", days: 0, items: 0, revision: 0 };
      }
    }

    function placeholderCard(room) {
      return `<button class="room-card ${room.role === "owner" ? "owner" : "editor"}" type="button" data-room-id="${escapeAttr(room.roomId)}"><span class="role">${roleLabel(room.role)}</span><strong>读取中...</strong><span class="room-id">${escapeHtml(room.roomId)}</span><span>正在读取云端数据</span></button>`;
    }

    function roomCard(room) {
      return `<button class="room-card ${room.role === "owner" ? "owner" : "editor"}" type="button" data-room-id="${escapeAttr(room.roomId)}"><span class="role">${roleLabel(room.role)}</span><strong>${escapeHtml(room.title)}</strong><span class="room-id">${escapeHtml(room.roomId)}</span><span>${room.days || 0} 天 · ${room.items || 0} 项</span></button>`;
    }

    function enterRoom(value) {
      const room = normalizeRoom(value);
      if (!room) { setError("请输入 room 号"); return; }
      localStorage.setItem(lastRoomKey, room);
      const url = new URL(location.href);
      url.searchParams.set("room", room);
      location.assign(url.toString());
    }

    function normalizeAccount(account) {
      const rooms = Array.isArray(account?.rooms) ? account.rooms : [];
      return { ...(account || {}), rooms: rooms.map((room) => ({ roomId: normalizeRoom(room.roomId), role: room.role === "owner" ? "owner" : "editor", addedAt: room.addedAt || "" })).filter((room) => room.roomId) };
    }

    function normalizeRoom(value) { return String(value || "").trim().toUpperCase().replace(/[^0-9A-Z_-]/g, "").slice(0, 32); }
    function roleLabel(role) { return role === "owner" ? "我的房间" : "协作房间"; }
    function setError(text) { $("#authError").textContent = text; }
    function setHomeStatus(text) { $("#homeStatus").textContent = text || ""; }
    function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
    const escapeAttr = escapeHtml;
  }
})();
