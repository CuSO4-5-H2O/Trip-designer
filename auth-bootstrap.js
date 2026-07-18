(() => {
  "use strict";

  const tokenKey = "tripdesigner:auth-token";
  const accountKey = "tripdesigner:account";
  const lastRoomKey = "tripdesigner:last-room";

  window.TripAuthBootstrap = { showGate };

  function showGate() {
    const html = `<!doctype html>
<html lang="zh-CN" class="auth-gate-document">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>行程编辑器</title>
  <style>
    :root{font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;color:#17211f;background:#eef6f2}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top left,#dff4ee,transparent 34%),#f7faf8}.auth-gate-document .app-shell,.auth-gate-document .toast,.auth-gate-document .room-loading-overlay{display:none!important}.gate{width:min(680px,100%);background:#fff;border:1px solid #cfe3de;border-radius:18px;box-shadow:0 24px 80px rgba(23,33,31,.13);padding:28px}.brand{display:flex;gap:14px;align-items:center;margin-bottom:22px}.brand-mark{width:52px;height:52px;border-radius:14px;background:#17211f;color:#fff;display:grid;place-items:center}.brand-mark svg{width:30px;height:30px;fill:currentColor}.eyeline{margin:0;color:#007d72;font-weight:900}.gate h1{margin:4px 0 0;font-size:32px;line-height:1.1}.gate p{color:#5e706c;line-height:1.7}.tabs{display:flex;gap:8px;margin:20px 0}.tabs button{height:42px;border-radius:12px;border:1px solid #cfe3de;background:#f8fbfa;padding:0 16px;font-weight:900;cursor:pointer}.tabs button.active{background:#17211f;color:#fff;border-color:#17211f}.grid{display:grid;gap:14px}.field{display:grid;gap:7px}.field span{font-weight:900;color:#5e706c}.field input{height:52px;border:1px solid #cfe3de;border-radius:12px;padding:0 14px;font-size:18px;font-weight:800}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.primary,.secondary{height:48px;border-radius:12px;border:1px solid #a9ded8;padding:0 18px;font-weight:900;font-size:16px;cursor:pointer}.primary{background:#17211f;color:#fff;border-color:#17211f}.secondary{background:#e3f7f4;color:#007d72}.split{display:grid;grid-template-columns:1fr;gap:18px;margin-top:20px;padding-top:18px;border-top:1px dashed #cfe3de}.error{color:#b63a28;font-weight:900;min-height:22px}.room-row{display:grid;grid-template-columns:1fr auto;gap:10px}.room-row input{height:48px;border:1px solid #cfe3de;border-radius:12px;padding:0 14px;font-size:16px;font-weight:800;text-transform:uppercase}.muted{color:#6a7774;font-size:14px}@media(min-width:760px){.split{grid-template-columns:1.3fr 1fr}}
  </style>
</head>
<body>
  <main class="gate" aria-label="行程编辑器登录">
    <div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5 10 4l3 7 6.5-2.5L14 20l-3-7-6.5 2.5Z"/></svg></span><div><p class="eyeline">行程编辑器</p><h1>登录或注册</h1></div></div>
    <p>登录后会进入这个账号固定的云端房间。把带 <strong>room</strong> 的链接发给朋友，朋友打开同一个 room 就能一起修改同一份行程。</p>
    <div class="tabs"><button id="loginTab" class="active" type="button">登录</button><button id="registerTab" type="button">注册</button></div>
    <section class="grid" id="accountBox">
      <label class="field"><span>账号</span><input id="username" autocomplete="username" placeholder="3-32位字母数字" /></label>
      <label class="field"><span>密码</span><input id="password" autocomplete="current-password" type="password" placeholder="至少6位" /></label>
      <div class="error" id="authError"></div>
      <div class="actions"><button class="primary" id="submitAuth" type="button">登录</button><button class="secondary" id="clearAuth" type="button">清除本机登录</button></div>
    </section>
    <section class="split">
      <div><strong>已有共享链接？</strong><p class="muted">不登录也可以直接进入别人分享的 room；登录后也可以把这个 room 加入你的账号。</p></div>
      <div class="room-row"><input id="roomInput" placeholder="输入 room 号，例如 1075424A" /><button class="secondary" id="enterRoom" type="button">进入</button></div>
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
    const $ = (s) => document.querySelector(s);
    const token = localStorage.getItem(tokenKey);
    const rememberedRoom = normalizeRoom(localStorage.getItem(lastRoomKey));
    if (rememberedRoom) $("#roomInput").value = rememberedRoom;
    if (token) restoreSession(token);
    $("#loginTab").onclick = () => setMode("login");
    $("#registerTab").onclick = () => setMode("register");
    $("#submitAuth").onclick = submit;
    $("#clearAuth").onclick = () => { localStorage.removeItem(tokenKey); localStorage.removeItem(accountKey); setError("本机登录已清除"); };
    $("#enterRoom").onclick = () => enterRoom($("#roomInput").value);
    $("#password").addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); });
    function setMode(next) { mode = next; $("#loginTab").classList.toggle("active", mode === "login"); $("#registerTab").classList.toggle("active", mode === "register"); $("#submitAuth").textContent = mode === "login" ? "登录" : "注册并进入"; setError(""); }
    async function restoreSession(token) { try { const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); const data = await res.json(); if (!res.ok || !data.ok) return; localStorage.setItem(accountKey, JSON.stringify(data.account)); enterRoom(data.account.defaultRoomId); } catch {} }
    async function submit() { const username = $("#username").value.trim(); const password = $("#password").value; setError("正在处理..."); try { const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await res.json(); if (!res.ok || !data.ok) throw new Error(data.error || "登录失败"); localStorage.setItem(tokenKey, data.token); localStorage.setItem(accountKey, JSON.stringify(data.account)); enterRoom(data.roomId || data.account.defaultRoomId); } catch (error) { setError(error.message || "登录失败"); } }
    function enterRoom(value) { const room = normalizeRoom(value); if (!room) { setError("请输入 room 号"); return; } localStorage.setItem(lastRoomKey, room); const url = new URL(location.href); url.searchParams.set("room", room); location.assign(url.toString()); }
    function normalizeRoom(value) { return String(value || "").trim().toUpperCase().replace(/[^0-9A-Z_-]/g, "").slice(0, 32); }
    function setError(text) { $("#authError").textContent = text; }
  }
})();