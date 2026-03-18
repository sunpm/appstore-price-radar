---
phase: 01-data-baseline-deployability
plan: '01'
subsystem: database
tags: [drizzle, postgres, migrations, schema]
requires: []
provides:
  - Fresh-install baseline SQL now creates app_price_change_events and its runtime indexes.
  - Legacy migration backfills app_price_history into app_price_change_events only when the source table exists.
affects: [phase-01-03, phase-01-02, database-bootstrap]
tech-stack:
  added: []
  patterns:
    - Baseline SQL mirrors the runtime Drizzle schema for change-event tables.
    - Legacy migrations guard optional backfills so rebuilt environments stay idempotent.
key-files:
  created: []
  modified:
    - apps/worker/drizzle/0000_init.sql
    - apps/worker/drizzle/0001_price_change_events.sql
key-decisions:
  - "Keep app_price_change_events DDL in both baseline and follow-up migration so fresh installs and legacy upgrades share the same target table."
  - "Guard the legacy app_price_history backfill with to_regclass() instead of assuming the source table always exists."
patterns-established:
  - "Database baseline first: tables required by runtime code must exist in 0000_init.sql."
  - "Legacy data migrations should stay idempotent and conditional when they depend on older tables."
requirements-completed: [DATA-01]
duration: 2 min
completed: 2026-03-18
---

# Phase 01: 数据基线与可部署性 Summary

**Fresh-install baseline SQL 现在直接创建价格变化事件表，legacy migration 也只在旧历史表存在时执行幂等回填**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T07:01:06Z
- **Completed:** 2026-03-18T07:03:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 将 `app_price_change_events` 表及其索引前移到 `0000_init.sql`，让 fresh install 与运行时代码保持一致
- 把 `0001_price_change_events.sql` 改造成 legacy-safe 的回填迁移，避免 rebuilt 环境因缺少 `app_price_history` 失败
- 用 `pnpm --filter @appstore-price-radar/worker typecheck` 和计划内 grep 校验确认 schema contract 已收敛

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the baseline SQL to match the current runtime schema** - `1e247ca` (fix)
2. **Task 2: Convert the follow-up migration into a legacy-safe backfill step** - `ef2eebc` (fix)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/drizzle/0000_init.sql` - 在 baseline 中定义 `app_price_change_events` 表和索引
- `apps/worker/drizzle/0001_price_change_events.sql` - 只在 `app_price_history` 存在时执行 legacy 回填，并保留冲突幂等保护

## Decisions Made

- 保留 `0001_price_change_events.sql` 中的建表语句，确保旧环境升级时仍能拿到目标表结构
- 将 legacy 回填包在 `DO $$` 条件块中，让 rebuilt/fresh-install 环境不会因为旧表缺失而失败

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-03` 现在可以基于稳定的 baseline SQL 补 smoke / regression tests
- `01-02` 后续只需要把已经落地的 bootstrap truth 写回 README 和 env examples
- 当前没有发现阻塞 `01-03` 的新问题

## Self-Check: PASSED

---
*Phase: 01-data-baseline-deployability*
*Completed: 2026-03-18*
