# 同行日程

一个可以多人实时协作的行程网页。把同一个 `?room=` 链接发给朋友，大家打开后可以一起修改同一份行程单。

## 本地运行

```powershell
& 'C:\Users\19839\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.\server.js'
```

然后打开：

```text
http://localhost:4177
```

同一个 `?room=` 链接里的用户会实时同步修改。数据会保存到本地 `data/rooms.json`。

## 部署到 Render

推荐用 Render 的 Web Service 部署，这样你会得到一个长期可访问的公网链接，例如：

```text
https://your-trip-planner.onrender.com/?room=5E114D33
```

### 1. 上传代码到 GitHub

把 `trip-planner-web` 这个文件夹作为一个 GitHub 仓库上传，至少需要包含这些文件：

```text
index.html
styles.css
app.js
server.js
package.json
.gitignore
README.md
```

### 2. 创建 Render Web Service

在 Render 控制台选择：

```text
New > Web Service
```

连接你的 GitHub 仓库后，设置：

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

`server.js` 已经会自动读取 Render 提供的 `PORT`，不需要手动写端口。

### 3. 添加 Persistent Disk

为了让房间和行程在 Render 重启、重新部署之后还存在，需要给服务添加 Persistent Disk：

```text
Mount Path: /var/data
```

当前服务在 Render 上会自动把数据保存到：

```text
/var/data/rooms.json
```

如果不添加 Persistent Disk，实时协作依然能用，但服务重启后数据会丢。

### 4. 分享链接

部署成功后，把 Render 的网址加上房间参数发给朋友：

```text
https://your-trip-planner.onrender.com/?room=5E114D33
```

同一个 room 链接里的所有人都可以直接修改并同步。

## AI 推荐与路线地图

网站右下角提供两个入口：

- `路线地图`：按天或按整份行程查看地点标记和连接路线。
- `AI 推荐`：把当天地点、住宿和事项发送到网站服务端，再由服务端调用 DeepSeek 生成当地景点、餐饮和体验建议。

AI 推荐卡支持：

- 选择综合体验、省钱、慢游、拍照、美食或历史文化偏好。
- 一键把推荐加入所选日期。
- 新增事项自动同步给同一个房间里的其他用户。
- 跳转到对应日期的地图。

### Render 环境变量

在 Render Dashboard 的 `Environment` 页面添加：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
```

可选设置：

```text
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
TRIP_DESIGNER_CONTACT=用于地图服务联系的邮箱
NOMINATIM_USER_AGENT=TripDesigner/1.0 (your-contact@example.com)
```

保存环境变量后，需要让 Render 重新部署或重启服务。API Key 只由 `server.js` 读取，不要写进 `index.html`、`config.js`、任何前端 JavaScript 文件或 `data/rooms.json`。

可以访问以下接口检查配置：

```text
GET /healthz
GET /api/ai-status
```

`/api/ai-status` 只返回是否已配置以及模型名称，不会返回 API Key。

### 地图说明

地图使用 Leaflet 显示 OpenStreetMap 底图，并由服务端通过 Nominatim 把事项地点转换为经纬度。为了提高定位准确率，事项地点建议填写完整名称，例如：

```text
雅典卫城
罗马斗兽场
圣托里尼伊亚镇
```

当前路线按照事项在行程中的顺序连接，适合查看一天内的大致空间关系。飞机、火车、渡轮和跨城市线路仅作示意，不代表实时导航线路。

AI 推荐可能不包含最新营业时间、票价、临时闭馆和实时余票，出发前仍应核对景点、餐厅或交通运营方的官方信息。

## GitHub Pages + Cloudflare 域名 + Render 后端

如果你想把入口放在自己的域名上，例如 GitHub Pages 绑定 `dpdns` 域名，再把域名托管到 Cloudflare，可以这样做：

### 1. Render 只当同步后端

先按上面的 Render 步骤部署一次。假设 Render 地址是：

```text
https://your-trip-planner.onrender.com
```

WebSocket 同步地址就是：

```text
wss://your-trip-planner.onrender.com/sync
```

### 2. GitHub Pages 只放前端

把这些静态文件发布到 GitHub Pages：

```text
index.html
styles.css
app.js
config.js
```

`server.js` 和 `package.json` 是 Render 后端用的，GitHub Pages 不会运行它们。

### 3. 配置前端连接 Render

编辑 `config.js`：

```js
window.TRIP_PLANNER_CONFIG = {
  syncEndpoint: "wss://your-trip-planner.onrender.com/sync",
};
```

这样即使网页地址是 GitHub Pages 或 Cloudflare 域名，实时同步也会连接到 Render 后端。

需要注意：如果前端托管在 GitHub Pages，而 AI 和地图接口仍在 Render，则还需要把前端的 `/api/...` 请求改为完整的 Render 地址，或者通过 Cloudflare 反向代理把 `/api` 转发到 Render。直接使用 Render 同时托管前后端时不需要额外配置。

### 4. 绑定 Cloudflare 域名

在 GitHub Pages 设置里添加你的自定义域名，例如：

```text
trip.example.com
```

然后到 Cloudflare DNS 里添加 CNAME：

```text
Name: trip
Target: your-github-name.github.io
Proxy status: DNS only 或 Proxied 都可以先试 DNS only
```

等 GitHub Pages HTTPS 证书签发完成后，再开启 Enforce HTTPS。

### 5. 分享给朋友

最后分享你的 Cloudflare 域名链接：

```text
https://trip.example.com/?room=5E114D33
```

朋友打开后看到的是你的域名，但数据同步和保存由 Render 后端负责。

也可以临时用 URL 参数覆盖同步地址：

```text
https://trip.example.com/?room=5E114D33&sync=wss://your-trip-planner.onrender.com/sync
```

## 可选环境变量

```text
DATA_DIR=/var/data
DATA_FILE=/var/data/rooms.json
```

建议在 Render 的 Environment 里显式设置 `DATA_DIR=/var/data`，这样即使平台环境变量变化，也会固定写入 Persistent Disk。

## 注意

目前这个应用是“拿到链接即可编辑”的模式。真实长期使用时，建议后续再加：

- 房间密码
- 只读分享链接和可编辑链接分开
- 删除行程单的管理员权限
- AI 接口的账户级限流或访问权限
