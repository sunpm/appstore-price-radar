---
phase: 04-contract-frontend-stability
plan: '01'
subsystem: contracts
tags: [contracts, auth, subscriptions, prices, worker, web]
requires:
  - phase: 03-scheduling-auth-security
    provides: 已收紧的认证/订阅/价格历史能力，供 Phase 4 收敛为共享 DTO surface
provides:
  - 共享 `@appstore-price-radar/contracts` workspace package，集中定义 auth / subscriptions / prices DTO
  - Worker auth / subscriptions / prices route 改为通过显式 mapper 输出共享 DTO
  - Web auth / profile / app detail 类型改为直接消费共享 contracts
  - 契约 shape 回归测试与 smoke 断言同步到新的 DTO 结构
affects: [phase-04-contract-frontend-stability, phase-05-feed-performance-regression]
tech-stack:
  added:
    - @appstore-price-radar/contracts
  patterns:
    - workspace-shared DTO contract
    - explicit worker-to-http mapper
    - response-shape regression tests
key-files:
  created:
    - .planning/phases/04-contract-frontend-stability/04-01-SUMMARY.md
  modified:
    - apps/web/package.json
    - apps/worker/package.json
    - apps/web/src/views/auth/types.ts
    - apps/web/src/views/profile/types.ts
    - apps/web/src/views/app/types.ts
    - apps/worker/src/routes/auth.ts
    - apps/worker/src/routes/subscriptions.ts
    - apps/worker/src/routes/prices.ts
    - apps/worker/src/services/auth.ts
    - apps/worker/src/services/subscriptions.ts
    - apps/worker/src/services/prices.ts
    - apps/worker/test/auth.test.ts
    - apps/worker/test/subscriptions.create.test.ts
    - apps/worker/test/checker.price-change.test.ts
    - apps/worker/test/fresh-install.smoke.test.ts
key-decisions:
  - `@appstore-price-radar/contracts` 作为 Web 与 Worker 共享 DTO 的唯一 source of truth，消费方必须显式声明 `workspace:*` 依赖。
  - Worker HTTP 层统一通过 `toAuthUserDto`、`toSubscriptionItemDto`、`toAppSnapshotDto`、`toPriceChangeEventDto` 输出 ISO string DTO，而不是直接回传数据库记录。
patterns-established:
  - "共享 contracts package 必须同时接入 Web / Worker package.json 和 lockfile，避免类型引用存在但 workspace link 缺失。"
  - "DTO contract 回归测试要随返回体演进同步更新 smoke / service tests，避免旧结构假阳性。"
requirements-completed: [API-01]
duration: 20 min
completed: 2026-03-18
---

# Phase 4 Plan 01: 收敛认证与订阅 DTO 契约 Summary

**认证、订阅和价格历史现在共享同一份 TypeScript DTO 契约，Worker 返回体也已经切换到显式 mapper 输出。**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-18T11:33:38Z
- **Completed:** 2026-03-18T11:52:50Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- 新增 `packages/contracts` workspace package，集中定义 `Auth*Dto`、`Subscription*Dto`、`PriceHistory*Dto` 并统一导出。
- 为 `apps/web` 与 `apps/worker` 接入 `@appstore-price-radar/contracts: workspace:*`，让 contracts 成为真正可解析、可复用的共享依赖。
- Worker auth / subscriptions / prices route 切到共享 DTO 命名，并在 service 层新增显式 mapper，把 `Date` 转为 ISO string。
- Web auth / profile / app detail 类型改为直接消费共享 contracts，不再手写同构接口。
- 补齐 auth/subscription DTO 断言，并同步修正 price history / smoke 测试以匹配新的 contract shape。

## Task Commits

Each task was committed atomically:

1. **Task 1: 建立共享 contracts workspace package，承载 auth / subscription / history DTO** - `a97834a` (feat)
2. **Task 2: 让 Worker 和 Web 都切到共享 DTO，并增加 response shape 回归断言** - `7908f43` (feat)

**Plan metadata:** to be committed with this summary/state/roadmap update.

## Files Created/Modified

- `packages/contracts/src/auth.ts` - 定义 auth 共享 DTO。
- `packages/contracts/src/subscriptions.ts` - 定义 subscriptions 共享 DTO。
- `packages/contracts/src/prices.ts` - 定义 history response/page/summary 共享 DTO。
- `apps/worker/src/services/auth.ts` - 新增 `toAuthUserDto` / `toAuthSessionDto`。
- `apps/worker/src/services/subscriptions.ts` - 新增 `toSubscriptionItemDto` 并规范 nullable 输出。
- `apps/worker/src/services/prices.ts` - 新增 `toAppSnapshotDto` / `toPriceChangeEventDto` / summary mapper。
- `apps/web/src/views/auth/types.ts` - 切换到共享 auth contracts，并用 success/error union 保留发送验证码响应分支。
- `apps/web/src/views/profile/types.ts` - 切换到共享 subscription/history contracts。
- `apps/web/src/views/app/types.ts` - 详情页类型切换到共享 `PriceHistoryResponseDto`。
- `apps/worker/test/auth.test.ts` - 增加 auth mapper DTO 断言。
- `apps/worker/test/subscriptions.create.test.ts` - 锁定 subscription DTO shape 与 ISO 时间字段。
- `apps/worker/test/checker.price-change.test.ts` - 改为断言 history DTO 的 ISO string、page 与 summary。
- `apps/worker/test/fresh-install.smoke.test.ts` - 去掉旧的 `latest` 期待，跟随新的 subscription create contract。

## Decisions Made

- 共享 DTO package 不挂在 root importer，而是只由真实消费方 `apps/web` 与 `apps/worker` 显式依赖，保持 workspace 结构清晰。
- `SendLoginCodeResponseDto` 保持成功响应语义，Web 侧通过 `SendLoginCodeResponseDto | AuthErrorDto` 处理真实返回分支，而不是把错误字段塞进成功 DTO。

## Deviations from Plan

- **[Rule 3 - Blocking] 修正 contracts workspace 依赖接线** — Found during: Task 2 | Issue: `pnpm typecheck` 失败，`apps/web` 无法解析 `@appstore-price-radar/contracts` | Fix: 在 `apps/web/package.json`、`apps/worker/package.json` 增加 `workspace:*` 依赖并刷新 lockfile | Files modified: `apps/web/package.json`, `apps/worker/package.json`, `pnpm-lock.yaml` | Verification: `pnpm install`, `pnpm typecheck` | Commit hash: `7908f43`
- **[Rule 1 - Bug] 同步修正旧测试对 DTO 结构的假设** — Found during: Task 2 verification | Issue: 共享 DTO 落地后，price history 测试仍按 `Date` 读取 `changedAt`，smoke 仍期待 subscription create 返回 `latest` 字段 | Fix: 更新 `checker.price-change.test.ts` 与 `fresh-install.smoke.test.ts` 断言为新 contract，确保 suite 与生产结构一致 | Files modified: `apps/worker/test/checker.price-change.test.ts`, `apps/worker/test/fresh-install.smoke.test.ts` | Verification: `pnpm --filter @appstore-price-radar/worker test -- test/auth.test.ts test/subscriptions.create.test.ts` | Commit hash: `7908f43`

---

**Total deviations:** 2 auto-fixed (1 bug, 0 missing critical, 1 blocking)
**Impact on plan:** 无负面影响，反而补齐了 contracts 接入和旧测试漂移，降低了后续 wave 继续演进时的隐性回归风险。

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `API-01` 已闭环：auth / subscriptions / prices DTO 具备单一 source of truth。
- Wave 2 可以直接在这份共享 contracts 之上推进前端 unauthorized 链路收敛与 history 分页改造。
- 目前没有发现阻塞 `04-02` / `04-03` 并行执行的新问题。

## Self-Check: PASSED

---
*Phase: 04-contract-frontend-stability*
*Completed: 2026-03-18*
---
