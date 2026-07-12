# 同行日程

一个支持多人实时协作的旅行行程网页。把同一个 `?room=` 链接发给同行者，大家可以共同编辑同一份行程单。

## 当前功能

- 多行程单、日期与事项编辑
- 多人实时同步和房间链接分享
- 事项交通、预算和标签
- DeepSeek 当地旅行推荐
- 高德地图 / Google Maps 行程地图和路线时间估算
- 推荐结果一键加入对应日期
- 点击事项后，在该事项旁边弹出编辑界面

## 修改记录

完整的功能变更、性能修复、环境变量、部署影响和测试说明记录在：

```text
CHANGELOG.md
```

后续每轮功能修改或问题修复完成后，都应同步更新该文件。

## 本地运行

```bash
npm start
```

然后打开：

```text
http://localhost:4177
```

本地数据默认保存到 `data/rooms.json`。

## 部署到 Render

本项目只采用 Render Web Service 同源部署。前端、WebSocket、AI 接口、地图接口和房间数据接口均由同一个 Render 服务提供，不再保留其他前端托管平台的适配配置。

创建 Render Web Service 后使用：

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /healthz
```

服务端会自动读取 Render 提供的 `PORT`。建议将生产分支设置为 `main`，并在 GitHub 检查通过后再自动部署。

### Persistent Disk

为了让房间数据在重新部署或服务重启后继续保留，添加 Persistent Disk：

```text
Mount Path: /var/data
```

建议同时设置：

```text
DATA_DIR=/var/data
DATA_FILE=/var/data/rooms.json
```

启动脚本只会在目标房间不存在时导入初始行程。已经存在的线上房间不会再被仓库里的静态行程覆盖。

## DeepSeek 配置

API Key 只能放在 Render 的 Environment 中，不要写进前端或 GitHub 文件。

项目同时支持以下环境变量名称：

```text
DEEPSEEK_API_KEY=你的 API Key
```

或者使用已经配置的名称：

```text
deepseek=你的 API Key
```

启动时，`deepseek` 会自动映射为服务端使用的 `DEEPSEEK_API_KEY`，因此不需要重命名。

可选变量：

```text
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
AI_RATE_LIMIT=12
AI_RATE_WINDOW_MS=600000
AI_CONCURRENCY_LIMIT=3
```

未设置模型时默认使用：

```text
deepseek-chat
```

可以通过以下接口检查配置，但接口不会返回密钥内容：

```text
GET /healthz
GET /api/ai-status
```

## AI 推荐

网页右下角的“AI 推荐”会把所选日期的地点、住宿、事项和偏好发送到本网站服务端，再由服务端调用 DeepSeek。

推荐卡支持：

- 综合体验、省钱、慢游、拍照、美食和历史文化等偏好
- 一键加入所选日期
- 自动同步给同一房间的其他用户
- 直接查看对应日期的地图

AI 推荐不应视为实时营业时间、实时票价、临时闭馆或余票信息，出发前仍需核对官方信息。

## 路线地图

地图支持高德地图和 Google Maps，可在地图面板中选择：

```text
自动
高德
Google
```

服务端会根据当前行程中的城市、住宿、事项地点和事项交通方式生成定位点、路线、距离和时间。点击单日时显示当天路线；点击 list 时显示整份行程单的地点总览。

Render 环境变量：

```text
gaodemap_key=高德地图 Web/API Key
gaodemap_securitycode=高德地图 JS 安全密钥
googlemap=Google Maps API Key
```

兼容变量名：

```text
GAODEMAP_KEY
AMAP_KEY
GAODEMAP_SECURITYCODE
AMAP_SECURITY_CODE
GOOGLEMAP
GOOGLE_MAPS_API_KEY
```

为了提高定位准确率，请填写具体地点，例如：

```text
雅典卫城
罗马斗兽场
圣托里尼伊亚镇
东京 成田机场
浅草寺
```

路线时间优先使用地图服务返回结果。飞机、船或地图服务无法生成路线时，会使用直线距离估算，并在路线摘要中标记“估算”。

建议在高德和 Google 控制台把 key 限制到正式域名：

```text
https://tripdesigner.onrender.com
```

## 编辑界面

编辑面板不再常驻右侧，也不再固定在手机屏幕顶部或底部。

- 点击事项正文：在该事项附近弹出编辑界面
- 点击铅笔或交通按钮：在该事项附近打开对应编辑内容
- 点击“改地点”“改住宿”“加事项”：在对应日期卡片附近弹出
- 点击页面空白处或按 `Esc`：关闭编辑界面
- 标签和预算编辑同样在对应事项附近显示

## 性能优化

当前版本已处理以下主要卡顿来源：

- 限制附加模块的 DOM 观察范围，避免自触发循环重绘
- 将可能互相覆盖全局函数的增强脚本改为 ES Module
- 对标题、地点、住宿、成员名、预算和天数输入进行合并提交
- 长行程使用 `content-visibility`，减少离屏内容渲染开销
- 移除大量长期 `will-change`、重复入场动画和高成本模糊效果
- 保留核心 WebSocket 协作连接，降低无意义的每字符同步

仓库包含 GitHub Actions 烟雾测试，会检查 JavaScript 语法、Node 运行、健康接口以及小写 `deepseek` 环境变量兼容性。

## 安全说明

当前房间采用“拿到链接即可编辑”的模式。AI 推荐接口已经具有基础按 IP 限流和并发保护。正式公开使用前，仍建议继续增加：

- 房间密码
- 只读链接与编辑链接分离
- 管理员删除权限
- 用户级 AI 配额或登录权限
