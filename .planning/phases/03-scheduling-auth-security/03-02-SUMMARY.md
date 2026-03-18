---
phase: 03-scheduling-auth-security
plan: '02'
subsystem: auth
tags: [worker, auth, rate-limit, credentials, drizzle]
requires:
  - phase: phase-03-01
    provides: 调度侧互斥与统计基线已完成，本计划聚焦认证安全护栏
provides:
  - 认证链路新增数据库支撑的 `auth_rate_limits` 状态和统一 helper。
  - 密码登录、验证码发送/验证、忘记密码、重置密码全部接入统一限流策略。
  - 签发新 login code / reset token 时会显式淘汰旧的未使用凭证。
  - 新增 `auth.security.test.ts` 回归覆盖 AUTH-01 / AUTH-02 高风险边界。
affects: [phase-03-03, phase-03-04, auth-safety, regression-tests]
tech-stack:
  added: []
  patterns:
    - 认证高风险入口统一执行 `assert -> failure record/clear` 的限流流程。
    - 凭证签发采用 issue-new-revoke-old，避免并存多个可用凭证。
key-files:
  created:
    - apps/worker/drizzle/0003_auth_security_limits.sql
    - apps/worker/src/services/auth-rate-limit.ts
    - apps/worker/test/auth.security.test.ts
  modified:
    - apps/worker/src/db/schema.ts
    - apps/worker/src/constants/env.ts
    - apps/worker/src/env.ts
    - apps/worker/src/types.ts
    - apps/worker/src/services/auth.ts
key-decisions:
  - "统一使用 scope + subjectKey 的数据库限流模型，避免 Worker 无状态导致的限流漂移。"
  - "login code / reset token 在新签发前先淘汰旧凭证，确保同类凭证单活。"
patterns-established:
  - "Auth flow 统一复用 `auth-rate-limit` helper，不在路由层散落限流分支。"
  - "429 响应继续复用 `retryAfterSeconds`，保持现有前后端契约稳定。"
requirements-completed: [AUTH-01, AUTH-02]
duration: 16 min
completed: 2026-03-18
---

# Phase 03: 调度与认证安全 Summary

**认证主流程现已具备统一数据库限流与旧凭证淘汰策略，并用确定性测试锁定爆破与凭证并存风险**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-18T09:40:00Z
- **Completed:** 2026-03-18T09:56:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- 新增 `auth_rate_limits` schema/migration/env 配置，并提供 `assertAuthRateLimit`、`recordAuthRateLimitFailure`、`clearAuthRateLimit` 三个统一 helper。
- `auth.ts` 中登录/验证码/忘记密码/重置密码全部接入统一限流，同时在新凭证签发前显式回收旧 login code / reset token。
- 新增 `apps/worker/test/auth.security.test.ts`，覆盖密码登录爆破、验证码验证爆破、login code 淘汰、reset token 淘汰四个核心回归场景。

## Task Commits

Each task was committed atomically:

1. **Task 1: 新增 auth rate-limit schema、helper 和配置默认值** - `74272e6` (feat)
2. **Task 2: 把限流和旧凭证淘汰规则接入 auth 主流程** - `19e01f7` (feat)
3. **Task 3: 为 auth 安全护栏补确定性的回归测试** - `b6ebc0e` (test)

**Plan metadata:** pending

## Files Created/Modified

- `apps/worker/drizzle/0003_auth_security_limits.sql` - 新增认证限流状态表
- `apps/worker/src/services/auth-rate-limit.ts` - 统一限流判断/失败记账/成功清理 helper
- `apps/worker/src/services/auth.ts` - 接入五个 scope 的限流规则与旧凭证淘汰
- `apps/worker/test/auth.security.test.ts` - 安全护栏回归测试

## Decisions Made

- 认证限流使用数据库持久化窗口计数，而不是实例内内存计数，保证跨请求/跨实例一致性。
- 429 响应维持 `retryAfterSeconds` 字段，不引入新的 response shape，避免与现有客户端契约冲突。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `vitest run -- test/auth.security.test.ts` 在当前项目会运行 worker 包内全部测试文件；本计划三次验证均全量通过，无额外阻塞。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-03 可在当前认证安全基线之上继续强化 `/api/jobs/check` 的生产门禁。
- 03-04 可直接复用 `auth.security.test.ts` 与既有 scheduler 测试继续补高风险边界覆盖。
- 当前无阻塞下一计划执行的已知问题。

## Self-Check: PASSED

---
*Phase: 03-scheduling-auth-security*
*Completed: 2026-03-18*
