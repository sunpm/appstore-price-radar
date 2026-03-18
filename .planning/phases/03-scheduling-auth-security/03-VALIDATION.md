---
phase: 03
slug: scheduling-auth-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — current worker tests use Vitest defaults |
| **Quick run command** | `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.rate-limit.test.ts test/jobs.check-route.test.ts test/auth.security.test.ts` |
| **Full suite command** | `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.rate-limit.test.ts test/jobs.check-route.test.ts test/auth.security.test.ts`
- **After every plan wave:** Run `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | PRICE-03 | unit | `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.job-lock.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 03-01 | 1 | PRICE-03, PRICE-04 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.job-lock.test.ts test/scheduler.rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 03-02 | 2 | AUTH-01 | unit | `pnpm --filter @appstore-price-radar/worker test -- test/auth.security.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 2 | AUTH-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/auth.security.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 03-02 | 2 | AUTH-01, AUTH-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/auth.security.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 3 | AUTH-03 | route | `pnpm --filter @appstore-price-radar/worker test -- test/jobs.check-route.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03-03 | 3 | AUTH-03, PRICE-04 | smoke | `pnpm --filter @appstore-price-radar/worker test -- test/jobs.check-route.test.ts test/fresh-install.smoke.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 03-04 | 4 | PRICE-03, PRICE-04 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.job-lock.test.ts test/jobs.check-route.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 03-04 | 4 | AUTH-01, AUTH-02, AUTH-03 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/auth.security.test.ts test/jobs.check-route.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/test/scheduler.job-lock.test.ts` — duplicate-run、租约与 run summary 回归
- [ ] `apps/worker/test/jobs.check-route.test.ts` — manual route config/secret gate
- [ ] `apps/worker/test/auth.security.test.ts` — auth 限流、失败计数、凭证淘汰回归

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 手动巡检入口在 secret 缺失时不会真的跑任务 | AUTH-03 | 需要确认真实 worker route 的可达性和错误码，而不只是 service mock | 本地启动 `pnpm dev:worker`，在 `MANUAL_PRICE_CHECKS_ENABLED=true` 且 `CRON_SECRET=` 为空时请求 `POST /api/jobs/check`，确认返回 `503` 或 `404`，且没有新的巡检运行日志 |
| 重复触发 manual + scheduled 巡检不会造成双重提醒 | PRICE-03 | 需要串起 route / scheduled / email side effects 的完整行为 | 使用 mock/staging 数据同时触发一次手动和一次 scheduled 巡检，确认只出现一条 completed run，另一条为 skipped/locked |
| 新 login code / reset token 会废弃旧凭证 | AUTH-02 | 需要从真实接口观察前后 token/code 生命周期 | 连续两次请求 login code 或 forgot-password，第二次成功后用第一次凭证验证，确认返回 `401` 或 `429`，第二次凭证仍按策略可用 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
