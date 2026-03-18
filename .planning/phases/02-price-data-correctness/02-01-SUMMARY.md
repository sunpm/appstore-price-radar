---
phase: 02-price-data-correctness
plan: '01'
subsystem: api
tags: [appstore, pricing, validation, worker]
requires: []
provides:
  - App Store lookup now distinguishes `found`, `invalid-price`, and `not-found` results.
  - Invalid App Store prices no longer fall through to snapshot or history persistence.
affects: [phase-02-02, phase-02-03, price-integrity]
tech-stack:
  added: []
  patterns:
    - External price lookups must return an explicit invalid-data branch instead of coercing fallback values.
    - `refreshSingleApp` must exit before opening a DB write path when lookup data is invalid.
key-files:
  created:
    - apps/worker/test/appstore.lookup.test.ts
  modified:
    - apps/worker/src/lib/appstore.ts
    - apps/worker/src/lib/appstore.types.ts
    - apps/worker/src/lib/checker.ts
    - apps/worker/test/checker.price-change.test.ts
key-decisions:
  - "Return a discriminated App Store lookup result so missing prices are distinguishable from real free apps."
  - "Skip invalid-price persistence before creating the DB client so snapshots and events stay untouched."
patterns-established:
  - "可信价格优先于成功率：无效第三方数据必须中止持久化。"
  - "价格采集边界负责把 malformed payload 分类为 explicit branch，而不是静默回退。"
requirements-completed: [PRICE-01]
duration: 4 min
completed: 2026-03-18
---

# Phase 02: 价格数据正确性 Summary

**App Store lookup 现在会显式返回 `invalid-price` 分支，并且 `refreshSingleApp` 会在无效价格时直接跳过所有持久化写入**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T07:59:41Z
- **Completed:** 2026-03-18T08:03:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- 将 App Store lookup contract 改成 `found / invalid-price / not-found` 三类结果，移除了缺失价格回落到 `0` 的逻辑
- 新增 `appstore.lookup.test.ts`，直接锁定有效价格和无效价格两种 lookup 返回
- 在 `refreshSingleApp` 中提前拦截 `invalid-price`，保证 snapshot、change event 和 drop event 都不会被脏数据污染

## Task Commits

Each task was committed atomically:

1. **Task 1: 把 App Store lookup 返回值改成显式的 invalid-price 契约** - `8ae1309` (fix)
2. **Task 2: 在 checker 中提前跳过 invalid-price，禁止任何持久化写入** - `715424c` (fix)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/src/lib/appstore.ts` - 返回显式的 `found` / `invalid-price` 分支，而不是回落到 `0`
- `apps/worker/src/lib/appstore.types.ts` - 定义 lookup 判别联合类型
- `apps/worker/src/lib/checker.ts` - 在 `invalid-price` 时直接告警并返回，阻断后续持久化
- `apps/worker/test/appstore.lookup.test.ts` - 回归保护 lookup 的有效价格与无效价格分支
- `apps/worker/test/checker.price-change.test.ts` - 保护 `invalid-price` 时不会写 snapshot / event / drop-event

## Decisions Made

- 用判别联合表达 lookup 结果，而不是让调用方通过 `price === 0` 猜测数据是否有效
- 无效价格分支在进入 DB 写入前就返回 `null`，避免后续 Phase 2 再去清理被污染的价格历史

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `02-02` 现在可以基于“只会收到可信价格输入”的前提，专注收敛 batched persistence 边界
- `02-03` 可以直接复用这次建立的 lookup contract，把即时刷新和巡检共享规则对齐到同一个 options contract
- 当前没有发现阻塞 `02-02` 的新问题

## Self-Check: PASSED

---
*Phase: 02-price-data-correctness*
*Completed: 2026-03-18*
