# App Store Price Radar

一个基于 Cloudflare Worker 的 Apple App Store 价格监听系统：

- 登录与每用户独立订阅管理
- 监听指定 App 的价格（按国家/地区）
- 持续记录价格历史到 Neon Postgres
- 发现降价后，用 Resend 发送邮件提醒
- 提供 Vue3 前端页面管理订阅和查看历史（按天聚合图表、最低价标注、跌幅百分比）

## 技术栈

- `Cloudflare Worker` + `Hono`
- `TypeScript` + `Zod`
- `Neon Postgres` + `Drizzle ORM`
- `Resend`（邮件）
- `Vue3` + `Vite` + `Tailwind CSS v4`

## 目录结构

```text
.
├─ apps/
│  ├─ worker/      # Hono API + 定时任务 + Drizzle
│  │  └─ .dev.vars.example
│  └─ web/         # Vue3 前端
├─ .env.example
└─ README.md
```

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

本地开发建议准备两份环境变量文件：

```bash
cp .env.example .env
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

填写规则：

- `apps/worker/.dev.vars`：给 `wrangler dev`（Worker 本地运行）使用。
- 根目录 `.env`：给前端 `VITE_API_BASE` 使用，也可作为 Drizzle CLI 的备用来源。
- Worker 相关变量建议优先写到 `apps/worker/.dev.vars`。

| 变量名 | 作用 | 生效端 | 本地建议写入 | 是否必填 | 示例 |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Neon Postgres 连接串，Worker 读写订阅和价格历史都依赖它 | Worker + Drizzle CLI | `apps/worker/.dev.vars`（推荐） | `是` | `postgres://user:pass@host/db?sslmode=require` |
| `RESEND_API_KEY` | Resend API Key，用于发送降价邮件 | Worker | `apps/worker/.dev.vars` | `仅发邮件时必填` | `re_xxxxxxxxx` |
| `RESEND_FROM_EMAIL` | 发件人邮箱，必须是 Resend 已验证域名下地址 | Worker | `apps/worker/.dev.vars` | `仅发邮件时必填` | `alerts@yourdomain.com` |
| `CRON_SECRET` | 手动调用 `POST /api/jobs/check` 的鉴权密钥 | Worker | `apps/worker/.dev.vars` | `建议必填` | `replace-with-strong-secret` |
| `SESSION_TTL_DAYS` | 登录会话有效期（天），默认 30，范围 1-90 | Worker | `apps/worker/.dev.vars` | `否` | `30` |
| `RESET_PASSWORD_TTL_MINUTES` | 重置密码 token 有效期（分钟），默认 30，范围 5-120 | Worker | `apps/worker/.dev.vars` | `否` | `30` |
| `LOGIN_CODE_TTL_MINUTES` | 邮箱验证码有效期（分钟），默认 10，范围 2-60 | Worker | `apps/worker/.dev.vars` | `否` | `10` |
| `APP_BASE_URL` | 前端站点地址（预留给邮件链接和跳转） | Worker | `apps/worker/.dev.vars` | `否` | `http://localhost:5173` |
| `CORS_ORIGIN` | 允许跨域访问 API 的来源地址 | Worker | `apps/worker/.dev.vars` | `建议必填` | `http://localhost:5173` |
| `VITE_API_BASE` | 前端请求后端 API 的基础地址 | Web | `.env` | `是` | `http://127.0.0.1:8787` |

说明：

- `RESEND_API_KEY` 或 `RESEND_FROM_EMAIL` 未配置时，价格仍会抓取和入库，但不会发送邮件提醒。
- `忘记密码/重置密码` 与 `邮箱验证码登录` 依赖邮件能力，因此也需要 `RESEND_API_KEY` + `RESEND_FROM_EMAIL`。
- `CRON_SECRET` 未配置时，`/api/jobs/check` 不做额外鉴权，不建议用于生产环境。
- `drizzle-kit`（`db:push` / `db:generate`）会自动尝试加载：
  - `apps/worker/.dev.vars`
  - `apps/worker/.env`
  - 仓库根 `.env`
- 因此不需要再手动 `export DATABASE_URL=...`。

### 3) 初始化数据库

首次初始化可选两种方式（你还没跑 SQL，建议直接用 `0000_init.sql`）：

1. 直接执行 SQL：`apps/worker/drizzle/0000_init.sql`
2. 使用 Drizzle push：

```bash
pnpm --filter @appstore-price-radar/worker db:push
```

### 4) 启动开发环境

```bash
pnpm dev
```

默认端口：

- Worker API: `http://127.0.0.1:8787`
- Vue 页面: `http://localhost:5173`

### 5) 本地使用流程

1. 打开 `http://localhost:5173/` 查看全站降价首页（公开）
2. 打开 `http://localhost:5173/auth` 进入登录/注册页（含邮箱验证码登录、忘记密码/重置密码）
3. 登录后进入 `http://localhost:5173/profile` 管理你的监听、目标价和价格历史图表
4. 如需测试手动巡检，可调用：

```bash
curl -X POST 'http://127.0.0.1:8787/api/jobs/check' \\
  -H 'x-cron-secret: <CRON_SECRET>'
```

## API 概览

- `GET /api/health`
- `POST /api/auth/register`
  - body: `{ email, password }`
- `POST /api/auth/login`
  - body: `{ email, password }`
- `POST /api/auth/forgot-password`
  - body: `{ email }`
- `POST /api/auth/reset-password`
  - body: `{ token, password }`
- `POST /api/auth/send-login-code`
  - body: `{ email }`
- `POST /api/auth/verify-login-code`
  - body: `{ email, code }`
- `GET /api/auth/me`
  - header: `Authorization: Bearer <token>`
- `POST /api/auth/logout`
  - header: `Authorization: Bearer <token>`
- `POST /api/subscriptions`
  - header: `Authorization: Bearer <token>`
  - body: `{ appId, country?, targetPrice? }`
  - `appId` 支持纯数字或 App Store URL（会自动提取 `id123456`）
- `GET /api/subscriptions`
  - header: `Authorization: Bearer <token>`
- `DELETE /api/subscriptions/:id`
  - header: `Authorization: Bearer <token>`
- `GET /api/prices/:appId?country=US&limit=3650`
  - header: `Authorization: Bearer <token>`（前端默认带上）
- `POST /api/jobs/check`
  - header: `x-cron-secret: <CRON_SECRET>`（如果设置了 `CRON_SECRET`）
- `GET /api/public/drops?country=US&limit=50&dedupe=1`
  - 无需登录
  - 默认 `dedupe=1`：按 `(appId, country)` 去重，只返回每个 App 的最新一条降价记录
  - 返回历史降价记录（即使后续涨价也不会删除该记录）

## 定时检查

`apps/worker/wrangler.toml` 已配置：

```toml
[triggers]
crons = ["*/30 * * * *"]
```

表示每 30 分钟抓取一次所有 active 订阅对应 App 的价格。

## 部署建议

### Worker

1. 配置生产环境变量（`DATABASE_URL`、`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`CRON_SECRET`、`APP_BASE_URL`、`CORS_ORIGIN` 等）。
2. 先在生产数据库执行初始化 SQL（或 `db:push`）。
3. 部署 Worker：

```bash
pnpm --filter @appstore-price-radar/worker deploy
```

并通过 Wrangler 设置 secrets：

```bash
cd apps/worker
wrangler secret put DATABASE_URL
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put CRON_SECRET
wrangler secret put APP_BASE_URL
wrangler secret put CORS_ORIGIN
wrangler secret put SESSION_TTL_DAYS
wrangler secret put RESET_PASSWORD_TTL_MINUTES
wrangler secret put LOGIN_CODE_TTL_MINUTES
```

### Web

`apps/web` 可以部署到 Cloudflare Pages / Vercel / Netlify，设置：

- `VITE_API_BASE=https://<your-worker-domain>`

## 生产环境建议值

- `SESSION_TTL_DAYS=14` 或 `30`
- `RESET_PASSWORD_TTL_MINUTES=30`
- `LOGIN_CODE_TTL_MINUTES=10`
- `CORS_ORIGIN` 精确到你的前端域名，不要设为 `*`
- `APP_BASE_URL` 必须是生产前端地址（用于密码重置邮件链接）

## 核心逻辑说明

1. 定时任务拉取所有活跃订阅的 `(appId, country)` 去重列表。
2. 调用 iTunes Lookup API 查询最新价格。
3. 写入 `app_snapshots`（当前快照）与 `app_price_history`（历史记录）。
4. 若检测到 `newPrice < oldPrice`，筛选符合条件的订阅并发邮件：
   - `targetPrice` 为空，或 `newPrice <= targetPrice`
   - 未通知过，或本次价格低于上次已通知价格
5. 前端图表将历史价格按“天”聚合为每日最低价，并展示：
   - 历史最低价标注（LOW）
   - 当前价相对历史最高价跌幅
   - 当前价相对首日价格跌幅

## 后续可扩展

- OAuth 登录（Google / Apple）
- 价格异常波动检测（突降、突涨）
- 多维统计视图（日/周/月）
- Telegram/Slack/微信等多渠道通知
