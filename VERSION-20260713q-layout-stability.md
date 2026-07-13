# render-20260713q 布局稳定修复

## 修复内容

- 修复 `connection-guard.js` 仍显示旧版本 `render-20260713d` 的问题。
- 连接状态不再持续覆盖主同步状态，避免用户看到旧版本号误以为 Render 未更新。
- 新增 `layout-stability-hotfix.js`：
  - 快速规划默认收起。
  - 只保留一个“展开 / 收起”按钮。
  - 折叠的日卡片会压缩成摘要卡，不再保留大块空白。
  - 覆盖旧性能样式中可能导致空白预占位的 `content-visibility` / `contain-intrinsic-size`。
- 更新 `mobile-performance-lite.js`：
  - 移除 `contain-intrinsic-size:1200px` 和 `content-visibility:auto`。
  - 手机端仍隐藏非当前日期的详细内容，但不再制造大空白块。
- 首页版本更新为 `render-20260713q`。
- Smoke test 更新到检查 `render-20260713q`、`layout-stability-hotfix.js`、新版 `connection-guard.js` 与 `mobile-performance-lite.js`。

## 数据影响

- 不修改任何 room 数据。
- 不修改 GitHub `trip-data/rooms.json` 中已有行程。
- 不删除、迁移或覆盖任何行程单。

## 部署影响

- Render 部署最新 `main` 后生效。
- 浏览器如仍显示旧状态，可强制刷新一次。

## 主要提交

- `5c23b15`：新增布局稳定补丁。
- `cf1c486`：修复旧版本同步状态覆盖。
- `570e464`：移除手机端大空白预占位。
- `afc8ef8`：页面加载 `render-20260713q` 资源。
- `2d47316`：Smoke test 更新到 `render-20260713q`。
