---
phase: 05-feed-performance-regression
plan: '02'
subsystem: testing
tags: [vitest, worker, hono, auth, subscriptions, jobs]
requires:
  - phase: 05-01
    provides: 公开降价流 route/service 回归基线与 `app` request-level 测试入口
provides:
  - auth 路由 request-level 回归
  - subscriptions 路由 request-level 回归
  - jobs 手动巡检 deny-by-default 验证基线复核
  - auth 与 subscriptions service 高副作用分支回归
affects: [05-03, QA-01, worker-testing]
tech-stack:
  added: []
  patterns: [vi.hoisted mock seams, in-memory db state doubles, app.request route regression]
key-files:
  created:
    - apps/worker/test/auth.routes.test.ts
    - apps/worker/test/subscriptions.routes.test.ts
    - apps/worker/test/auth.service.test.ts
    - apps/worker/test/subscriptions.service.test.ts
  modified:
    - .planning/phases/05-feed-performance-regression/05-02-SUMMARY.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
key-decisions:
  - 保留已有 `jobs.check-route.test.ts` 作为 deny-by-default 资产，仅增量补齐本计划缺失的 auth/subscriptions 回归，避免重复改动稳定测试。
  - route-level 回归通过最小 `requireAuth` mock 锁定请求/响应契约；service-level 回归继续沿用 in-memory DB mock，避免为 Worker 再引入第二套测试框架。
patterns-established:
  - request-level 路由测试优先断言状态码、鉴权门禁、默认 schema 解析和 DTO shape。
  - service-level 测试优先锁定高副作用状态分支，如凭证复用失效、session 撤销、subscription DTO 映射与删除 404。
requirements-completed: [QA-01]
duration: 7min
completed: 2026-03-19
---

# Phase 05 Plan 02: Worker 关键路由与服务回归测试 Summary

**Vitest 回归已覆盖 auth/subscriptions 路由、手动巡检 deny-by-default 门禁，以及 auth/subscriptions service 的高副作用状态分支**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T02:50:00Z
- **Completed:** 2026-03-19T02:57:11Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- 为 `/api/auth/me`、`/api/auth/logout`、`/api/subscriptions` 建立 request-level 回归，锁住鉴权、schema 拒绝与 JSON shape。
- 复核并保留 `/api/jobs/check` 的四个 deny-by-default 门禁分支覆盖，保证 `MANUAL_PRICE_CHECKS_ENABLED` 与 `CRON_SECRET` 漂移会立即暴露。
- 为 `loginWithPassword`、`verifyLoginCode`、`revokeSession`、`createUserSubscription`、`listUserSubscriptions`、`deleteUserSubscription` 补齐 service-level 回归。

## Task Commits

每个 task 均已原子提交：

1. **Task 1: 为 auth / subscriptions / jobs 入口建立 request-level 回归测试** - `b183559` (`test`)
2. **Task 2: 为 auth / subscriptions 核心状态逻辑补 service-level 回归，锁住高副作用分支** - `f7da1b0` (`test`)

## Files Created/Modified

- `apps/worker/test/auth.routes.test.ts` - 覆盖 `/api/auth/me`、`/api/auth/login` 校验失败与 `/api/auth/logout` 响应契约。
- `apps/worker/test/subscriptions.routes.test.ts` - 覆盖 `/api/subscriptions` 的鉴权保护、默认国家码、列表/创建/删除/404 响应。
- `apps/worker/test/auth.service.test.ts` - 覆盖错误密码、登录码复用失效和 `revokeSession` 删除当前会话。
- `apps/worker/test/subscriptions.service.test.ts` - 覆盖订阅创建 DTO、`toSubscriptionItemDto` 映射排序、删除成功与缺失分支。

## Decisions Made

- 保留已有 `jobs.check-route.test.ts`，因为它已完整覆盖计划要求的 404 / 503 / 401 / 202 四条分支；本次只增量补缺口，不重写稳定资产。
- 路由回归使用最小鉴权 middleware mock，而不是接真实数据库鉴权，目的是把测试信号集中在 HTTP contract，而不是把 route 回归和 auth storage 耦死。
- service 回归延续现有 `vi.hoisted + getDb mock + 内存状态` 模式，保证新测试与现有 Worker 测试栈一致。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm --filter @appstore-price-radar/worker test -- <files...>` 在当前仓库脚本下会运行完整 worker test suite，而不是只跑指定文件；新增测试与全量 suite 均保持绿色，因此没有阻塞本计划。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QA-01` 已由 Worker route/service 双层回归收口，Phase 05 可继续进入 05-03 的 Web 关键路径测试与统一验证命令。
- 当前无新增 blocker；后续需要继续保持 Web 测试基建与 Worker contracts/测试 doubles 同步演进。

## Self-Check

PASSED

---
*Phase: 05-feed-performance-regression*
*Completed: 2026-03-19*
