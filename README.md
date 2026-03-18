# App Store Price Radar

基于 Cloudflare Worker 的 Apple App Store 价格监听平台。

核心能力：
- 用户登录与独立订阅管理
- 按国家/地区监听 App 价格
- 价格变化事件入库（仅在价格变化时写入）
- 触发降价后邮件提醒（Resend）
- 前端管理页（Vue3）：订阅、变化历史、降价动态、App 详情页

## 技术栈

- Worker: `Cloudflare Worker` + `Hono`
- Backend: `TypeScript` + `Zod` + `Drizzle ORM`
- Database: `Neon Postgres`
- Mail: `Resend`
- Web: `Vue3` + `Vite` + `Tailwind CSS v4`

## 目录结构

```text
.
├─ apps/
│  ├─ worker/      # API + 定时任务 + Drizzle
│  │  └─ .dev.vars.example
│  └─ web/         # Vue3 前端
├─ .env.example
└─ README.md
```

## 3 分钟本地启动

### 1) 安装依赖

```bash
pnpm install
```

### 2) 复制环境变量模板

```bash
cp .env.example .env
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

### 3) 填环境变量

前后端分开填：
- Worker 变量只放 `apps/worker/.dev.vars`
- Web 变量只放根目录 `.env`

Worker 必填：
- `DATABASE_URL`

Web 必填：
- `VITE_API_BASE=http://127.0.0.1:8787`

Worker 常用可选：
- `RESEND_API_KEY`、`RESEND_FROM_EMAIL`（邮件能力）
- `CRON_SECRET`（手动触发巡检鉴权）
- `SESSION_TTL_DAYS`（默认 30）
- `RESET_PASSWORD_TTL_MINUTES`（默认 30）
- `LOGIN_CODE_TTL_MINUTES`（默认 10）
- `LOGIN_CODE_RESEND_COOLDOWN_SECONDS`（默认 60）
- `PRICE_CHECK_MAX_CALLS_PER_MINUTE`（默认 12）
- `PRICE_CHECK_RETRY_BASE_SECONDS`（默认 15）
- `PRICE_CHECK_RETRY_MAX_SECONDS`（默认 90）
- `PRICE_CHECK_RETRY_JITTER_SECONDS`（默认 5）
- `PRICE_CHECK_MAX_RETRIES`（默认 2）
- `APP_BASE_URL`（默认 `http://localhost:5173`）
- `CORS_ORIGIN`（默认建议 `http://localhost:5173`）

### 4) 初始化数据库

首次建议直接执行 SQL：
- `apps/worker/drizzle/0000_init.sql`

或使用 Drizzle：

```bash
pnpm --filter @appstore-price-radar/worker db:push
```

### 5) 启动开发环境

```bash
pnpm dev
```

默认地址：
- Worker API: `http://127.0.0.1:8787`
- Web: `http://localhost:5173`

手动触发巡检（可选）：

```bash
curl -X POST 'http://127.0.0.1:8787/api/jobs/check' \
  -H 'x-cron-secret: <CRON_SECRET>'
```

## 部署（生产）

### Worker（Cloudflare）

1. 配置 Secrets：

```bash
cd apps/worker
wrangler secret put DATABASE_URL
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put CRON_SECRET
```

2. 在 Cloudflare Dashboard -> `Variables and Secrets` 配置普通 Vars：
- `APP_BASE_URL=https://<your-web-domain>`
- `CORS_ORIGIN=https://<your-web-domain>`
- `SESSION_TTL_DAYS=30`
- `RESET_PASSWORD_TTL_MINUTES=30`
- `LOGIN_CODE_TTL_MINUTES=10`
- `LOGIN_CODE_RESEND_COOLDOWN_SECONDS=60`

3. 部署：

```bash
pnpm --filter @appstore-price-radar/worker deploy
```

关键说明：
- `apps/worker/wrangler.toml` 已设置 `keep_vars = true`，避免每次部署覆盖 Dashboard 里的普通变量。
- `apps/worker/wrangler.toml` 默认 cron 为 `0 */6 * * *`（每 6 小时），降低对 App Store API 的请求压力。
- 本项目不在 `wrangler.toml` 里写 `[vars]`，线上变量以 Dashboard 为准。

### Web（Netlify）

仓库根目录已提供 `netlify.toml`：
- Build command: `pnpm --filter @appstore-price-radar/web build`
- Publish directory: `apps/web/dist`
- SPA 回退：`/* -> /index.html`

Netlify 只需配置：
- `VITE_API_BASE=https://<your-worker-domain>`

## Cloudflare Workers Builds（Git 自动部署）

Worker 的 Build 页面推荐：
- 构建命令：留空
- 部署命令：`npm run deploy`
- 路径：`apps/worker`
- Build Variables / Secrets：留空（这里是构建期，不是运行时）

## 常见故障排查

### 1) Preview 页面空白/请求失败

检查顺序：
1. Netlify `VITE_API_BASE` 是否为 Worker 线上地址
2. Worker `CORS_ORIGIN` 是否包含当前域名（含 Preview 域名）
3. 浏览器 Network 中 `/api/...` 返回是否为 JSON

### 2) 接口 500

检查顺序：
1. Worker `Variables and Secrets` 是否有 `DATABASE_URL`（Secret）
2. 直接访问：`https://<worker-domain>/api/public/drops?limit=1`
3. 查看日志：

```bash
cd apps/worker
npx wrangler tail
```

### 3) Push 后 Worker 变量丢失/被重置

检查：
1. `apps/worker/wrangler.toml` 是否包含 `keep_vars = true`
2. 是否误在 `wrangler.toml` 写了 `[vars]`
3. 你看的是否是正确的环境（Production vs Preview）

## API 概览

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/send-login-code`
- `POST /api/auth/verify-login-code`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/subscriptions`
- `GET /api/subscriptions`
- `DELETE /api/subscriptions/:id`
- `GET /api/prices/:appId?country=US&limit=3650`
- `POST /api/jobs/check`
- `GET /api/public/drops?country=US&limit=50&dedupe=1`

## 核心逻辑

1. 定时任务拉取全部 active 订阅 `(appId, country)` 去重列表。
2. 调用 iTunes Lookup API 查询最新价格。
3. 写入快照表；仅当价格变化时写入变化事件表。
4. 若 `newPrice < oldPrice`，按订阅规则筛选并发邮件。
5. 前端基于变化事件展示趋势与关键跌幅指标，并提供每个 App 的详情页。
