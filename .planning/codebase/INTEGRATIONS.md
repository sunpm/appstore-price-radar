# 外部集成映射

## 数据库集成
- 主数据库是 PostgreSQL，连接入口由 `apps/worker/src/env.ts` 中的 `DATABASE_URL` 提供。
- Worker 通过 `apps/worker/src/db/client.ts` 使用 `@neondatabase/serverless` 创建 `neon()` 客户端，再交给 `drizzle-orm/neon-http`。
- Drizzle schema 在 `apps/worker/src/db/schema.ts`，包含 `users`、`user_sessions`、`password_reset_tokens`、`login_codes`、`subscriptions`、`app_snapshots`、`app_price_change_events`、`app_drop_events`。
- SQL 迁移目录是 `apps/worker/drizzle`，当前可见 `apps/worker/drizzle/0000_init.sql` 与 `apps/worker/drizzle/0001_price_change_events.sql`。
- `apps/worker/drizzle.config.ts` 会从根目录 `.env`、`apps/worker/.dev.vars` 等位置尝试加载 `DATABASE_URL`，说明本地命令与 Worker 运行时共用连接线索，但来源文件可不同。

## Apple App Store API
- 外部价格源来自 Apple iTunes Lookup API，封装在 `apps/worker/src/lib/appstore.ts`。
- 实际请求目标是 `https://itunes.apple.com/lookup?id=<appId>&country=<country>`，请求时带了自定义 `user-agent: appstore-price-radar/1.0`。
- `apps/worker/src/lib/appstore.ts` 会把响应解析成内部 `AppStorePrice` 结构，并回填 `trackName`、`price`、`currency`、`trackViewUrl`、`artworkUrl100` 等字段。
- `apps/worker/src/lib/checker.ts` 的 `refreshSingleApp()` 与 `runPriceCheck()` 是这个第三方 API 的主要调用方。
- `apps/worker/test/scheduler.rate-limit.test.ts` 与 `apps/worker/src/lib/checker.ts` 共同说明该集成带有限流、退避和重试策略，避免过高调用频率。

## 邮件服务集成
- 邮件服务使用 Resend，客户端构建在 `apps/worker/src/lib/email-client.ts`，运行依赖 `RESEND_API_KEY` 与 `RESEND_FROM_EMAIL`。
- 价格下跌提醒邮件由 `apps/worker/src/lib/alerts.ts` 生成并发送。
- 密码重置邮件与登录验证码邮件由 `apps/worker/src/lib/auth-emails.ts` 负责。
- 邮件模板骨架在 `apps/worker/src/lib/email-template.ts`，说明邮件内容不是直接调用第三方模板系统，而是在 Worker 内拼接 HTML/Text 双版本。
- `APP_BASE_URL` 会被 `apps/worker/src/lib/auth-emails.ts` 用来生成密码重置页面链接，因此它同时是邮件系统和前端域名之间的桥接变量。

## 前端到后端 API 集成
- 前端统一通过 `apps/web/src/lib/http.ts` 中的 `buildApiUrl()` 拼接 API 地址，底层依赖根 `.env` 中的 `VITE_API_BASE`。
- 本地开发时 `apps/web/vite.config.ts` 将 `/api` 代理到 `http://127.0.0.1:8787`，而生产通常直接由 `VITE_API_BASE` 指向 Worker 域名。
- 公开数据流主要由 `apps/web/src/views/home/HomeView.vue` 请求 `/api/public/drops`。
- 应用详情页由 `apps/web/src/views/app/AppDetailView.vue` 请求 `/api/prices/:appId`。
- 用户态页面 `apps/web/src/views/auth/AuthView.vue`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue` 会调用 `/api/auth/*`、`/api/subscriptions`、`/api/prices/*`。

## 认证与会话集成
- 认证是自建邮箱账号体系，不依赖 Auth0、Clerk、Firebase Auth 等外部身份提供商；实现集中在 `apps/worker/src/routes/auth.ts` 与 `apps/worker/src/services/auth.ts`。
- 登录方式同时支持“邮箱 + 密码”与“邮箱验证码”，接口分别见 `POST /api/auth/login`、`POST /api/auth/send-login-code`、`POST /api/auth/verify-login-code`，实现文件是 `apps/worker/src/routes/auth.ts`。
- 注册要求先拿邮箱验证码，再调用 `POST /api/auth/register`，对应逻辑在 `apps/worker/src/services/auth.ts`。
- 密码散列逻辑在 `apps/worker/src/lib/auth.ts`，当前新密码使用 `pbkdf2_sha256_v1` 方案和 100000 次迭代，同时兼容历史 120000 次迭代哈希。
- 会话并非 Cookie Session，而是 Bearer Token 模式；Token 由 `apps/worker/src/services/auth.ts` 生成，哈希后落库在 `user_sessions`。
- 后端鉴权中间件在 `apps/worker/src/middleware/auth.ts`，从 `Authorization: Bearer <token>` 读取令牌并校验。
- 前端令牌存储在浏览器 `localStorage`，实现见 `apps/web/src/lib/auth-session.ts`，键名为 `price-radar-token`。

## 定时任务与手动触发
- 定时任务入口是 `apps/worker/src/index.ts` 的 `scheduled` handler，实际执行逻辑是 `runPriceCheck(config)`。
- 生产 cron 配置位于 `apps/worker/wrangler.toml`，当前表达式为 `0 */6 * * *`。
- 同一套价格巡检逻辑也暴露了手动触发入口 `POST /api/jobs/check`，见 `apps/worker/src/index.ts`。
- 手动触发支持通过请求头 `x-cron-secret` 做鉴权，校验变量是 `CRON_SECRET`。
- `apps/worker/src/lib/checker.ts` 为巡检加入了每分钟最大调用数、指数退避、抖动和最大重试次数等保护参数。

## CORS 与跨域边界
- API 跨域配置在 `apps/worker/src/index.ts`，使用 `hono/cors` 中间件处理 `/api/*`。
- 允许的请求头包含 `Content-Type`、`Authorization`、`x-cron-secret`，说明浏览器鉴权与手动任务触发都考虑到了跨域场景。
- 具体 origin 决策由 `apps/worker/src/lib/cors.ts` 与环境变量 `CORS_ORIGIN` 控制。
- `README.md` 里多次强调 Netlify 域名与 Preview 域名要纳入 `CORS_ORIGIN`，这属于部署时必须同步的集成点。

## Webhook 观察
- 代码库中没有发现 Stripe、GitHub、Slack、Resend Webhook 等入站 webhook 路由；现有 `apps/worker/src/routes` 只包含 `auth`、`public`、`prices`、`subscriptions`。
- 也没有发现专门的 webhook 签名校验逻辑或回调处理目录，说明当前系统以主动轮询 App Store 为主，不依赖第三方事件推送。
- 出站方向上，邮件发送属于 API 调用而非 webhook。

## 第三方静态资源
- `apps/web/src/style.css` 通过 `@import url('https://fonts.googleapis.com/...')` 集成 Google Fonts。
- 这意味着前端首屏展示依赖 Google Fonts 可访问性；若目标环境受限，字体回退会落到本地字体栈。

## 环境变量线索
- Web 侧显式变量只有 `VITE_API_BASE`，定义示例在 `.env.example`。
- Worker 侧示例变量在 `apps/worker/.dev.vars.example`，包括 `DATABASE_URL`、`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`CRON_SECRET`、`APP_BASE_URL`、`CORS_ORIGIN`。
- 巡检节流与重试参数也通过环境变量暴露：`PRICE_CHECK_MAX_CALLS_PER_MINUTE`、`PRICE_CHECK_RETRY_BASE_SECONDS`、`PRICE_CHECK_RETRY_MAX_SECONDS`、`PRICE_CHECK_RETRY_JITTER_SECONDS`、`PRICE_CHECK_MAX_RETRIES`，校验逻辑在 `apps/worker/src/env.ts`。
- 认证时效参数包括 `SESSION_TTL_DAYS`、`RESET_PASSWORD_TTL_MINUTES`、`LOGIN_CODE_TTL_MINUTES`、`LOGIN_CODE_RESEND_COOLDOWN_SECONDS`，同样在 `apps/worker/src/env.ts` 定义。
- 文档和示例文件都没有提交真实密钥，真实值应通过 `apps/worker/.dev.vars`、Cloudflare Dashboard Secrets 或 Netlify 环境变量注入，线索见 `README.md`、`.env.example`、`apps/worker/.dev.vars.example`。

## 集成结论
- 这个项目的核心外部依赖只有三类：Neon Postgres、Apple iTunes Lookup API、Resend。
- 鉴权完全自建，浏览器与 Worker 之间通过 Bearer Token 协作，不依赖第三方身份服务。
- 任务触发以 Cloudflare Cron 为主，必要时可通过受 `CRON_SECRET` 保护的 HTTP 接口手动补跑。
- 当前没有 webhook 驱动链路，系统更像“定时采集 + 数据库持久化 + 条件通知”的主动监控架构。
