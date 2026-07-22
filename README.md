# Chat Web 前端

这是项目的一个最小静态网页前端，放在 `Web/` 目录下。

快速开始：

1. 在项目根目录运行一个静态文件服务器（任选其一）：

```bash
# 使用 Python 3
python -m http.server 8000 --directory Web

# 或使用 http-server（需安装 Node.js）
npx http-server Web -p 8000
```

2. 在浏览器打开 `http://localhost:8000`。

3. 本项目已预设 `API_URL` 指向 `https://chat.zztxer.dpdns.org/api/messages`。前端额外包含一键下载安装按钮：

- Android 下载域名： `https://chat-apk.zztxer.dpdns.org`
- Windows 下载域名： `https://chat-windows.zztxer.dpdns.org`

4. Cloudflare Worker 上传配置：文件 `wconfig.jsonc`（位于 `Web/`）已包含 `routes` 示例，指向 `chat.zztxer.dpdns.org/api/messages`。如需直接使用 `wrangler`，请根据你的账号和绑定域调整 `wrangler.toml`。

注意：后端需要接受 `POST` 请求，Content-Type: `application/json`，body 格式 `{ "message": "..." }`，并返回 JSON 如 `{ "reply": "..." }`。
