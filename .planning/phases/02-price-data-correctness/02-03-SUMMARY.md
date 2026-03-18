---
phase: 02-price-data-correctness
plan: '03'
subsystem: api
tags: [checker, scheduler, subscriptions, contract, testing]
requires:
  - phase: phase-02-01
    provides: explicit invalid-price filtering before any refresh persistence
  - phase: phase-02-02
    provides: batched snapshot and event persistence inside refreshSingleApp
provides:
  - `buildRefreshOptions(...)` now serves as the single contract for subscription-create and scheduled refresh entrypoints.
  - Subscription creation and scheduler tests lock the only allowed differences to `notifyDrops`, `source`, and `requestId`.
affects: [phase-03, scheduler-safety, subscription-flow, price-integrity]
tech-stack:
  added: []
  patterns:
    - Refresh entrypoints derive behavior from a shared trigger-to-options contract instead of handwritten inline objects.
    - Contract tests assert request metadata and notification policy at the call boundary, not just refresh outcomes.
key-files:
  created:
    - apps/worker/test/subscriptions.create.test.ts
  modified:
    - apps/worker/src/lib/checker.ts
    - apps/worker/src/lib/checker.types.ts
    - apps/worker/src/services/subscriptions.ts
    - apps/worker/test/scheduler.rate-limit.test.ts
key-decisions:
  - "Centralize refresh option construction in `buildRefreshOptions(...)` so Phase 2 rules cannot drift between entrypoints."
  - "Give subscription-create refreshes a deterministic `subscription-create:{id}` requestId to make the manual path observable in logs and tests."
patterns-established:
  - "共享 refresh 规则通过 trigger 派生 options，入口层只负责提供上下文，不再手写策略字段。"
  - "入口契约回归测试要同时锁定 `notifyDrops`、`source` 和 `requestId`，避免未来只测业务结果而漏掉策略漂移。"
requirements-completed: [PRICE-05]
duration: 4 min
completed: 2026-03-18
---

# Phase 02: 价格数据正确性 Summary

**即时刷新与定时巡检现在通过同一个 `buildRefreshOptions(...)` contract 进入共享规则路径，只保留提醒策略和 request metadata 的显式差异**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T08:27:43Z
- **Completed:** 2026-03-18T08:32:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- 提取 `buildRefreshOptions(...)` 作为共享入口契约，让 scheduled refresh 不再内联 refresh options
- 让订阅创建后的即时刷新复用同一 contract，并附带确定性的 `subscription-create:{subscriptionId}` requestId
- 新增 `subscriptions.create.test.ts` 并扩展 scheduler 参数断言，直接锁住 manual 与 scheduled 两条入口的显式差异

## Task Commits

Each task was committed atomically:

1. **Task 1: 提取共享 refresh options contract** - `9d13f3c` (refactor)
2. **Task 2: 让订阅创建入口复用共享 contract，并补参数级回归测试** - `b89cdac` (test)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/src/lib/checker.ts` - 新增 `buildRefreshOptions(...)` 并让 scheduled refresh 走统一 contract
- `apps/worker/src/lib/checker.types.ts` - 定义 `RefreshTrigger` 与共享 execution context 类型
- `apps/worker/src/services/subscriptions.ts` - 让 subscription-create 路径复用共享 contract，并生成确定性 requestId
- `apps/worker/test/subscriptions.create.test.ts` - 回归保护订阅创建入口的 manual refresh contract
- `apps/worker/test/scheduler.rate-limit.test.ts` - 锁定 scheduled refresh 的 `notifyDrops`、`source` 和 `requestId` 契约

## Decisions Made

- 用 `buildRefreshOptions(...)` 收敛即时刷新与巡检的策略字段，后续规则调整只需要改一个入口
- 把 request metadata 纳入测试断言，避免未来“逻辑共用但传参漂移”的隐性回归

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 的三个成功条件现在都已满足，价格解析、持久化边界和入口契约已形成连续护栏
- Phase 3 可以在这套共享 refresh contract 之上继续补巡检互斥、任务级统计和生产鉴权
- 当前没有发现阻塞 Phase 3 规划的新问题

## Self-Check: PASSED

---
*Phase: 02-price-data-correctness*
*Completed: 2026-03-18*
