---
phase: 01-data-baseline-deployability
plan: '03'
subsystem: testing
tags: [vitest, smoke, worker, regression]
requires: []
provides:
  - Schema bootstrap regression coverage for 0000_init.sql and 0001_price_change_events.sql.
  - A worker-level smoke flow covering health, subscription creation, cron check, and price history retrieval.
  - A single test:smoke command for Phase 1 verification.
affects: [phase-01-02, phase-01-verification, worker-testing]
tech-stack:
  added: []
  patterns:
    - SQL assets are protected by file-level regression tests before README guidance points at them.
    - Worker smoke verification uses worker.fetch with mocked DB/App Store/email boundaries.
key-files:
  created: []
  modified:
    - apps/worker/test/schema.bootstrap.test.ts
    - apps/worker/test/fresh-install.smoke.test.ts
    - apps/worker/package.json
key-decisions:
  - "Keep the smoke test at worker.fetch level so Phase 1 verifies route wiring, auth middleware, and services together."
  - "Expose a dedicated test:smoke command instead of relying on ad hoc Vitest path filters."
patterns-established:
  - "Phase 1 verification should be runnable through a single documented command."
  - "Fresh-install regressions should be expressed as deterministic mocks instead of live third-party calls."
requirements-completed: [DATA-02]
duration: 1 min
completed: 2026-03-18
---

# Phase 01: 数据基线与可部署性 Summary

**Vitest 现在能用一条 `test:smoke` 命令验证 schema baseline 和最小 worker 请求闭环**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T07:17:23Z
- **Completed:** 2026-03-18T07:18:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 新增 `schema.bootstrap.test.ts`，直接检查 `0000_init.sql` 和 `0001_price_change_events.sql` 的关键 contract
- 新增 `fresh-install.smoke.test.ts`，通过 `worker.fetch` 验证健康检查、订阅创建、巡检触发和价格历史读取
- 在 `apps/worker/package.json` 中暴露 `test:smoke`，把 Phase 1 的 smoke verification 固化成单一命令

## Task Commits

Each task was committed atomically:

1. **Task 1: Add a schema bootstrap regression test for the canonical SQL assets** - `a1593bf` (test)
2. **Task 2: Add a request-level fresh install smoke test and expose it as test:smoke** - `519457f` (test)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/test/schema.bootstrap.test.ts` - 保护 baseline SQL 与 legacy migration 的文件级契约
- `apps/worker/test/fresh-install.smoke.test.ts` - 通过 mocked worker 边界验证最小 API 闭环
- `apps/worker/package.json` - 增加 `test:smoke` 命令供 Phase 1 使用

## Decisions Made

- smoke 测试放在 `worker.fetch` 层，而不是只测 service，确保 Hono 路由和鉴权中间件也被覆盖
- `test:smoke` 只跑 Phase 1 关心的两个测试文件，避免后续 README 文档引用模糊的局部命令

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-02` 现在可以把 `db:push` 和 `test:smoke` 作为唯一推荐 bootstrap / smoke 路径写入文档
- Phase 1 已经具备 schema 与 smoke 两条验证护栏，剩余工作集中在 README 和 env examples 对齐
- 当前没有发现阻塞 `01-02` 的新问题

## Self-Check: PASSED

---
*Phase: 01-data-baseline-deployability*
*Completed: 2026-03-18*
