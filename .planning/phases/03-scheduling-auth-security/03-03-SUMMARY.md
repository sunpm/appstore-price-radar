---
phase: 03-scheduling-auth-security
plan: '03'
subsystem: api
tags: [worker, scheduler, auth-guard, cron-secret]
requires:
  - phase: phase-03-01
    provides: 手动与定时巡检统一复用 `runProtectedPriceCheck(...)` 的互斥与统计能力
  - phase: phase-03-02
    provides: 认证与安全策略基线已建立，本计划补齐手动巡检入口门禁
provides:
  - `POST /api/jobs/check` 改为默认关闭，只有显式开启且 secret 正确才可访问
  - 手动巡检入口在配置缺失时返回结构化 404/503/401 错误
  - 新增 route 级回归测试覆盖 disabled/missing-secret/invalid-secret/completed/skipped
  - 文档、示例变量与 smoke 路径同步到新的运维前置条件
affects: [phase-03-04, operations, scheduler-security]
tech-stack:
  added: []
  patterns:
    - 手动高风险入口采用 deny-by-default 开关 + secret guard 的双门禁策略
    - manual 与 scheduled 持续共用同一 protected job service，避免逻辑漂移
key-files:
  created:
    - apps/worker/test/jobs.check-route.test.ts
  modified:
    - apps/worker/src/index.ts
    - apps/worker/src/env.ts
    - apps/worker/src/constants/env.ts
    - apps/worker/src/types.ts
    - apps/worker/.dev.vars.example
    - README.md
    - apps/worker/test/fresh-install.smoke.test.ts
key-decisions:
  - "手动巡检入口默认关闭（404），避免凭 secret 漏配导致公网裸露。"
  - "当手动巡检显式开启但 CRON_SECRET 缺失时返回 503，直接暴露配置错误。"
patterns-established:
  - "手动巡检路由只负责 gate 与转发，不分叉调度逻辑。"
  - "路由门禁调整后，同步更新 smoke 与运维文档，保证路径一致。"
requirements-completed: [AUTH-03, PRICE-04]
duration: 6 min
completed: 2026-03-18
---

# Phase 03 Plan 03: 强化 `/api/jobs/check` 的生产鉴权与配置保护 Summary

**手动巡检入口现已改为默认不可达，只有 `MANUAL_PRICE_CHECKS_ENABLED=true` 且 `CRON_SECRET` 正确时才会复用 protected job service 执行巡检**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T10:00:37Z
- **Completed:** 2026-03-18T10:06:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- 新增 `MANUAL_PRICE_CHECKS_ENABLED` 环境开关（默认 `false`），并在路由层实现 404/503/401 的严格门禁策略。
- `POST /api/jobs/check` 在通过门禁后继续调用 `runProtectedPriceCheck(config, { trigger: 'manual' })`，保持与 scheduled 巡检同一套互斥与 summary 语义。
- 新增 `jobs.check-route.test.ts` 并更新 `fresh-install.smoke.test.ts`、`.dev.vars.example`、`README.md`，让测试和运维路径与新策略一致。

## Task Commits

Each task was committed atomically:

1. **Task 1: 为手动巡检入口增加显式开关和严格 secret guard** - `af1f1fd` (feat)
2. **Task 2: 更新本地示例、README 和 smoke 验证，使新门禁有一致的运维路径** - `1f09081` (docs)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/src/index.ts` - 新增 `MANUAL_PRICE_CHECKS_ENABLED` / `CRON_SECRET` 路由门禁分支
- `apps/worker/src/env.ts` - 解析 `MANUAL_PRICE_CHECKS_ENABLED` 并设默认值
- `apps/worker/src/constants/env.ts` - 增加默认开关常量
- `apps/worker/src/types.ts` - 补充 worker binding 类型
- `apps/worker/test/jobs.check-route.test.ts` - 新增手动巡检 route guard 回归测试
- `apps/worker/test/fresh-install.smoke.test.ts` - smoke 绑定加入 `MANUAL_PRICE_CHECKS_ENABLED`
- `apps/worker/.dev.vars.example` - 新增开关示例与本地联调说明
- `README.md` - 文档化手动巡检前置条件与错误语义

## Decisions Made

- 手动巡检入口采用 deny-by-default（`MANUAL_PRICE_CHECKS_ENABLED=false`）以消除 secret 漏配暴露风险。
- 配置错误返回 `503` 明确提示 `CRON_SECRET is required when manual price checks are enabled`，避免 silent fallback。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm --filter @appstore-price-radar/worker test -- <file>` 在当前脚本配置下会运行 worker 全量测试；本计划通过在 Task 2 同步更新 smoke 配置后，计划级验证保持全绿。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-04 可直接在当前门禁与 route 测试基础上补齐调度/认证高风险边界联测。
- 当前无阻塞下一计划执行的已知问题。

## Self-Check: PASSED

---
*Phase: 03-scheduling-auth-security*
*Completed: 2026-03-18*
