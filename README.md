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
