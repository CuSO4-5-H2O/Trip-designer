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


