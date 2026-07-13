# GitHub 云端行程存储

## 目标

修复手机端、电脑端、iPad 端各自保存到本地或 Render 磁盘导致不同步的问题。新的数据流是：浏览器只和 Render 通信，Render 把唯一 room 数据同步到 GitHub 数据分支。

## 关键更改

- 新增 `github-room-store.js`：通过 GitHub Contents API 读写 room 数据。
- 新增 `github-disk-sync.js`：Render 启动时先从 GitHub 拉取 `rooms.json` 到服务端磁盘；服务端保存后再把同一份 `rooms.json` 推回 GitHub。
- 修改 `runtime.js`：启动服务前先执行 GitHub 云端数据 hydrate，然后再启动原服务。
- 新增 `/api/cloud-storage-status`：用于确认线上是否真的启用了 GitHub 云端存储。
- 默认数据分支是 `trip-data`，不会推到 `main`，因此用户每次改行程不会触发 main 分支 smoke/deploy。

## Render 环境变量

必须在 Render 上添加：

- `GITHUB_DATA_TOKEN`：GitHub fine-grained token，至少给 `CuSO4-5-H2O/Trip-designer` 仓库 Contents Read/Write 权限。

可选：

- `GITHUB_DATA_REPO`：默认 `CuSO4-5-H2O/Trip-designer`。
- `GITHUB_DATA_BRANCH`：默认 `trip-data`。
- `GITHUB_DATA_PATH`：默认 `rooms.json`。

如果没有 `GITHUB_DATA_TOKEN`，服务会继续运行，但 `/api/cloud-storage-status` 会显示 `backend: "disk"`，数据不会写入 GitHub 云端。

## 数据安全说明

- 本次更改不会清理或覆盖已有 room 数据。
- 如果 GitHub 数据分支已有数据，Render 启动时以 GitHub 为准。
- 如果 GitHub 数据分支为空但 Render 磁盘还有数据，首次启动会把 Render 磁盘里的 rooms 上传到 GitHub。
- 行程数据写入 `trip-data` 分支，避免每次保存行程都触发主分支自动部署和 smoke test。

## 验证

- GitHub Actions `Smoke test` 通过。
- GitHub Actions `WebSocket smoke test` 通过。
- 线上可访问 `/api/cloud-storage-status` 查看 `tokenConfigured` 和 `backend`。
