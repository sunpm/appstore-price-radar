---
phase: 03-scheduling-auth-security
plan: '01'
subsystem: scheduler
tags: [worker, scheduler, lease, drizzle, testing]
requires:
  - phase: phase-02-03
    provides: shared refresh options contract for scheduled checks
provides:
  - `price-check` 任务具备 run-level 互斥租约，重复触发会返回结构化 skip 结果。
  - 每轮巡检会把 `scanned/succeeded/skipped/failed/updated/drops/emailsSent/errorSummary` 持久化到 `price_check_runs`。
  - scheduled/manual 入口统一走 `runProtectedPriceCheck(...)`，共用租约和 summary 契约。
affects: [phase-03-02, phase-03-03, scheduler-safety, ops-observability]
tech-stack:
  added: []
  patterns:
    - Job orchestration 与核心 checker 解耦，入口层只处理 trigger 和响应语义。
    - run summary 字段在 `CheckReport` 与 `price_check_runs` 间保持一一对应。
key-files:
  created:
    - apps/worker/drizzle/0002_job_locks_price_check_runs.sql
    - apps/worker/src/services/jobs.ts
    - apps/worker/test/scheduler.job-lock.test.ts
  modified:
    - apps/worker/src/db/schema.ts
    - apps/worker/src/env.ts
    - apps/worker/src/constants/env.ts
    - apps/worker/src/types.ts
    - apps/worker/src/lib/checker.ts
    - apps/worker/src/lib/checker.types.ts
    - apps/worker/src/index.ts
    - apps/worker/test/scheduler.rate-limit.test.ts
    - apps/worker/test/fresh-install.smoke.test.ts
key-decisions:
  - "租约采用 `job_leases(lock_key)` 单行互斥模型，锁冲突返回结构化 skip，而不是让重复巡检继续执行。"
  - "run summary 在执行完成后统一回写 `price_check_runs`，错误摘要保留前 N 条并标记余量，便于排障。"
patterns-established:
  - "调度入口与手动入口复用同一 protected service，避免并发语义漂移。"
  - "巡检统计按 `succeeded/skipped/failed` 显式计数，`errors` 仅承载诊断信息。"
requirements-completed: [PRICE-03, PRICE-04]
duration: 8 min
completed: 2026-03-18
---

# Phase 03: 调度与认证安全 Summary

**价格巡检现在具备 run-level 互斥与结构化运行摘要，重复触发会显式跳过并可持久化追踪本轮执行结果**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T09:28:00Z
- **Completed:** 2026-03-18T09:36:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- 新增 `job_leases` 与 `price_check_runs` schema/migration，并补齐 `PRICE_CHECK_LOCK_TTL_SECONDS` 配置入口。
- 引入 `runProtectedPriceCheck(...)` orchestration service，scheduled/manual 入口统一复用互斥与 summary 持久化语义。
- 扩展巡检统计契约与测试，确保 `succeeded/skipped/failed` 计数和 duplicate-run skip 行为可回归验证。

## Task Commits

Each task was committed atomically:

1. **Task 1: 增加巡检租约和运行摘要 schema，并把配置补齐到 env/types** - `82e6d67` (feat)
2. **Task 2: 抽出受保护的巡检 orchestration service，并让 scheduled 入口使用它** - `d520aa1` (feat)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/drizzle/0002_job_locks_price_check_runs.sql` - 新增租约与 run summary 表结构
- `apps/worker/src/db/schema.ts` - 导出 `jobLeases/priceCheckRuns` 与对应类型
- `apps/worker/src/services/jobs.ts` - 新增受保护巡检 service（互斥、持久化、释放锁）
- `apps/worker/src/lib/checker.ts` - 引入 `succeeded/skipped/failed` 统计更新规则
- `apps/worker/src/index.ts` - scheduled/manual 入口改为调用 `runProtectedPriceCheck(...)`
- `apps/worker/test/scheduler.job-lock.test.ts` - 回归锁定 completed 与 duplicate-run skip 语义

## Decisions Made

- `CheckReport` 与 `price_check_runs` 的 summary 字段保持同构，避免后续 phase 出现统计口径漂移。
- 重复巡检被定义为业务语义上的 `skipped`，而不是异常，这样日志和运维视图都更稳定。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fresh-install smoke DB mock 与新 orchestration DB 调用不兼容**
- **Found during:** Task 2 验证 (`scheduler.job-lock` / `scheduler.rate-limit` 命令触发全量 worker 测试)
- **Issue:** `fresh-install.smoke.test` 的 in-memory DB mock 缺少 `job_leases/price_check_runs` 的 insert/update/delete 链式行为，导致 route 测试报错
- **Fix:** 为 smoke mock 增补 `jobLeases/priceCheckRuns` 分支与租约释放语义，保持现有 smoke 用例可执行
- **Files modified:** `apps/worker/test/fresh-install.smoke.test.ts`
- **Verification:** `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.job-lock.test.ts test/scheduler.rate-limit.test.ts`
- **Committed in:** `d520aa1` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 3: 1)
**Impact on plan:** 仅为消除测试阻塞的兼容修复，无范围扩张；计划目标全部达成。

## Issues Encountered

- `vitest run -- test/...` 在当前项目中会继续执行 worker 包内全部测试文件，因此在目标测试通过后仍暴露了 smoke mock 的兼容缺口；已在同一任务内修复并回归通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-02 可以直接复用 `price_check_runs` 的 summary 结构继续补 auth 限流/凭证淘汰能力。
- 03-03 可在已有 `runProtectedPriceCheck(...)` 基础上收紧 `/api/jobs/check` 的生产门禁策略。
- 当前无阻塞下一计划执行的已知问题。

## Self-Check: PASSED

---
*Phase: 03-scheduling-auth-security*
*Completed: 2026-03-18*
