---
phase: 02-price-data-correctness
plan: '02'
subsystem: database
tags: [drizzle, neon, atomicity, testing]
requires:
  - phase: phase-02-01
    provides: explicit App Store invalid-price filtering before persistence
provides:
  - `refreshSingleApp` now batches snapshot, change event, and drop event writes through a single persistence boundary.
  - Atomicity regression tests cover batched write failure and notification-state ordering.
affects: [phase-02-03, price-integrity, worker-testing]
tech-stack:
  added: []
  patterns:
    - Multi-table refresh writes use `db.batch(...)` under the Neon HTTP driver instead of sequential standalone commits.
    - Request-level smoke mocks must understand the same DB write contract as production code.
key-files:
  created:
    - apps/worker/test/checker.atomicity.test.ts
  modified:
    - apps/worker/src/lib/checker.ts
    - apps/worker/test/checker.price-change.test.ts
    - apps/worker/test/fresh-install.smoke.test.ts
key-decisions:
  - "Use `db.batch(...)` for refresh persistence because the installed `neon-http` driver does not support `db.transaction()`."
  - "Keep alert sending after batched persistence succeeds so snapshot/event state cannot partially commit before a batch failure."
patterns-established:
  - "单刷新写入先持久化一致性，再进入通知副作用。"
  - "测试 mock 必须跟上仓库真实 DB contract，而不是只模拟旧的顺序 `await` 写法。"
requirements-completed: [PRICE-02]
duration: 3 min
completed: 2026-03-18
---

# Phase 02: 价格数据正确性 Summary

**`refreshSingleApp` 现在通过 `db.batch(...)` 一次性提交 snapshot、价格变化事件和降价事件写入，并且有原子性回归测试保护这条边界**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T08:19:15Z
- **Completed:** 2026-03-18T08:21:54Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 将 `refreshSingleApp` 从顺序独立写入改成 batched persistence，先统一提交 snapshot / change event / drop event，再进入提醒逻辑
- 新增 `checker.atomicity.test.ts`，直接验证 batch 失败时不会留下 snapshot 或事件的半完成写入
- 保持请求级 smoke 验证继续可用，让 `worker.fetch` 级别的测试也能覆盖新的 batched write contract

## Task Commits

Each task was committed atomically:

1. **Task 1: 把 refresh 的数据库写入改成 batched persistence** - `cb65753` (fix)
2. **Task 2: 补持久化原子性和提醒状态顺序测试** - `adb562b` (test)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/src/lib/checker.ts` - 用 `db.batch(...)` 收敛单刷新里的核心持久化写入
- `apps/worker/test/checker.price-change.test.ts` - 升级 mock 以匹配 batched write 路径
- `apps/worker/test/fresh-install.smoke.test.ts` - 让 request-level smoke mock 继续兼容新的批量写入语义
- `apps/worker/test/checker.atomicity.test.ts` - 覆盖 batch 失败与未发送提醒时的状态一致性

## Decisions Made

- 在当前 `neon-http` driver 下采用 `db.batch(...)`，而不是写一个运行不了的 `db.transaction()` 方案
- 保持 `lastNotifiedPrice` 只有在邮件真正发送成功后才更新，避免通知状态假前进

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 升级 fresh-install smoke mock 以兼容 batched persistence**
- **Found during:** Task 1 (把 refresh 的数据库写入改成 batched persistence)
- **Issue:** `pnpm --filter @appstore-price-radar/worker test -- ...` 会带起整个 worker 测试集；`fresh-install.smoke.test.ts` 仍假设 `refreshSingleApp` 使用顺序独立写入，缺少 `db.batch(...)` mock
- **Fix:** 为 `fresh-install.smoke.test.ts` 的 DB mock 增加 `batch()` 和批量写入 operation 适配，让 request-level smoke 继续覆盖真实持久化合同
- **Files modified:** `apps/worker/test/fresh-install.smoke.test.ts`
- **Verification:** `pnpm --filter @appstore-price-radar/worker test -- test/checker.atomicity.test.ts test/checker.price-change.test.ts`
- **Committed in:** `cb65753` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 这是为了保持既有 smoke path 与新 persistence contract 一致，没有扩大业务范围，也避免了 Phase 2 把旧验证资产打坏。

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `02-03` 现在可以在稳定的持久化边界之上收敛即时刷新与 scheduled refresh 的 shared options contract
- 当前 Phase 2 剩余主要工作只剩入口契约统一，不再需要同时处理无效价格和半完成写入两个风险
- 当前没有发现阻塞 `02-03` 的新问题

## Self-Check: PASSED

---
*Phase: 02-price-data-correctness*
*Completed: 2026-03-18*
