# 编码约定

## 适用范围
- 本文基于当前仓库实际代码整理，覆盖 `apps/web` 与 `apps/worker` 两个工作区。
- 目录分层基本稳定：前端入口和页面集中在 `apps/web/src`，Worker 的入口、路由、服务、库函数、数据库层分别位于 `apps/worker/src/index.ts`、`apps/worker/src/routes`、`apps/worker/src/services`、`apps/worker/src/lib`、`apps/worker/src/db`。
- 共享基础约束来自 `tsconfig.base.json`，已启用 TypeScript `strict`、`isolatedModules`、`moduleResolution: "Bundler"`。

## 代码风格
- 代码普遍使用 2 空格缩进、单引号和显式 TypeScript 类型，路径风格可参考 `apps/web/src/router.ts` 与 `apps/worker/src/services/subscriptions.ts`。
- 前端代码整体遵循 `@antfu/eslint-config` 风格，配置位于 `apps/web/eslint.config.mjs`，实际文件如 `apps/web/src/views/home/HomeView.vue`、`apps/web/src/lib/http.ts` 基本不写分号。
- Worker 侧当前没有看到单独的 ESLint 配置，源码如 `apps/worker/src/index.ts`、`apps/worker/src/lib/checker.ts`、`apps/worker/src/services/auth.ts` 大量保留分号。
- 因此新增代码应优先“跟随所在包现有风格”，不要强行把 `apps/web` 与 `apps/worker` 的分号习惯混成一种。
- `import type` 使用频率很高，通常放在普通导入之前或紧邻普通导入，如 `apps/web/src/views/profile/types.ts`、`apps/worker/src/services/prices.ts`。
- 纯工具函数倾向写成具名函数或 `const fn = () =>`，而不是默认导出匿名函数；默认导出主要用于 Vue 页面/组件和 Hono 路由，如 `apps/web/src/views/auth/AuthView.vue`、`apps/worker/src/routes/auth.ts`。

## 命名习惯
- Vue 单文件组件使用 PascalCase 文件名，例如 `apps/web/src/views/home/HomeView.vue`、`apps/web/src/views/profile/components/ProfileWatchFormCard.vue`、`apps/web/src/components/feedback/AppToastViewport.vue`。
- 前端组件名通常带领域前缀，便于从文件名直接判断归属，例如 `AuthCredentialForms.vue`、`HomeFeedFilters.vue`、`ProfileSubscriptionListCard.vue`、`SecurityPasswordCard.vue`。
- 前端组合式函数使用 `useXxx.ts` 命名，如 `apps/web/src/views/auth/composables/useAuthFeedback.ts`、`apps/web/src/views/auth/composables/useCooldownTimer.ts`。
- 前端局部类型通常放在页面目录下的 `types.ts`，例如 `apps/web/src/views/auth/types.ts`、`apps/web/src/views/app/types.ts`；跨页面通用类型放在 `apps/web/src/types`。
- Worker 模块按领域命名并保持 route/service 对齐，例如 `apps/worker/src/routes/prices.ts` 对应 `apps/worker/src/services/prices.ts` 与 `apps/worker/src/services/prices.types.ts`。
- Worker 常量统一放在 `apps/worker/src/constants`，并采用全大写下划线命名，例如 `DEFAULT_SESSION_TTL_DAYS`、`PRICE_HISTORY_MAX_LIMIT`、`OTP_CODE_PATTERN`。
- 数据库表对象与类型定义集中在 `apps/worker/src/db/schema.ts`，表名使用复数语义如 `users`、`subscriptions`、`appDropEvents`，再通过 `$inferSelect` 导出行类型。
- 服务函数名倾向于动词开头，直接体现业务动作，例如 `createUserSubscription`、`getPublicDrops`、`runPriceCheck`、`verifyLoginCode`。

## 组件与服务模式
- 前端统一采用 Vue 3 Composition API 和 `<script setup lang="ts">`，仓库里没有使用 Options API 的页面，入口可见 `apps/web/src/App.vue`、`apps/web/src/layouts/MainLayout.vue`。
- 展示型组件大量使用 `defineProps`、`defineEmits`、`defineModel`，把状态保留在页面层，示例见 `apps/web/src/views/home/components/HomeFeedFilters.vue`、`apps/web/src/views/profile/components/ProfileWatchFormCard.vue`、`apps/web/src/views/security/components/SecurityPasswordCard.vue`。
- 页面级视图负责请求、状态、路由和错误文案，子组件主要负责渲染和表单交互，典型容器组件见 `apps/web/src/views/home/HomeView.vue`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/auth/AuthView.vue`。
- 前端路由集中在 `apps/web/src/router.ts`，使用 `MainLayout` 包住主要页面，并通过 `meta.requiresAuth` + `beforeEach` 实现简单登录守卫。
- 前端共享逻辑优先放在 `apps/web/src/lib` 与 `apps/web/src/constants`，例如 token 存储在 `apps/web/src/lib/auth-session.ts`，接口地址拼接与错误解析在 `apps/web/src/lib/http.ts`，国家列表在 `apps/web/src/constants/countries.ts`。
- 全局视觉约定以 Tailwind 类名为主，少量通用类和动画放在 `apps/web/src/style.css`，例如 `metric-mono`、`reveal`、`skeleton-box`。
- Worker 路由层职责较薄：先用 `zValidator` 做参数校验，再调用 service，最后统一 `return c.json(result.body, result.status)`，可参考 `apps/worker/src/routes/auth.ts`、`apps/worker/src/routes/subscriptions.ts`、`apps/worker/src/routes/prices.ts`。
- Worker 服务层普遍返回 `{ status, body }`，并在文件内部定义 `buildServiceResponse` 帮助函数，见 `apps/worker/src/services/auth.ts`、`apps/worker/src/services/public.ts`、`apps/worker/src/services/subscriptions.ts`。
- Worker 数据访问不在 route 中直接展开，统一通过 `getDb(config)` 取得 Drizzle 客户端，再配合 `apps/worker/src/db/schema.ts` 中的表定义查询。
- 外部集成和纯业务辅助函数放在 `apps/worker/src/lib`，例如 App Store 请求在 `apps/worker/src/lib/appstore.ts`，定时检查主流程在 `apps/worker/src/lib/checker.ts`，邮件发送边界在 `apps/worker/src/lib/email-client.ts`。

## 错误处理约定
- 前端页面常见模式是维护 `successText` / `errorText` 两个 `ref`，再用 `watch` 触发 toast，示例见 `apps/web/src/views/auth/composables/useAuthFeedback.ts`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue`。
- 前端接口错误文本优先通过 `apps/web/src/lib/http.ts` 的 `parseApiErrorText()` 解析后再抛出或展示，而不是直接把 `Response.status` 暴露到 UI。
- 需要鉴权的前端请求通常在页面内部的 `apiRequest<T>()` 中处理 401，并调用 `clearSession()` 清理本地 token；这套写法分别出现在 `apps/web/src/views/auth/AuthView.vue`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue`。
- Worker 可预期的业务失败倾向返回结构化 JSON，如 `{ error: 'Unauthorized' }`、`{ error: 'Invalid appId' }`，而不是在 service 中直接抛异常。
- Worker 对输入校验使用 Zod；环境配置校验在 `apps/worker/src/env.ts`，请求体/路径参数校验在各 route 文件中完成。
- 真正抛异常的地方通常是外部集成或底层工具，例如 `apps/worker/src/lib/appstore.ts` 在 App Store 返回异常状态或 schema 校验失败时会 `throw new Error(...)`。
- 非关键链路失败通常记录日志后继续执行，例如 `apps/worker/src/services/subscriptions.ts` 在刷新最新价格失败时只 `console.error`，不会回滚订阅创建。
- 应用级兜底错误由 `apps/worker/src/index.ts` 的 `app.onError()` 统一转成 500 JSON；定时任务分支也在同文件中捕获配置错误与执行错误并写日志。
- 邮件发送边界没有统一用抛异常，`apps/worker/src/lib/email-client.ts` 和 `apps/worker/src/lib/alerts.ts` 更偏向返回 `{ sent, reason }` 让上层决定是否继续。

## 配置约定
- Worker 环境变量统一走 `apps/worker/src/env.ts` 的 `parseEnv()`，不要在业务代码里直接读原始 `c.env` 字符串。
- 所有带默认值的数字配置都通过 `apps/worker/src/lib/zod.ts` 的预处理函数转成 number，例如 `SESSION_TTL_DAYS`、`LOGIN_CODE_TTL_MINUTES`、`PRICE_CHECK_MAX_RETRIES`。
- 默认值与边界值集中维护在 `apps/worker/src/constants/env.ts`、`apps/worker/src/constants/routes.ts`、`apps/worker/src/constants/auth.ts`，减少魔法数字散落在 service 中。
- Worker 绑定类型集中在 `apps/worker/src/types.ts`，包括 `CRON_SECRET`、`CORS_ORIGIN`、`SESSION_TTL_DAYS` 等字段。
- CORS 规则由 `apps/worker/src/lib/cors.ts` 解析，支持精确域名和 `*.example.com` 一类通配规则；`apps/worker/src/index.ts` 负责把它接到 Hono `cors()` 中。
- 定时任务节奏写在 `apps/worker/wrangler.toml`，当前是 `0 */6 * * *`；手动触发检查接口 `/api/jobs/check` 使用 `CRON_SECRET` 做额外保护。
- 数据库迁移相关配置在 `apps/worker/drizzle.config.ts`，该文件会按顺序尝试读取 `apps/worker/.env`、`apps/worker/.dev.vars`、仓库根 `.env`，但文档或代码里不应记录真实值。
- 前端接口基地址通过 `apps/web/src/lib/http.ts` 读取 `VITE_API_BASE`；本地开发如果不设置，则依赖 `apps/web/vite.config.ts` 中 `/api -> http://127.0.0.1:8787` 的代理。
- 仓库里已出现环境注释 `// @env browser` 与 `// @env worker`，分别见 `apps/web/src/lib/auth-session.ts`、`apps/web/src/views/auth/AuthView.vue`、`apps/worker/src/index.ts`，新增涉及平台 API 的文件可以延续这种标注方式。
