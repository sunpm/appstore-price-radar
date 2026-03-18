# 目录结构参考

## 仓库顶层
- 根目录是一个 workspace，关键入口文件有 `package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、`README.md`、`AGENTS.md`。
- 前端部署配置在 `netlify.toml`，只负责把 `apps/web/dist` 发布为 SPA。
- 前端环境变量模板在 `.env.example`，这里只定义 `VITE_API_BASE`，不会承载 Worker secret。
- 代码主目录只有 `apps/web` 与 `apps/worker` 两个一等应用目录，适合按应用边界查找。

## 推荐的找代码路径
- 找“页面从哪里进来”：先看 `apps/web/src/router.ts`，再跳到对应 `apps/web/src/views/**`。
- 找“API 从哪里进来”：先看 `apps/worker/src/index.ts` 的 `app.route(...)`，再跳到 `apps/worker/src/routes/**`。
- 找“具体业务逻辑”：从 route 跳到 `apps/worker/src/services/**`。
- 找“数据库表长什么样”：看 `apps/worker/src/db/schema.ts`，再对照 `apps/worker/drizzle/*.sql`。
- 找“定时任务怎么跑”：看 `apps/worker/wrangler.toml` 与 `apps/worker/src/lib/checker.ts`。
- 找“前后端如何联通”：看 `apps/web/src/lib/http.ts`、`apps/web/vite.config.ts`、`.env.example`、`apps/worker/src/lib/cors.ts`。

## Workspace 与配置文件位置
- 根级运行脚本定义在 `package.json`，包括 `pnpm dev`、`pnpm build`、`pnpm typecheck`、`pnpm lint`。
- workspace 范围由 `pnpm-workspace.yaml` 中的 `apps/*` 决定。
- TS 严格模式基线在 `tsconfig.base.json`，两个应用的 `tsconfig.json` 都从这里继承。
- 部署相关文件分散在根与应用目录：`netlify.toml` 归前端，`apps/worker/wrangler.toml` 归 Worker。

## `apps/web` 目录布局
- `apps/web/package.json`：前端脚本与依赖入口。
- `apps/web/index.html`：Vite HTML 宿主。
- `apps/web/vite.config.ts`：Vite 插件、端口、开发代理配置。
- `apps/web/eslint.config.mjs`：前端 ESLint 规则，基于 `@antfu/eslint-config`。
- `apps/web/src/main.ts`：Vue 挂载入口。
- `apps/web/src/App.vue`：根组件，只保留顶层 `RouterView` 与 Toast 视口。
- `apps/web/src/router.ts`：页面路由图与登录前置守卫。
- `apps/web/src/style.css`：全局样式、字体与基础动画。

## `apps/web/src` 模块归属
- `apps/web/src/layouts`：放跨页面布局，目前主壳在 `apps/web/src/layouts/MainLayout.vue`。
- `apps/web/src/components`：放跨页面复用组件，目前公开的是反馈视口 `apps/web/src/components/feedback/AppToastViewport.vue`。
- `apps/web/src/constants`：放全局常量，例如国家地区列表 `apps/web/src/constants/countries.ts`。
- `apps/web/src/lib`：放无页面归属的前端基础库，例如 `apps/web/src/lib/http.ts`、`apps/web/src/lib/auth-session.ts`、`apps/web/src/lib/toast.ts`、`apps/web/src/lib/format.ts`。
- `apps/web/src/types`：放跨页面共享类型，目前有 `apps/web/src/types/common.ts` 与 `apps/web/src/types/prices.ts`。
- `apps/web/src/views`：按页面域组织代码，是查找前端业务逻辑的第一站。

## `apps/web/src/views` 的组织方式
- `apps/web/src/views/home/HomeView.vue`：首页公开降价流主视图。
- `apps/web/src/views/home/components`：首页局部组件，包含 `HomeFeedHero.vue`、`HomeFeedFilters.vue`、`HomeFeedList.vue`。
- `apps/web/src/views/home/types.ts`：首页数据结构。
- `apps/web/src/views/app/AppDetailView.vue`：单应用详情页。
- `apps/web/src/views/app/types.ts`：详情页的趋势点、事件行等类型。
- `apps/web/src/views/auth/AuthView.vue`：登录、注册、验证码登录、重置密码统一入口。
- `apps/web/src/views/auth/components`：认证表单和区块组件，例如 `AuthCredentialForms.vue`、`AuthModeSwitcher.vue`、`AuthSessionPanel.vue`。
- `apps/web/src/views/auth/composables`：认证页局部逻辑复用，例如 `useAuthFeedback.ts`、`useCooldownTimer.ts`。
- `apps/web/src/views/auth/constants.ts` 与 `apps/web/src/views/auth/types.ts`：认证页常量与类型。
- `apps/web/src/views/profile/ProfileView.vue`：用户工作台，负责订阅创建、列表和历史查看。
- `apps/web/src/views/profile/components`：工作台拆分组件，例如 `ProfileWatchFormCard.vue`、`ProfileSubscriptionListCard.vue`、`ProfileHistorySection.vue`。
- `apps/web/src/views/profile/types.ts`：订阅与历史面板类型。
- `apps/web/src/views/security/SecurityView.vue`：账号安全页。
- `apps/web/src/views/security/components/SecurityPasswordCard.vue`：改密表单。
- `apps/web/src/views/security/types.ts`：安全页类型。

## `apps/web` 命名方式
- 路由级与展示级组件使用 PascalCase 文件名，例如 `HomeView.vue`、`MainLayout.vue`、`ProfileDashboardHeader.vue`。
- 组合式复用逻辑使用 `useXxx.ts`，集中在页面局部 `composables/`，例如 `apps/web/src/views/auth/composables/useCooldownTimer.ts`。
- 每个页面目录通常同时带 `types.ts`，复杂页面额外带 `constants.ts` 与 `components/`。
- Web 端没有单独的 API service 目录，页面通常直接调用 `fetch`，但依赖 `apps/web/src/lib/http.ts` 做 URL 与错误处理统一。

## `apps/worker` 目录布局
- `apps/worker/package.json`：Worker 脚本与依赖入口。
- `apps/worker/wrangler.toml`：Cloudflare Worker 入口、cron、`keep_vars` 配置。
- `apps/worker/drizzle.config.ts`：Drizzle CLI 配置，读取 `DATABASE_URL` 并输出迁移。
- `apps/worker/.dev.vars.example`：Worker 本地运行变量模板。
- `apps/worker/src/index.ts`：HTTP 与定时任务双入口。
- `apps/worker/test`：Vitest 测试目录。
- `apps/worker/drizzle`：SQL 迁移目录，当前已有 `0000_init.sql` 与 `0001_price_change_events.sql`。

## `apps/worker/src` 模块归属
- `apps/worker/src/constants`：全局常量分组，按领域拆为 `auth.ts`、`env.ts`、`routes.ts`。
- `apps/worker/src/db`：数据库接入层，`client.ts` 提供 `getDb`，`schema.ts` 定义所有表。
- `apps/worker/src/lib`：跨 service 复用的领域能力与第三方适配器。
- `apps/worker/src/middleware`：Hono 中间件，目前核心是 `apps/worker/src/middleware/auth.ts`。
- `apps/worker/src/routes`：API 路由入口层。
- `apps/worker/src/services`：业务服务层。
- `apps/worker/src/env.ts`：环境变量 schema 与解析。
- `apps/worker/src/types.ts`：Worker/Hono 运行时类型。

## `apps/worker/src/lib` 的职责划分
- `apps/worker/src/lib/appstore.ts` 与 `apps/worker/src/lib/appstore.types.ts`：App Store API 适配与返回结构。
- `apps/worker/src/lib/checker.ts` 与 `apps/worker/src/lib/checker.types.ts`：单应用刷新、批量巡检、重试和节流。
- `apps/worker/src/lib/auth.ts`：密码 hash、session token、Bearer 解析。
- `apps/worker/src/lib/auth-emails.ts`：登录验证码与密码重置邮件内容。
- `apps/worker/src/lib/alerts.ts` 与 `apps/worker/src/lib/alerts.types.ts`：降价提醒邮件内容与发送入口。
- `apps/worker/src/lib/email-client.ts` 与 `apps/worker/src/lib/email-template.ts`：Resend 客户端封装与 HTML 邮件外壳。
- `apps/worker/src/lib/cors.ts`：CORS 来源解析。
- `apps/worker/src/lib/zod.ts`：生成查询参数、布尔值、数值等复用 schema。

## `apps/worker/src/routes` 与 `services` 的配对关系
- `apps/worker/src/routes/auth.ts` 对应 `apps/worker/src/services/auth.ts` 与 `apps/worker/src/services/auth.types.ts`。
- `apps/worker/src/routes/subscriptions.ts` 对应 `apps/worker/src/services/subscriptions.ts` 与 `apps/worker/src/services/subscriptions.types.ts`。
- `apps/worker/src/routes/prices.ts` 对应 `apps/worker/src/services/prices.ts` 与 `apps/worker/src/services/prices.types.ts`。
- `apps/worker/src/routes/public.ts` 对应 `apps/worker/src/services/public.ts` 与 `apps/worker/src/services/public.types.ts`。
- 如果要追某个 API 的行为，通常按“route -> service -> lib/db”顺序看即可。

## `apps/worker/src/db/schema.ts` 中的核心表
- 用户与认证相关：`users`、`user_sessions`、`password_reset_tokens`、`login_codes`。
- 订阅相关：`subscriptions`。
- App 当前状态缓存：`app_snapshots`。
- 价格变化历史：`app_price_change_events`。
- 降价公共流：`app_drop_events`。
- 想看索引与约束时，优先看这个 schema 文件，再补看 `apps/worker/drizzle/*.sql`。

## 测试位置与覆盖主题
- `apps/worker/test/auth.test.ts`：覆盖密码 hash 与兼容旧迭代次数的认证逻辑。
- `apps/worker/test/checker.price-change.test.ts`：覆盖快照更新、价格变化事件与历史读取。
- `apps/worker/test/scheduler.rate-limit.test.ts`：覆盖 cron 安全配置、节流和重试退避。
- 当前仓库没有单独的前端测试目录，所以前端回归主要依赖手动验证与类型检查。

## 查找规则与命名约定
- 想找“某个页面的局部组件”，去同名视图目录下的 `components/`，不要先去全局 `components/`。
- 想找“某个页面的类型定义”，先找该页面目录下的 `types.ts`，再看 `apps/web/src/types` 是否有共享类型。
- 想找“某个 Worker 业务响应结构”，优先看对应 service 邻近的 `*.types.ts`。
- 想找“环境变量是否存在”，查看 `apps/worker/src/env.ts`、`apps/worker/.dev.vars.example`、`.env.example`，不要在文档或代码里搜索真实 secret。
- 想找“谁在调用第三方”，去 `apps/worker/src/lib/appstore.ts` 和 `apps/worker/src/lib/email-client.ts`，而不是 route 层。

## 实用导航建议
- 新增 API 时，通常要同时触达 `apps/worker/src/routes`、`apps/worker/src/services`、必要时 `apps/worker/src/db/schema.ts` 或 `apps/worker/src/lib`。
- 新增前端页面时，通常要触达 `apps/web/src/router.ts`、对应 `apps/web/src/views/<domain>/` 目录，以及必要的 `apps/web/src/lib`。
- 追订阅问题时，从 `apps/web/src/views/profile/ProfileView.vue` 开始最直接，再跳 `apps/worker/src/routes/subscriptions.ts` 与 `apps/worker/src/services/subscriptions.ts`。
- 追价格历史问题时，从 `apps/web/src/views/app/AppDetailView.vue` 跳到 `apps/worker/src/services/prices.ts` 与 `apps/worker/src/db/schema.ts`。
- 追定时任务问题时，从 `apps/worker/wrangler.toml` 跳到 `apps/worker/src/index.ts` 的 `scheduled`，再看 `apps/worker/src/lib/checker.ts`。
