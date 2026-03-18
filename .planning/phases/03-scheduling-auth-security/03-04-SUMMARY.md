---
phase: 03-scheduling-auth-security
plan: '04'
subsystem: testing
tags: [scheduler, auth, security, vitest]
requires:
  - phase: 03-scheduling-auth-security
    provides: 03-01/03-02/03-03 的调度互斥、认证限流与手动路由门禁实现
provides:
  - 调度 duplicate-run、run summary、失败摘要的高风险回归测试
  - 手动巡检路由 lease 冲突返回结构化 skip 的回归测试
  - 认证限流清理、旧 login code 淘汰、reset token 爆破限制回归测试
  - MANUAL_PRICE_CHECKS_ENABLED=true 下 smoke happy path + 缺少 secret 头的 401 负向断言
affects: [phase-04-contract-frontend-stability, phase-05-feed-performance-regression]
tech-stack:
  added: []
  patterns: [high-risk boundary regression tests, deterministic in-memory db mocks]
key-files:
  created: [.planning/phases/03-scheduling-auth-security/03-04-SUMMARY.md]
  modified:
    - apps/worker/test/scheduler.job-lock.test.ts
    - apps/worker/test/jobs.check-route.test.ts
    - apps/worker/test/auth.security.test.ts
    - apps/worker/test/fresh-install.smoke.test.ts
key-decisions:
  - 通过精确用例名锁定 PRICE-03/PRICE-04/AUTH-01/AUTH-02/AUTH-03 的测试映射，避免 requirement 漂移
  - 在 auth 测试 mock 中增加可控的 login-code hash 消费过滤，显式验证旧 code 被新 code 淘汰后不可用
patterns-established:
  - "高风险边界测试必须包含正向和负向路径（例如 happy path + missing secret 401）"
  - "调度类测试同时锁定运行结果与持久化摘要字段，避免只测返回体不测落库"
requirements-completed: [PRICE-03, PRICE-04, AUTH-01, AUTH-02, AUTH-03]
duration: 5 min
completed: 2026-03-18
---

# Phase 3 Plan 04: 补调度与认证高风险边界测试 Summary

**为调度互斥、run summary、手动巡检门禁与认证限流/凭证淘汰补齐了可持续回归基线。**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-18T10:15:13Z
- **Completed:** 2026-03-18T10:20:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- 扩展 scheduler/job route 测试，锁住 duplicate-run skip、summary 统计与异常摘要落库语义。
- 扩展 auth 安全测试，覆盖 reset token 爆破限流、登录限流成功后清理、旧 login code 淘汰拒绝。
- 扩展 fresh install smoke，确认手动巡检在 `MANUAL_PRICE_CHECKS_ENABLED=true` 下 happy path 正常，同时缺少 secret 头会返回 `401`。

## Task Commits

Each task was committed atomically:

1. **Task 1: 补 scheduler 高风险边界测试，锁住 duplicate-run 与 run summary 契约** - `8dcd3e5` (test)
2. **Task 2: 补 auth 与 smoke 高风险边界测试，锁定限流和旧凭证淘汰** - `0551364` (test)

**Plan metadata:** to be committed with this summary/state/roadmap update.

## Files Created/Modified
- `.planning/phases/03-scheduling-auth-security/03-04-SUMMARY.md` - 本 plan 执行结果、验证与决策记录。
- `apps/worker/test/scheduler.job-lock.test.ts` - 调度租约冲突、run summary 统计、失败 errorSummary 回归。
- `apps/worker/test/jobs.check-route.test.ts` - 手动路由 lease 冲突结构化 skip payload 回归。
- `apps/worker/test/auth.security.test.ts` - 认证限流清理、旧 code 淘汰、invalid reset token 限流回归。
- `apps/worker/test/fresh-install.smoke.test.ts` - 手动巡检缺少 secret header 的 `401` 负向 smoke 断言。

## Decisions Made
- 使用验收标准中的精确用例名称作为测试名，确保 requirement 到测试点的映射可搜索、可审计。
- 在不改生产逻辑的前提下增强 test doubles，以便稳定复现“旧凭证淘汰”这类高风险时序场景。

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed (0 bug, 0 missing critical, 0 blocking)
**Impact on plan:** None.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 的 5 个 requirement 已在目标测试文件中具备明确覆盖点。
- 调度与认证高风险边界回归已补齐，Phase 3 可完成并进入 Phase 4。

---
*Phase: 03-scheduling-auth-security*
*Completed: 2026-03-18*
