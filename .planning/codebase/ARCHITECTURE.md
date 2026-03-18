# 架构总览

## 系统形态
- 这是一个 `pnpm` workspace，根目录通过 `package.json` 与 `pnpm-workspace.yaml` 管理两个应用：`apps/web` 与 `apps/worker`。
- `apps/web` 是基于 `Vue 3 + Vite + Vue Router + Tailwind CSS v4` 的前端 SPA。
- `apps/worker` 是基于 `Cloudflare Worker + Hono + Drizzle ORM + Neon Postgres` 的 API 与定时任务服务。
- 系统目标是围绕 App Store 价格监听构建完整闭环：订阅、抓价、变更事件、公开降价流、邮件提醒与前端展示。

## 系统入口
- Workspace 级入口在根目录 `package.json`，`pnpm dev` 通过 `concurrently` 同时启动 `apps/web` 与 `apps/worker`。
- 前端运行入口是 `apps/web/src/main.ts`，创建 Vue 应用后挂载 `App.vue`，再接入 `apps/web/src/router.ts`。
- 前端页面壳入口是 `apps/web/src/layouts/MainLayout.vue`，负责顶部导航、登录弹窗和主内容 `RouterView`。
- Worker 运行入口是 `apps/worker/src/index.ts`，这里初始化 `Hono<AppEnv>()`、注入中间件、挂载路由，并导出 `fetch` 与 `scheduled`。
- Worker 部署入口在 `apps/worker/wrangler.toml`，`main = "src/index.ts"`，并定义 `0 */6 * * *` 的定时触发。

## Worker 分层

### 1. 启动与环境层
- `apps/worker/src/index.ts` 先对 `/api/*` 注入环境解析中间件，调用 `apps/worker/src/env.ts` 的 `parseEnv` 将运行时变量收敛为 `EnvConfig`。
- `apps/worker/src/types.ts` 定义 `WorkerBindings` 与 `AppEnv`，把 `config`、`authUser`、`sessionId` 这些上下文变量显式挂到 Hono 上下文中。
- `apps/worker/src/lib/cors.ts` 与 `apps/worker/src/index.ts` 共同处理 CORS 边界，允许前端与手动 job 触发请求进入 API。

### 2. 路由层
- 路由目录在 `apps/worker/src/routes`，每个文件围绕一个域建路由并做输入校验。
- `apps/worker/src/routes/auth.ts` 负责注册、密码登录、验证码登录、忘记密码、改密、登出、`/me`。
- `apps/worker/src/routes/subscriptions.ts` 负责创建、列出、删除订阅，并统一挂载 `requireAuth`。
- `apps/worker/src/routes/prices.ts` 负责某个 `(appId, country)` 的历史价格与当前快照读取。
- `apps/worker/src/routes/public.ts` 负责公开降价流 `GET /api/public/drops`。
- 路由层普遍使用 `@hono/zod-validator` 和 `apps/worker/src/lib/zod.ts` 中的辅助 schema 工具，职责是“验参 + 调 service + 返回 HTTP 状态”。

### 3. 业务服务层
- 服务目录在 `apps/worker/src/services`，核心原则是“一类业务一个文件”，对外统一返回 `{ status, body }`。
- `apps/worker/src/services/auth.ts` 封装用户查找、会话创建、验证码消费、密码重置、改密、登出等账号行为。
- `apps/worker/src/services/subscriptions.ts` 封装订阅的增删查；创建后会立即调用 `apps/worker/src/lib/checker.ts` 的 `refreshSingleApp` 拉一次最新价格。
- `apps/worker/src/services/prices.ts` 读取 `app_snapshots` 与 `app_price_change_events`，拼成单应用详情页所需的快照 + 历史结果。
- `apps/worker/src/services/public.ts` 从 `app_drop_events` 读取公开降价流，并联表统计活跃订阅数。
- `*.types.ts` 文件和对应服务同目录放置，例如 `apps/worker/src/services/subscriptions.types.ts`，用于显式收敛响应结构。

### 4. 基础能力层
- `apps/worker/src/lib/appstore.ts` 是外部 App Store 查询适配器，负责提取 `appId`、调用 iTunes Lookup API、校验响应并标准化返回。
- `apps/worker/src/lib/checker.ts` 是价格巡检核心抽象，封装单应用刷新 `refreshSingleApp` 与全量巡检 `runPriceCheck`。
- `apps/worker/src/lib/alerts.ts`、`apps/worker/src/lib/email-client.ts`、`apps/worker/src/lib/auth-emails.ts` 组成邮件发送边界，统一走 Resend。
- `apps/worker/src/lib/auth.ts` 负责密码哈希、会话 token 生成与 Bearer 解析，是认证能力的底层库。
- `apps/worker/src/middleware/auth.ts` 是受保护接口的统一认证边界，校验 `Authorization: Bearer <token>`，解析用户并刷新 `lastUsedAt`。

### 5. 数据访问层
- `apps/worker/src/db/client.ts` 的 `getDb` 是数据库访问单入口，基于 `DATABASE_URL` 创建 Neon HTTP 驱动并绑定 Drizzle schema。
- `apps/worker/src/db/schema.ts` 定义所有核心表：`users`、`user_sessions`、`password_reset_tokens`、`login_codes`、`subscriptions`、`app_snapshots`、`app_price_change_events`、`app_drop_events`。
- SQL 迁移落在 `apps/worker/drizzle/0000_init.sql` 与 `apps/worker/drizzle/0001_price_change_events.sql`，结构演进依赖 `apps/worker/drizzle.config.ts`。

## Web 分层

### 1. 应用与路由层
- `apps/web/src/main.ts` 只做应用装配，保持非常薄。
- `apps/web/src/router.ts` 定义前端路由图：`/`、`/apps/:appId/:country`、`/profile`、`/security`、`/auth`。
- 同文件的 `beforeEach` 只做一件事：通过 `apps/web/src/lib/auth-session.ts` 判断本地 token，阻止未登录用户进入受保护页面。
- `apps/web/src/App.vue` 保留根级 `RouterView` 和全局 Toast 视口 `apps/web/src/components/feedback/AppToastViewport.vue`。

### 2. 页面与局部组件层
- 页面主视图集中在 `apps/web/src/views`，按业务域拆成 `home`、`app`、`auth`、`profile`、`security`。
- 每个视图目录通常自带 `types.ts`，复杂页面还会继续拆 `components/`、`composables/`、`constants.ts`，例如 `apps/web/src/views/auth`。
- `apps/web/src/layouts/MainLayout.vue` 是跨页面壳层，负责导航、登录态感知和 modal 登录入口。
- 这种结构让页面逻辑以“视图目录”为边界收拢，而不是把所有组件扁平堆在全局目录。

### 3. 前端基础库层
- `apps/web/src/lib/http.ts` 负责根据 `VITE_API_BASE` 拼接请求地址，并统一解析错误消息。
- `apps/web/src/lib/auth-session.ts` 负责浏览器本地 token 存储，使用 `localStorage` 和自定义事件 `price-radar-auth-token-changed` 同步登录状态。
- `apps/web/src/lib/toast.ts` 是轻量全局反馈通道，供各页面在 watch 错误/成功状态时复用。
- `apps/web/src/lib/format.ts` 统一金额与时间展示，减少各页面重复格式化逻辑。

## 关键数据流

### 公开降价流
- 定时任务或手动巡检先由 `apps/worker/src/lib/checker.ts` 刷新快照。
- 如果发现价格下降，`refreshSingleApp` 会写入 `app_drop_events` 与 `app_price_change_events`。
- `apps/worker/src/services/public.ts` 从 `app_drop_events` 查询最近降价，并聚合 `subscriptions` 统计关注人数。
- `apps/web/src/views/home/HomeView.vue` 调用 `GET /api/public/drops`，渲染首页公开市场动态。

### 单应用详情流
- 前端从 `apps/web/src/views/app/AppDetailView.vue` 读取路由参数 `appId` 与 `country`。
- 该页面请求 `GET /api/prices/:appId?country=XX&limit=3650`。
- `apps/worker/src/services/prices.ts` 返回 `app_snapshots` 中的当前快照，以及 `app_price_change_events` 中的时间序列。
- 前端在本地计算折线图点位、峰值、最低点和跌幅，不把图表计算逻辑放回 Worker。

### 认证与会话流
- 注册/验证码登录/密码登录入口都在 `apps/web/src/views/auth/AuthView.vue`。
- Worker 路由 `apps/worker/src/routes/auth.ts` 将请求交给 `apps/worker/src/services/auth.ts`。
- 认证服务使用 `apps/worker/src/lib/auth.ts` 生成或验证密码 hash，并把 session token 的 hash 存入 `user_sessions`。
- 前端只保留明文 token 于 `localStorage`，后续通过 Bearer Token 请求 `GET /api/auth/me`、`POST /api/auth/logout`、`POST /api/auth/change-password` 等接口。
- `apps/worker/src/middleware/auth.ts` 负责把 token 映射回用户并注入 `authUser`、`sessionId`。

### 订阅创建与即时刷新流
- `apps/web/src/views/profile/ProfileView.vue` 调用 `POST /api/subscriptions` 创建或更新订阅规则。
- `apps/worker/src/services/subscriptions.ts` 会对 `(userId, appId, country)` 做 upsert，避免重复订阅记录。
- 同一次创建流程里会触发 `refreshSingleApp(config, appId, country, { notifyDrops: false })`，目的是立刻拿到快照，但不在人工创建时发降价提醒。
- 随后 `GET /api/subscriptions` 通过左连接 `app_snapshots` 返回任务列表所需的 App 名称、价格、图标等展示信息。

### 定时巡检与提醒流
- Cloudflare cron 触发 `apps/worker/src/index.ts` 的 `scheduled` 处理器，也可以手动调用 `POST /api/jobs/check`。
- `apps/worker/src/lib/checker.ts` 的 `runPriceCheck` 会先从 `subscriptions` 选出去重后的 `(appId, country)` 列表。
- 每个 pair 调 `fetchAppStorePrice` 拉取 App Store 当前价格，再更新 `app_snapshots`。
- 当旧价格与新价格不同，会写 `app_price_change_events`；当出现降价，还会写 `app_drop_events`。
- 若当前价格满足订阅规则且低于 `lastNotifiedPrice`，则调用 `sendDropAlertEmail` 发送邮件，并更新 `subscriptions.lastNotifiedPrice`，避免重复提醒。
- 调度链路内置节流和退避：`PRICE_CHECK_MAX_CALLS_PER_MINUTE` 控速，429/5xx 通过指数退避重试；对应约束由 `apps/worker/test/scheduler.rate-limit.test.ts` 覆盖。

## 边界与职责
- `apps/web` 不直接访问数据库，也不接触 Resend 或 App Store；它只消费 Worker 暴露的 HTTP API。
- `apps/worker` 不负责图表 UI、筛选交互或本地会话弹窗；它只提供 API、定时任务与外部系统集成。
- 数据库边界只在 `apps/worker/src/db` 与 `apps/worker/src/services` 之间流动，前端只看到序列化后的 JSON。
- App Store 与 Resend 都被封装在 `apps/worker/src/lib`，避免路由或页面直接耦合第三方协议。
- 手动操作与定时操作共用 `refreshSingleApp`，但通过 `notifyDrops` 与 `source` 参数区分语义。

## 关键抽象
- `EnvConfig`：定义 Worker 所有运行时配置，是服务、数据库和邮件能力的统一输入。
- `AppEnv`：Hono 上下文类型，确保 `config`、`authUser`、`sessionId` 等变量在中间件与路由间可类型安全传递。
- `getDb(config)`：数据库获取单入口，简化服务层依赖。
- `refreshSingleApp`：单应用刷新原语，被订阅创建流程与定时巡检流程复用。
- `runPriceCheck`：巡检编排原语，负责批处理、节流、重试和统计报告。
- `requireAuth`：认证边界原语，所有私有路由通过它解析登录用户。
- `extractAppId`：输入归一化原语，使前端可以提交纯数字 ID，也可以提交 App Store URL。

## 跨应用协作方式
- 前后端的网络契约通过路径前缀 `/api/*` 对齐，前端统一用 `apps/web/src/lib/http.ts` 的 `buildApiUrl` 拼接请求地址。
- 本地开发时，`apps/web/vite.config.ts` 把 `/api` 代理到 `http://127.0.0.1:8787`；生产环境通过根目录 `.env` 中的 `VITE_API_BASE` 指向 Worker 域名。
- Worker 通过 `CORS_ORIGIN` 控制浏览器跨域来源，保证 `apps/web` 可以直接调用 Worker。
- Worker 邮件里的重置密码链接依赖 `APP_BASE_URL`，目标页面落在前端 `apps/web/src/views/auth/AuthView.vue`。
- 前端登录状态靠浏览器本地 token 与 `AUTH_TOKEN_CHANGED_EVENT` 同步，Worker 不维护前端 session store。

## 阅读建议
- 想追 API 请求，优先从 `apps/web/src/views/**` 找调用点，再跳到 `apps/worker/src/routes/**` 和 `apps/worker/src/services/**`。
- 想追数据落库，优先从 `apps/worker/src/lib/checker.ts` 或某个 service 开始，再看 `apps/worker/src/db/schema.ts`。
- 想追环境与部署，查看根目录 `README.md`、`netlify.toml`、`apps/worker/wrangler.toml`、`apps/worker/.dev.vars.example`、`.env.example`。
