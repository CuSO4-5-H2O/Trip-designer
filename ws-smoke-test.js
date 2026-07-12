"use strict";

const target = process.argv[2] || "ws://127.0.0.1:4177/sync?room=1075424A";
const roomId = new URL(target).searchParams.get("room") || "1075424A";
const clientId = `ci-${Date.now()}`;
const timeout = setTimeout(() => fail(new Error("WebSocket state response timed out")), 8000);
const socket = new WebSocket(target);
let finished = false;

socket.addEventListener("open", () => {
  socket.send(JSON.stringify({
    type: "join",
    clientId,
    roomId,
    name: "CI smoke test",
  }));
});

socket.addEventListener("message", (event) => {
  let message;
  try {
    message = JSON.parse(String(event.data));
  } catch {
    return;
  }
  if (message.type !== "state") return;
  if (!message.state?.lists?.length) return fail(new Error("WebSocket returned no room lists"));
  succeed();
});

socket.addEventListener("error", () => fail(new Error("WebSocket connection failed")));
socket.addEventListener("close", () => {
  if (!finished) fail(new Error("WebSocket closed before returning room state"));
});

function succeed() {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  try { socket.close(); } catch {}
  console.log("WebSocket smoke test passed");
  process.exit(0);
}

function fail(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  try { socket.close(); } catch {}
  console.error(error.message);
  process.exit(1);
}
