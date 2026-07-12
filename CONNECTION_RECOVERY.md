# Connection recovery behavior

The editor no longer waits for the WebSocket handshake before rendering.

- The local editor is revealed immediately after DOMContentLoaded.
- WebSocket remains the preferred real-time channel.
- `/api/room-state` is probed with a timeout as an HTTP synchronization fallback.
- A successful HTTP probe keeps the status at `HTTP 同步可用` while WebSocket retries continue.
- A failed probe switches the status to offline mode without hiding the editor.
- CI now performs a real WebSocket join and waits for room state.
