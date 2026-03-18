# Stack Research

**Domain:** App Store 价格监听与降价提醒平台（brownfield）
**Researched:** 2026-03-18
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vue | 3.5.x | 构建前端 SPA 与交互页面 | 现有前端已全面采用 Composition API，继续沿用能最大化复用现有视图与组件结构 |
| Vite | 5.4.x | Web 开发与构建 | 当前开发链路已稳定，适合轻量 SPA 与 Netlify 静态部署 |
| Cloudflare Workers + Hono | Workers 2026 runtime / Hono 4.9.x | 提供 API、定时任务和边缘执行环境 | 低运维、天然适合 HTTP API + cron 型服务，且当前代码已经按此分层组织 |
| Drizzle ORM + Neon Postgres | Drizzle 0.44.x / Neon serverless driver 0.10.x | 管理关系型数据、迁移和查询 | 现有 schema、迁移与测试都围绕这套组合构建，适合继续补齐一致性和迁移治理 |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.24.x | 运行时参数与环境校验 | 所有 Worker 路由、环境变量和未来共享 DTO 都应继续使用 |
| @hono/zod-validator | 0.4.x | Hono 路由输入校验 | 继续作为 route 层薄校验边界，避免在 service 中重复解析请求 |
| Tailwind CSS | 4.1.x | Web 端样式系统 | 适合快速维护现有前端视觉，不必为本轮稳定性目标引入新的 UI 框架 |
| Resend | 6.2.x | 邮件发送 | 继续承担降价提醒、登录验证码和密码重置邮件 |
| Vitest | 3.2.x | Worker 与未来前端测试 | 当前已有 worker 测试实践，后续前端补测也可以沿用同一测试栈思路 |
| @noble/hashes | 2.0.x | 密码与 token 散列 | 继续用于 Worker 兼容的密码学实现，避免引入 Node 专属依赖 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm 10 | workspace 依赖与脚本管理 | 继续维持双应用工作区，不建议拆成更多包，除非需要共享 DTO |
| Wrangler 4 | Worker 本地开发与部署 | 仍是 Worker 构建、scheduled 调试和发布主入口 |
| TypeScript 5.9 | 类型系统与构建基线 | 已启用 `strict`，后续契约收敛可以更多依赖类型系统做前置保护 |
| ESLint + @antfu/eslint-config | Web 代码风格 | 目前只覆盖前端；Worker 后续如要收敛风格可再评估统一 lint |

## Installation

```bash
# Workspace
pnpm install

# Web / Worker 本地开发
pnpm dev

# 质量校验
pnpm typecheck
pnpm lint
pnpm --filter @appstore-price-radar/worker test
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vue 3 + Vite | Nuxt | 如果未来确实需要 SSR、内容站点 SEO 或更重的全栈约束，再考虑迁移 |
| Hono on Cloudflare Workers | 传统 Node API 服务 | 只有当任务规模或第三方依赖明显超出 Worker 约束时才值得评估 |
| Drizzle + Neon | 直接写 SQL / 换 ORM | 若未来需要极重的 SQL 调优可局部下沉 raw SQL，但不应整体放弃当前 schema 模型 |
| 单仓双应用结构 | 新增大量共享 packages | 只有在 DTO、校验 schema、UI primitives 明显重复到影响效率时再引入 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| 为解决稳定性问题而整体重写技术栈 | 会打断已有功能闭环，并引入新的未知迁移风险 | 以 brownfield 重构和分阶段修复为主 |
| 继续让前后端各自维护一套近似 DTO | 已经出现字段漂移，后续只会更难维护 | 共享 Zod / TypeScript 契约或至少统一生成来源 |
| 把 App Store 缺失价格直接降级为业务可用数据 | 会制造假降价、脏快照和错误通知 | 把缺失价格视为异常分支并记录原因 |
| 在未评估前引入高频实时抓价架构 | 会显著提高成本、并发和限流风险 | 先把现有定时巡检链路做对、做稳 |

## Stack Patterns by Variant

**如果继续保持当前双应用结构：**
- 保持 `apps/web` 与 `apps/worker` 解耦
- 通过共享 schema/类型而不是共享运行时状态来降低耦合

**如果后续需要收敛 DTO：**
- 新增轻量 `packages/contracts` 或等价共享目录
- 只放 API schema、推导类型和序列化约束，不混入运行时副作用

**如果未来巡检规模显著增长：**
- 优先考虑 Cloudflare Queues / 批次分片 / 任务租约
- 不要先引入复杂微服务拆分

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `vue@3.5.x` | `vue-router@4.5.x` | 当前前端已在这组版本上运行 |
| `vite@5.4.x` | `@vitejs/plugin-vue@5.2.x` | 现有构建链路匹配 |
| `drizzle-orm@0.44.x` | `drizzle-kit@0.31.x` | 当前 worker 迁移与 schema 配套 |
| `hono@4.9.x` | `@hono/zod-validator@0.4.x` | 当前 route 层已使用此组合 |

## Sources

- `package.json` / `apps/web/package.json` / `apps/worker/package.json` — 当前已安装版本与脚本入口
- `.planning/codebase/STACK.md` — 现有仓库技术栈与部署总结
- `.planning/codebase/ARCHITECTURE.md` — 现有系统边界和关键数据流
- `README.md` — 开发、部署与运行配置说明

---
*Stack research for: App Store 价格监听与降价提醒平台*
*Researched: 2026-03-18*
