# render-20260713s 界面跳动修复

## 修复内容

- 修复界面周期性跳动的问题。
- `connection-guard.js` 不再每次探测云端后都通过 BroadcastChannel 广播同一份行程数据；只有云端数据签名变化时才广播。
- `cloud-authority-refresh.js` 不再使用 `TripPlanner.saveExternalLibrary()` 拉取云端数据，避免“读取云端”被误当成一次新的保存并触发服务器 revision 增长。
- 云端刷新现在只本地应用服务器数据，不反写服务器。
- 移除 `cloud-authority-refresh.js` 中会制造移动端大块预占位的 `content-visibility` / `contain-intrinsic-size` 样式。
- `layout-stability-hotfix.js` 增加地图和 AI 面板稳定样式：
  - 收起状态高度固定。
  - 隐藏内容时不保留大空白。
  - 禁止日卡片和智能面板在重复 render 时反复播放入场动画。
- 页面版本更新为 `render-20260713s`。
- Smoke test 更新到 `render-20260713s`。

## 数据影响

- 不修改已有 room 数据。
- 不修改 GitHub `trip-data/rooms.json` 中已有行程。
- 本次修复减少无意义的重复同步写入，避免 revision 因刷新而增长。

## 主要提交

- `36c2344`：云端刷新只本地应用，不反写服务器。
- `98728e6`：连接守护只在数据变化时广播。
- `8162344`：稳定地图 / AI 面板高度并取消重复动画。
- `380f222`：页面加载 `render-20260713s` 资源。
- `00ba62d`：Smoke test 更新到 `render-20260713s`。
