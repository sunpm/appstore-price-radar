---
phase: 02
slug: price-data-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — current worker tests use Vitest defaults |
| **Quick run command** | `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts test/checker.price-change.test.ts test/checker.atomicity.test.ts test/subscriptions.create.test.ts test/scheduler.rate-limit.test.ts` |
| **Full suite command** | `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts test/checker.price-change.test.ts test/checker.atomicity.test.ts test/subscriptions.create.test.ts test/scheduler.rate-limit.test.ts`
- **After every plan wave:** Run `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | PRICE-01 | unit | `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | PRICE-01 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/checker.price-change.test.ts` | ✅ | ⬜ pending |
| 02-02-01 | 02-02 | 2 | PRICE-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/checker.atomicity.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 2 | PRICE-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/checker.atomicity.test.ts test/checker.price-change.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 3 | PRICE-05 | unit | `pnpm --filter @appstore-price-radar/worker test -- test/subscriptions.create.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 3 | PRICE-05 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/subscriptions.create.test.ts test/scheduler.rate-limit.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/test/appstore.lookup.test.ts` — lookup contract regression for invalid-price vs not-found
- [ ] `apps/worker/test/checker.atomicity.test.ts` — batched persistence and alert status order checks
- [ ] `apps/worker/test/subscriptions.create.test.ts` — immediate refresh shared-options contract

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 缺失价格不会在真实 UI 中显示成 `0` 或免费 | PRICE-01 | 需要确认前后端最终展示语义，而不只是 service 层 | 本地启动 `pnpm dev`，让 App Store lookup mock/staging 返回缺失价格，检查工作台和详情页没有 `$0` 快照或假降价提示 |
| 即时刷新与定时巡检只在提醒策略上有差异 | PRICE-05 | 需要串起订阅创建与后续巡检的完整行为 | 创建一条订阅，确认创建时只拿快照不发提醒；随后触发一次 scheduled 检查，确认走相同价格校验但允许提醒 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
