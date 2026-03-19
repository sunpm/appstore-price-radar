---
phase: 05
slug: feed-performance-regression
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-19
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vue-tsc` + ESLint + Vitest (worker) + Vitest/Vue Test Utils (web, to be added in Phase 5) |
| **Config file** | `apps/web/eslint.config.mjs`, `apps/web/vitest.config.ts`（Wave 0 新增）, Worker 使用现有 Vitest 约定 |
| **Quick run command** | `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts test/public.route.test.ts` |
| **Full suite command** | `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test && pnpm --filter @appstore-price-radar/web test && pnpm --filter @appstore-price-radar/worker test:smoke` |
| **Estimated runtime** | ~240 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts test/public.route.test.ts`
- **After every plan wave:** Run `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test && pnpm --filter @appstore-price-radar/web test`
- **Before `$gsd-verify-work`:** Full suite must be green, then run `pnpm --filter @appstore-price-radar/worker test:smoke`
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 05-01 | 1 | API-03 | service | `pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 05-01 | 1 | API-03 | route | `pnpm --filter @appstore-price-radar/worker test -- test/public.route.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 05-02 | 2 | QA-01 | route | `pnpm --filter @appstore-price-radar/worker test -- test/public.route.test.ts test/auth.routes.test.ts test/subscriptions.routes.test.ts test/jobs.check-route.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 05-02 | 2 | QA-01 | service | `pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts test/auth.service.test.ts test/subscriptions.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 05-03 | 3 | QA-02 | web integration | `pnpm --filter @appstore-price-radar/web test` | ❌ W0 | ⬜ pending |
| 05-03-02 | 05-03 | 3 | QA-03 | release verify | `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test && pnpm --filter @appstore-price-radar/web test && pnpm --filter @appstore-price-radar/worker test:smoke` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/test/public.drops.test.ts` — 公开 feed dedupe、排序、submissionCount 聚合回归
- [ ] `apps/worker/test/public.route.test.ts` — `/api/public/drops` query 默认值、limit/country、response shape 回归
- [ ] `apps/worker/test/auth.routes.test.ts` — 认证关键路由响应与错误边界回归
- [ ] `apps/worker/test/subscriptions.routes.test.ts` — 订阅创建/删除/列表关键路由回归
- [ ] `apps/worker/test/jobs.check-route.test.ts` — 手动巡检鉴权与错误边界回归
- [ ] `apps/worker/test/auth.service.test.ts` / `apps/worker/test/subscriptions.service.test.ts` — 关键 service 状态逻辑补测
- [ ] `apps/web/vitest.config.ts`、`apps/web/test/setup.ts`、`apps/web/test/auth-session.test.ts`、`apps/web/test/profile-subscription.test.ts`、`apps/web/test/app-history.test.ts` — Web 关键路径测试基建与首批用例
- [ ] 根 `package.json` 增加统一 `test` / `verify` 入口

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 首页公开 feed 在真实数据下仍然只展示每个 `(appId, country)` 的最近一次降价，并且关注人数与工作台订阅数量语义一致 | API-03 | 需要对照真实页面与真实数据感觉首屏性能 | 本地执行 `pnpm dev`，打开首页，确认同一 App/国家不会重复出现，关注人数与数据库/工作台预期一致 |
| 会话失效后重新进入工作台或安全相关页面时，能稳定恢复或跳回登录，不出现半加载卡死 | QA-02 | 前端自动化会覆盖大部分逻辑，但真实浏览器下还需确认 storage/router 行为 | 在本地篡改或清空 token，再访问 `/profile`、`/security` 或执行需要登录的操作，确认提示与跳转一致 |
| 发布前统一验证命令能在当前机器从头跑通，不依赖额外手工顺序 | QA-03 | 自动化命令存在并不代表文档、环境和脚本编排都正确 | 在干净终端执行根 `verify` 命令，确认类型检查、lint、tests、smoke path 顺序执行且失败时能中断 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 240s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
