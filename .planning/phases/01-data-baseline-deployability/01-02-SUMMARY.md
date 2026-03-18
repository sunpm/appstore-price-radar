---
phase: 01-data-baseline-deployability
plan: '02'
subsystem: docs
tags: [docs, env, deployment, smoke]
requires: []
provides:
  - Canonical README guidance for database bootstrap and smoke verification.
  - Env examples aligned with the worker runtime contract and production CRON secret requirement.
affects: [phase-02-planning, onboarding, deployment]
tech-stack:
  added: []
  patterns:
    - README points to one canonical setup path instead of mixing direct SQL and Drizzle guidance.
    - Env examples mirror the same runtime contract enforced by worker code.
key-files:
  created: []
  modified:
    - README.md
    - .env.example
    - apps/worker/.dev.vars.example
key-decisions:
  - "Promote db:push and test:smoke as the single documented bootstrap and verification path for Phase 1."
  - "Document CRON_SECRET as required in production whenever POST /api/jobs/check stays exposed."
patterns-established:
  - "Operational docs should describe one official path per workflow."
  - "Env examples should match the same split used by runtime validation and deployment docs."
requirements-completed: [DATA-03]
duration: 1 min
completed: 2026-03-18
---

# Phase 01: 数据基线与可部署性 Summary

**README 与 env examples 现在把 `db:push`、`test:smoke` 和 `CRON_SECRET` 生产约束写成了单一真相**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T07:21:18Z
- **Completed:** 2026-03-18T07:22:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- README 现在明确把 `pnpm --filter @appstore-price-radar/worker db:push` 作为 fresh install 的唯一官方建库路径
- README 增加了 `pnpm --filter @appstore-price-radar/worker test:smoke`，把 smoke verification 变成文档化入口
- `.env.example` 与 `apps/worker/.dev.vars.example` 统一了前后端变量边界，并把 `CRON_SECRET` 标为生产必需条件

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the bootstrap and deployment docs around the canonical worker path** - `269a7b4` (docs)
2. **Task 2: Align env examples with the same runtime contract** - `1882ac9` (docs)

**Plan metadata:** pending

## Files Created/Modified

- `README.md` - 统一 bootstrap、smoke verification 与生产部署约束
- `.env.example` - 保持根目录 `.env` 只承载 Web 变量
- `apps/worker/.dev.vars.example` - 对齐 Worker runtime contract 和 `CRON_SECRET` 生产要求

## Decisions Made

- README 不再把直接执行 `0000_init.sql` 当作首要初始化路径，而是把 SQL 文件降级为内部资产说明
- 生产部署说明中显式指出：只要保留 `POST /api/jobs/check`，`CRON_SECRET` 就不能缺失

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 三个执行计划均已完成，下一步进入 phase goal verification
- 新同学现在可以按 README + env examples 走一条一致的本地启动路径
- 当前没有发现阻塞 Phase 1 验证的新问题

## Self-Check: PASSED

---
*Phase: 01-data-baseline-deployability*
*Completed: 2026-03-18*
