# 技术栈映射

## 工作区与语言
- 仓库是 `pnpm` workspace，根入口在 `package.json` 与 `pnpm-workspace.yaml`，工作区仅包含 `apps/*`。
- 主要语言是 TypeScript，公共编译基线在 `tsconfig.base.json`，启用了 `strict`、`moduleResolution: Bundler`、`target: ES2022`。
- 前端源码位于 `apps/web/src`，后端源码位于 `apps/worker/src`，两侧都使用 ESM，见 `apps/web/package.json` 与 `apps/worker/package.json` 的 `"type": "module"`。

## 前端运行时与框架
- Web 应用使用 Vue 3，入口是 `apps/web/src/main.ts`，根组件是 `apps/web/src/App.vue`。
- 路由基于 `vue-router`，配置在 `apps/web/src/router.ts`，使用 `createWebHistory()`，属于 SPA 路由模式。
- 页面和布局主要分布在 `apps/web/src/views` 与 `apps/web/src/layouts/MainLayout.vue`。
- 样式体系是 Tailwind CSS v4 + 手写 CSS，Tailwind 通过 `apps/web/vite.config.ts` 中的 `@tailwindcss/vite` 插件接入，CSS 入口在 `apps/web/src/style.css`。
- `apps/web/src/style.css` 还直接引入 Google Fonts（`Outfit`、`JetBrains Mono`），说明前端存在第三方字体依赖。

## 前端构建与开发链路
- Web 构建工具是 Vite，配置入口为 `apps/web/vite.config.ts`。
- `apps/web/vite.config.ts` 将本地 `/api` 代理到 `http://127.0.0.1:8787`，开发时前后端可同域协作。
- Web 构建命令在 `apps/web/package.json`：`vue-tsc --noEmit && vite build`，说明先做 Vue 类型检查再产出静态资源。
- Web 类型检查命令是 `vue-tsc --noEmit`，ESLint 配置入口是 `apps/web/eslint.config.mjs`，基于 `@antfu/eslint-config`。
- 根脚本 `pnpm dev` 通过 `concurrently` 同时启动 `pnpm dev:web` 与 `pnpm dev:worker`，定义在根 `package.json`。

## 后端运行时与框架
- API 与定时任务运行在 Cloudflare Workers，Worker 入口是 `apps/worker/src/index.ts`。
- HTTP 框架使用 Hono，主应用在 `apps/worker/src/index.ts` 中通过 `new Hono<AppEnv>()` 创建。
- Worker 同时暴露 `fetch` 与 `scheduled` 两种入口，说明这是 API + Cron Job 的组合型服务。
- 路由按领域拆分到 `apps/worker/src/routes/auth.ts`、`apps/worker/src/routes/subscriptions.ts`、`apps/worker/src/routes/prices.ts`、`apps/worker/src/routes/public.ts`。
- 业务逻辑主要沉淀在 `apps/worker/src/services` 与 `apps/worker/src/lib`，例如价格巡检在 `apps/worker/src/lib/checker.ts`。

## 后端依赖与基础能力
- 数据访问层使用 Drizzle ORM，客户端创建在 `apps/worker/src/db/client.ts`，schema 在 `apps/worker/src/db/schema.ts`。
- PostgreSQL 驱动使用 `@neondatabase/serverless`，并通过 `drizzle-orm/neon-http` 适配 Cloudflare Worker 环境，见 `apps/worker/src/db/client.ts`。
- 输入校验使用 Zod 与 `@hono/zod-validator`，集中出现在 `apps/worker/src/routes/*.ts` 和 `apps/worker/src/env.ts`。
- 邮件发送依赖 Resend，封装在 `apps/worker/src/lib/email-client.ts`、`apps/worker/src/lib/alerts.ts`、`apps/worker/src/lib/auth-emails.ts`。
- 密码与会话散列使用 `@noble/hashes` + Web Crypto，关键实现位于 `apps/worker/src/lib/auth.ts`。

## 数据库与迁移工具
- Drizzle CLI 配置入口是 `apps/worker/drizzle.config.ts`，schema 指向 `apps/worker/src/db/schema.ts`，输出目录是 `apps/worker/drizzle`。
- 已存在 SQL 迁移文件 `apps/worker/drizzle/0000_init.sql` 与 `apps/worker/drizzle/0001_price_change_events.sql`。
- `apps/worker/drizzle/0001_price_change_events.sql` 展示了从旧表 `app_price_history` 迁移到新表 `app_price_change_events` 的数据演进线索。
- Worker 包内提供 `db:generate` 与 `db:push` 脚本，定义在 `apps/worker/package.json`。

## 测试与质量工具
- Worker 测试框架是 Vitest，执行入口在 `apps/worker/package.json` 的 `test` 脚本。
- 当前测试文件位于 `apps/worker/test/auth.test.ts`、`apps/worker/test/checker.price-change.test.ts`、`apps/worker/test/scheduler.rate-limit.test.ts`。
- 测试重点覆盖密码兼容、价格变化事件持久化和定时巡检限流策略，说明后端比前端更有自动化测试沉淀。
- 仓库根命令 `pnpm typecheck` 会递归执行两个应用的类型检查，定义在根 `package.json`。

## 配置入口索引
- 根工作区与通用脚本：`package.json`
- 工作区范围：`pnpm-workspace.yaml`
- TypeScript 公共基线：`tsconfig.base.json`
- Web 构建配置：`apps/web/vite.config.ts`
- Web Lint 配置：`apps/web/eslint.config.mjs`
- Worker 运行与 cron 配置：`apps/worker/wrangler.toml`
- Worker 环境校验：`apps/worker/src/env.ts`
- Worker 数据库配置：`apps/worker/drizzle.config.ts`
- Web 环境变量示例：`.env.example`
- Worker 环境变量示例：`apps/worker/.dev.vars.example`

## 部署线索
- Worker 部署目标是 Cloudflare Workers，部署脚本是 `apps/worker/package.json` 中的 `wrangler deploy`。
- `apps/worker/wrangler.toml` 指定 `main = "src/index.ts"`、`compatibility_date = "2025-01-01"`，并开启 `keep_vars = true`。
- `apps/worker/wrangler.toml` 中的 cron 配置为 `0 */6 * * *`，意味着生产默认每 6 小时巡检一次。
- Web 部署目标是 Netlify，配置在 `netlify.toml`，构建命令为 `pnpm --filter @appstore-price-radar/web build`，发布目录是 `apps/web/dist`。
- `netlify.toml` 还配置了 `/* -> /index.html` 的 SPA 回退，说明前端采用静态托管 + 客户端路由。
- `README.md` 明确给出了本地开发、Cloudflare 部署、Netlify 部署和环境变量配置流程，可视为运维使用手册。

## 技术栈结论
- 这是一个以 TypeScript 为主的双应用仓库：`apps/web` 负责 Vue 3 SPA，`apps/worker` 负责 Cloudflare Worker API、定时巡检和邮件通知。
- 运行架构偏向“无服务器 + 托管前端”：前端产物发 Netlify，后端逻辑跑在 Cloudflare Workers，数据库落在 Neon Postgres。
- 代码组织已经围绕价格监控主域建模完成，技术选型明显优先考虑 Cloudflare Worker 兼容性、低运维和按需扩展。
