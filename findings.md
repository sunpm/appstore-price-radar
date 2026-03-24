# 发现与决策

## 需求
- 用户要求按 `planning-with-files-zh` 规范执行。
- 先新建分支，再对项目做系统性检索。
- 回复与文档均使用中文。

## 研究发现
- 仓库当前初始分支为 `main`，创建前工作区干净。
- 项目根目录原本不存在 `task_plan.md`、`findings.md`、`progress.md`。
- 技能模板位于 `/Users/sunpm/.agents/skills/planning-with-files-zh/templates/`。
- 已创建工作分支 `chore/project-scan-20260323`。
- 根仓库是 `pnpm@10.9.0` workspace，工作区范围为 `apps/*` 与 `packages/*`。
- 当前至少包含 `apps/web`、`apps/worker`、`packages/contracts` 三个 package。
- 根脚本提供 `dev`、`build`、`test`、`typecheck`、`lint`、`verify`、`verify:full` 等统一入口。
- `verify` 会串联类型检查、前端 lint、双端测试与 worker smoke test。
- TypeScript 基线配置启用了 `strict: true`，目标环境为 `ES2022`，模块解析方式为 `Bundler`。
- `apps/web` 是 `Vue 3.5 + Vite 5 + Vue Router + Tailwind CSS v4` 前端应用，使用 `vue-tsc` 做类型检查、`Vitest` 做测试、`@antfu/eslint-config` 做 lint 约束。
- `apps/worker` 是 `Cloudflare Worker + Hono + Drizzle ORM + Zod` 后端应用，连接 `Neon Postgres`，并集成 `Resend` 邮件能力。
- `packages/contracts` 是共享 TypeScript 合同包，直接从 `src/index.ts` 暴露类型/契约，供前后端共同依赖。
- `README.md` 已把本地启动、数据库初始化、smoke verification、统一验证和部署步骤整理完整，当前官方发布前验证入口是 `pnpm verify`。
- Worker 目录下存在 `drizzle`、`src/constants`、`src/db`、`src/lib`、`src/middleware`、`src/routes`、`src/services`、`test` 等职责分层目录。
- Web 目录下存在 `src/components`、`src/composables`、`src/constants`、`src/layouts`、`src/lib`、`src/types`、`src/views`、`test` 等前端分层目录。
- Web 入口为 `apps/web/src/main.ts`，创建 Vue 应用后挂载 `router`，并引入全局样式 `style.css`。
- Web 路由定义在 `apps/web/src/router.ts`，顶层采用 `MainLayout`，子路由包含首页 `/`、应用详情 `/apps/:appId/:country`、个人中心 `/profile`、账号安全 `/security`、登录 `/auth`，并通过 `authGuard` 保护登录后页面。
- `apps/web/src/App.vue` 仅渲染 `RouterView` 与全局 `AppToastViewport`，说明页面骨架主要放在布局与视图层。
- Worker 入口为 `apps/worker/src/index.ts`，先解析环境变量，再统一挂载 `/api/*` CORS、中间件与路由，并同时导出 `fetch` 和 `scheduled` 两种 Worker 能力。
- Worker 已暴露 `/api/health`、`/api/auth/*`、`/api/public/*`、`/api/subscriptions/*`、`/api/prices/:appId` 和手动巡检入口 `/api/jobs/check`。
- `apps/worker/src/env.ts` 使用 `zod` 校验全部运行时变量，并对登录、限流、巡检、重试等参数设定默认值和边界。
- `apps/worker/wrangler.toml` 指定入口 `src/index.ts`、`keep_vars = true`，并配置 `0 */6 * * *` 的 6 小时定时任务。
- `apps/worker/src/routes/public.ts` 负责公开降价列表查询；`subscriptions.ts` 负责登录态订阅增删查；`prices.ts` 负责单个 App 的价格历史与详情查询。
- `apps/worker/src/routes/auth.ts` 覆盖注册、密码登录、忘记密码、重置密码、修改密码、验证码发送与校验、`/me`、登出等完整认证链路。
- `packages/contracts/src/index.ts` 统一导出 `auth`、`subscriptions`、`prices` 三组共享 DTO/类型，是前后端接口契约的单一出口。
- Worker 服务层中：
  - `services/prices.ts` 负责价格历史聚合，并兼容 legacy `app_price_history` 与新 `app_price_change_events` 两套数据来源。
  - `services/subscriptions.ts` 负责订阅创建、列表与软删除，创建订阅后会尝试触发一次单 App 刷新。
  - `services/public.ts` 负责公开降价流，并支持按 `(appId, country)` 做去重。
- Web 测试已覆盖登录态恢复与受保护路由跳转，例如 `apps/web/test/auth-session.test.ts` 会验证未登录访问 `/profile` 时跳转到 `/auth`，以及本地 session 恢复后留在工作台。
- Worker 测试分布较完整，包含认证、订阅、公开接口、价格历史、巡检、速率限制、原子性、schema bootstrap、fresh install smoke 等多个维度。
- `apps/worker/test/fresh-install.smoke.test.ts` 通过 mock `db/client`、App Store 请求与邮件发送，验证健康检查、订阅创建、巡检触发、价格历史读取等最小闭环。
- `apps/worker/test/schema.bootstrap.test.ts` 明确守护 `drizzle/0000_init.sql` 和 `0001_price_change_events.sql` 的基线契约，避免 SQL 资产与运行时代码脱节。

## 技术决策
| 决策 | 理由 |
|------|------|
| 先初始化规划文件，再继续检索代码结构 | 满足技能要求，并为后续发现提供持久化记录 |
| 先读根配置，再下钻到各应用与共享包 | 先建立 workspace 边界，再看具体实现更稳妥 |
| 先检索 package 与目录结构，再读源码入口 | 先确认边界和职责，再进入实现细节，信息更连贯 |
| 继续补充共享 contracts 与测试分布 | 这样能更快判断前后端接口耦合方式和回归保护范围 |
| 收尾前再核对 Git 状态与规划文件状态 | 确保分支、文档与检索结果一致 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| `apply_patch` 首次更新规划文件时上下文未匹配 | 重新读取文件后改用更精确的补丁，已解决 |

## 资源
- 技能文件：`/Users/sunpm/.agents/skills/planning-with-files-zh/SKILL.md`
- 技能模板目录：`/Users/sunpm/.agents/skills/planning-with-files-zh/templates/`

## 视觉/浏览器发现
- 本轮仅进行了本地仓库与技能模板检索，暂无视觉内容。

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
