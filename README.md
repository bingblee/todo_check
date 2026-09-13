# 拾光清单

面向桌面和 Pad 的主题 Todo 与每日打卡应用。支持多账号隔离、scrypt 密码哈希、SQLite 云端单机存储，以及 DeepSeek 日/周总结。

## 本地运行

需要 Node.js 24（或当前 Next.js 支持的 Node.js LTS）和 npm。

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开 `http://localhost:3000`。数据库为空时会进入一次性 `/setup` 页面创建管理员；此后管理员可从“用户管理”创建普通账号。

## DeepSeek

在 `.env.local` 中设置：

```dotenv
DEEPSEEK_API_KEY=your-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

API Key 只在服务端读取，不会发送到浏览器。未配置 Key 时，其余功能仍可使用，总结页会保留确定性统计。

## Docker 单机部署

```bash
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY
docker compose up -d --build
```

所有电脑与 Pad 访问这台服务器的同一 HTTPS 地址。SQLite 文件保存在 `todo_data` 持久卷中；请勿启动多个应用副本共享同一文件。生产环境应在应用前配置 Caddy、Nginx 或云负载均衡器提供 HTTPS。

## Nginx 子路径部署

如果应用通过 `https://example.com/todo/` 提供服务，构建前在 `.env` 中设置：

```dotenv
APP_URL=https://example.com/todo
APP_BASE_PATH=/todo
AUTH_COOKIE_SECURE=true
```

`APP_BASE_PATH` 会在 Next.js 构建时写入前端资源，修改后必须重新执行 `docker compose up -d --build`。Cookie 会按 `/todo` 隔离，避免与同一域名根路径上的其他服务互相覆盖。

Nginx 要保留 `/todo` 前缀并传递外部协议：

```nginx
location = /todo { return 301 /todo/; }

location /todo/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

`proxy_pass` 故意不带末尾 `/`，否则 Nginx 会去掉 `/todo` 前缀，和 Next.js 的 `basePath` 不匹配。若外部站点是 HTTP，将 `AUTH_COOKIE_SECURE` 设置为 `false`；HTTPS 则设置为 `true`。

## 备份

本机运行：

```bash
npm run db:migrate
node scripts/backup.mjs
```

Docker 部署可将数据卷中的数据库复制到安全位置，或在容器内运行备份脚本并挂载独立备份目录。备份脚本使用 SQLite 在线备份 API，可在 WAL 模式下获得一致快照。

## 验证

```bash
npm test
npm run lint
npm run build
```
