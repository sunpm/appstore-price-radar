---
phase: 04
slug: contract-frontend-stability
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vue-tsc` + ESLint + Vitest (worker) |
| **Config file** | `apps/web/eslint.config.mjs`, no dedicated frontend test config yet |
| **Quick run command** | `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test -- test/auth.test.ts test/subscriptions.create.test.ts test/appstore.lookup.test.ts` |
| **Full suite command** | `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test -- test/auth.test.ts test/subscriptions.create.test.ts test/appstore.lookup.test.ts`
- **After every plan wave:** Run `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 04-01 | 1 | API-01 | typecheck | `pnpm typecheck` | ✅ | ⬜ pending |
| 04-01-02 | 04-01 | 1 | API-01 | integration | `pnpm typecheck && pnpm --filter @appstore-price-radar/worker test -- test/auth.test.ts test/subscriptions.create.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 04-02 | 2 | AUTH-04, API-04 | typecheck | `pnpm typecheck && pnpm lint` | ✅ | ⬜ pending |
| 04-02-02 | 04-02 | 2 | AUTH-04, API-04 | integration | `pnpm typecheck && pnpm lint` | ✅ | ⬜ pending |
| 04-03-01 | 04-03 | 2 | API-02 | route | `pnpm --filter @appstore-price-radar/worker test -- test/prices.history.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 04-03 | 2 | API-02 | typecheck | `pnpm typecheck && pnpm lint` | ✅ | ⬜ pending |
| 04-04-01 | 04-04 | 3 | API-05 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts test/prices.history.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04-04 | 3 | API-05 | typecheck | `pnpm typecheck && pnpm lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/test/prices.history.test.ts` — history window / cursor / response meta 回归
- [ ] `apps/worker/test/contracts.responses.test.ts` 或现有 auth/subscription tests 扩展为共享 DTO shape 断言
- [ ] `apps/worker/test/appstore.lookup.test.ts` 增补 metadata 字段映射断言

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 会话过期后从工作台或安全页跳回登录页时，toast / 清 session / 跳转行为一致 | AUTH-04, API-04 | 当前没有 frontend integration test 基建 | 本地执行 `pnpm dev`，手动删除或篡改 token 后访问 `/profile`、`/security`、登录后的敏感操作，确认都提示“登录状态已失效，请重新登录”并回到 `/auth` |
| 频繁切换不同订阅或详情页时间窗口时，没有明显卡顿，且旧请求不会覆盖新请求结果 | API-02 | 需要观察真实交互下的取消与缓存行为 | 在本地快速切换多个 app/country/window，确认 loading、chart 与列表不会闪回旧数据，Network 中旧请求被取消或结果被丢弃 |
| 详情页首屏优先呈现当前价格、跌幅、评分、分类和商店入口，扩展 metadata 默认折叠 | API-05 | 需要真实查看信息层级而不是仅看 DOM 存在 | 打开 `/apps/:appId/:country`，确认首屏无需展开即可完成决策，更多技术细节在折叠区查看 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
