# 修改说明

本文件记录 Trip-designer 的主要功能更新、性能修复、部署变更和兼容性说明。

## 2026-07-12：Smoke test 断言修复

### 修复问题

- 修复 GitHub Actions `Smoke test` 持续失败的问题。
- 失败原因是测试仍在检查旧资源标识 `context-editor-20260712b`，但当前首页已经不再加载该资源。
- 连续 GitHub 提交会连续触发该过时断言，因此用户会反复收到 `smoketest fail` 通知。

### 变更内容

- 将首页资源检查更新为当前真实入口：

```text
./app-collab.js
./map-providers.js?v=map-20260712a
./map-providers.css?v=map-20260712a
```

- 增加 `/api/map-config` smoke test，确认地图代理接口可启动并识别高德和 Google 环境变量。
- 确认首页不再加载 Leaflet 资源。

### 部署影响

- 不涉及任何房间数据迁移。
- 不修改 `data/rooms.json` 或 Render Persistent Disk 中已有行程。
- 该修改只影响 GitHub Actions 测试，不改变用户行程数据。

### 主要提交

- `待本次提交生成`：更新 `.github/workflows/smoke-test.yml` 的过时断言。

## 2026-07-12：高德地图与 Google Maps 路线接入

### 新增功能

- 地图组件由 Leaflet + OpenStreetMap 替换为可切换的高德地图和 Google Maps。
- 地图面板新增服务选择：自动、高德、Google。
- 服务端新增地图代理接口：

```text
GET /api/map-config
POST /api/map/plan
```

- `/api/map/plan` 会根据当前行程地点、住宿和事项地点生成定位点。
- 地点按行程顺序绘制 marker，并按顺序生成路线段。
- 路线段会结合事项交通方式计算：飞机、火车、大巴、船、车、步行。
- 飞机和船等地图服务不稳定支持的交通方式使用直线距离估算时间，并在 UI 中标记为估算。
- 点击单日时显示当天地点和路线；点击 list 时显示该行程单全部地点和路线。

### 环境变量

Render 需要配置以下变量之一或多个：

```text
gaodemap_key=高德地图 Web/API Key
gaodemap_securitycode=高德地图 JS 安全密钥
googlemap=Google Maps API Key
```

兼容的大写变量名：

```text
GAODEMAP_KEY
AMAP_KEY
GAODEMAP_SECURITYCODE
AMAP_SECURITY_CODE
GOOGLEMAP
GOOGLE_MAPS_API_KEY
```

默认优先级：

1. 已配置高德时默认使用高德；
2. 未配置高德但配置 Google 时默认使用 Google；
3. 前端可手动切换地图服务。

### 部署影响

- 不涉及任何房间数据迁移。
- 不修改 `data/rooms.json` 或 Render Persistent Disk 中已有行程。
- Render 重新部署后即可生效。
- 如果地图无法加载，请检查地图 key 是否限制了正确域名：

```text
https://tripdesigner.onrender.com
```

### 用户界面影响

- 页面不再加载 Leaflet 资源。
- 地图卡片新增地图服务下拉框。
- 地图下方新增路线总距离、总时长和分段路线摘要。
- 移动端路线摘要会自动换行，避免横向滚动。

### 主要提交

- `4d57104`：新增服务端地图代理运行文件。
- `4d1ae4e`：新增高德与 Google 前端地图替换层。
- `50dbc28`：新增地图服务切换与路线摘要样式。
- `7725ac3`：在 `runtime.js` 中接入地图代理。
- `fbe4aaf`：页面移除 Leaflet 并加载新地图组件。
- `d1f4c52`：限制地图重渲染监听范围，避免重复路线请求。

## 2026-07-12：AI、地图、标签与性能重构

### 新增功能

- 接入 DeepSeek 旅行推荐接口。
- 支持根据当天地点、住宿、现有事项和旅行偏好生成当地景点、餐饮及体验建议。
- AI 推荐卡支持一键加入当前日期，并沿用原有房间同步逻辑。
- 新增 Leaflet + OpenStreetMap 路线地图，可按天或整份行程查看地点标记和路线关系。
- 新增事项标签功能，支持 `#预定`、`#待定`、`#已预定`、`#需购票` 和自定义标签。
- 标签可添加、移除、保存，并同步给同一房间的同行者。

### DeepSeek 配置

Render 环境变量现在兼容以下名称，按顺序读取：

```text
DEEPSEEK_API_KEY
deepseek
DEEPSEEK
```

因此，Render 中已经配置为 `deepseek` 的 API Key 不需要重命名。

默认模型：

```text
DEEPSEEK_MODEL=deepseek-chat
```

AI 接口增加了默认保护：

```text
AI_RATE_LIMIT=12
AI_RATE_WINDOW_MS=600000
AI_CONCURRENCY_LIMIT=3
```

含义：每个 IP 在 10 分钟内最多请求 12 次，同时最多处理 3 个 AI 请求。

### 编辑界面调整

- 移除桌面端长期占据右侧的固定编辑栏。
- 移除移动端固定在屏幕顶部或底部的编辑抽屉。
- 点击日期中的“改地点”“改住宿”“加事项”后，编辑器在对应日期卡片附近弹出。
- 点击具体事项、编辑按钮或交通按钮后，编辑器在对应事项附近弹出。
- 标签弹窗和预算编辑器也改为在对应事项附近显示。
- 页面滚动或窗口尺寸变化时，弹窗会重新定位。
- 点击页面空白区域或按 `Esc` 可关闭编辑器。

### 性能优化

本轮重点修复了页面持续卡顿和高频重绘问题：

- 限制 MutationObserver 的监听范围，避免观察整个应用页面。
- 修复预算模块和快速规划模块修改 DOM 后再次触发自身渲染的循环。
- 将预算、快速规划和排序脚本改为独立 ES Module，避免全局函数互相覆盖。
- 对行程标题、地点、住宿、成员名、预算和天数滑块的输入进行防抖处理。
- 避免每输入一个字符就保存整份行程、重绘全部日期并发送同步。
- 长行程启用 `content-visibility`，减少屏幕外日期卡片的渲染成本。
- 移除长期 `will-change`、重复入场动画和部分高成本模糊效果。
- 降低触摸设备上的 hover 动画开销。

### 数据安全修复

- 修复 Render 每次重新部署时，静态示例行程可能覆盖服务器已有房间数据的问题。
- 现在仅在目标房间不存在时导入初始行程。
- 已存在的线上房间和用户修改内容会被完整保留。

### 启动方式变更

服务端启动入口由 `prepare-seed.js` 调整为：

```text
runtime.js
```

`package.json` 当前启动命令：

```json
{
  "scripts": {
    "start": "node runtime.js"
  }
}
```

`runtime.js` 负责：

- 兼容 `deepseek` 环境变量；
- 设置默认 DeepSeek 模型；
- 对 AI 推荐接口进行限流和并发保护；
- 再启动数据初始化和主服务。

### 自动测试

新增 GitHub Actions 烟雾测试，检查：

- 所有 JavaScript 文件语法；
- Node.js 20 环境启动；
- 小写 `deepseek` 环境变量是否被识别；
- `/healthz` 是否正常；
- `/api/ai-status` 是否显示 AI 已配置；
- 默认模型是否为 `deepseek-chat`；
- 新版上下文编辑器资源是否正确加载。

### 部署步骤

在 Render 中部署最新 `main` 分支：

```text
Manual Deploy
→ Deploy latest commit
```

部署完成后强制刷新浏览器：

```text
Windows：Ctrl + F5
macOS：Command + Shift + R
```

检查 AI 配置：

```text
GET /api/ai-status
```

正常返回示例：

```json
{
  "configured": true,
  "model": "deepseek-chat"
}
```

### 主要提交

- `1624fc2`：自动测试覆盖新的安全启动入口。
- `382a16b`：通过 `runtime.js` 启动服务。
- `9269506`：DeepSeek 环境变量兼容、限流和并发保护。
- `1a93cf1` / `54bc4a7`：高频输入防抖。
- `0701bb0`：修复递归 DOM 观察和循环重绘。
- `0e14203`：编辑器改为在对应行程附近弹出。
- `41216b3`：部署时保留现有房间数据。
- `39acac1`：事项标签交互修复。

## 维护规则

后续每次完成功能、修复或部署结构调整后，应在本文件顶部新增一节，至少写明：

1. 修改日期；
2. 新增或变更的功能；
3. 修复的问题；
4. 是否需要新增环境变量；
5. 是否涉及数据迁移或部署操作；
6. 对用户界面和兼容性的影响；
7. 对应主要提交或版本号。
