---
phase: 04-contract-frontend-stability
plan: '03'
subsystem: api-ui
tags: [contracts, pagination, vue, worker, cache, abortcontroller]
requires:
  - phase: 04-contract-frontend-stability
    provides: 04-01 共享 prices DTO 契约，供 Worker route 与 Web composable 复用
  - phase: 04-contract-frontend-stability
    provides: 04-02 共享 `useAuthedApi()` / session 基础设施，供工作台历史请求统一处理 unauthorized
provides:
  - 价格历史接口改为 `window + pageSize + cursor` 的共享分页契约
  - Worker 历史查询支持窗口过滤、`nextCursor`、`hasMore` 与 summary 元信息
  - `usePriceHistory()` 统一工作台和详情页的历史缓存、取消请求与渐进加载行为
affects: [phase-04-contract-frontend-stability, phase-05-feed-performance-regression]
tech-stack:
  added: []
  patterns:
    - shared history loading composable
    - windowed history pagination contract
    - abort-safe view switching
key-files:
  created:
    - .planning/phases/04-contract-frontend-stability/04-03-SUMMARY.md
    - apps/worker/test/prices.history.test.ts
    - apps/web/src/composables/usePriceHistory.ts
  modified:
    - packages/contracts/src/prices.ts
    - apps/worker/src/routes/prices.ts
    - apps/worker/src/services/prices.ts
    - apps/worker/src/services/prices.types.ts
    - apps/web/src/views/profile/ProfileView.vue
    - apps/web/src/views/profile/components/ProfileHistorySection.vue
    - apps/web/src/views/app/AppDetailView.vue
key-decisions:
  - prices history 契约统一切到 `window / pageSize / cursor`，不再允许前端继续依赖 `limit=3650`
  - `usePriceHistory()` 作为前端历史读取单一入口，负责缓存命中、旧请求中止和分页结果拼接顺序
  - 旧页追加时必须把更旧的数据 prepend 到现有 history 前面，保持图表和表格所需的时间正序
patterns-established:
  - "历史页数据由 shared contracts 驱动，Worker route 与 Web composable 必须共用同一份 `PriceHistoryPageDto`。"
  - "需要切换 app/country/window 的视图统一经由 `usePriceHistory()`，避免 view-local fetch 覆盖新结果。"
requirements-completed: [API-02]
duration: 40 min
completed: 2026-03-18
---

# Phase 4 Plan 03: 优化历史查询接口与前端加载策略 Summary

**价格历史查询已经从一次性全量拉取切到窗口化分页路径，工作台和详情页都能复用缓存、取消旧请求，并通过“加载更多”渐进展开历史。**

## Performance

- **Duration:** 40 min
- **Started:** 2026-03-18T12:18:00Z
- **Completed:** 2026-03-18T12:57:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- 共享 contracts 中新增 `PriceHistoryWindow`、新的 page meta 和 summary DTO，Worker route 与 Web composable 不再漂移。
- Worker 历史接口支持 `window`、`pageSize`、`cursor`，并返回 `nextCursor` / `hasMore` / `totalChanges` 等分页元信息。
- 新增 `usePriceHistory()`，统一 history cache key、`AbortController` 中止旧请求、分页加载与缓存回放。
- `ProfileView.vue` 和 `ProfileHistorySection.vue` 去掉全量历史拉取，支持窗口切换与“加载更多”。
- `AppDetailView.vue` 也切到共享 composable，详情页历史不再依赖 `limit=3650`。
- 新增 `prices.history.test.ts`，并补充既有 prices/checker 断言，覆盖默认窗口、cursor 和分页元信息。

## Task Commits

Each task was committed atomically:

1. **Task 1: 为价格历史接口增加 window / cursor / page meta 契约，并补 Worker 回归测试** - `a1d10d2` (feat)
2. **Task 2: 前端接入共享 price history composable，支持缓存、取消和渐进加载** - `3cfdd6d` (feat)

**Plan metadata:** to be committed with this summary/state/roadmap update.

## Files Created/Modified

- `packages/contracts/src/prices.ts` - 统一 history window、page meta 和 summary DTO。
- `apps/worker/src/constants/routes.ts` - 增加 history window/page size 默认值与上限常量。
- `apps/worker/src/routes/prices.ts` - query 校验改为 `window` / `pageSize` / `cursor`。
- `apps/worker/src/services/prices.ts` - 实现窗口过滤、cursor 解析、`nextCursor` 生成与分页 summary。
- `apps/worker/src/services/prices.types.ts` - 同步 service payload 到新分页契约。
- `apps/worker/test/prices.history.test.ts` - 新增 route 回归测试，覆盖默认窗口、分页截断和非法 cursor。
- `apps/worker/test/checker.price-change.test.ts` - 同步 `getPriceHistory()` 断言到新 page/summary 结构。
- `apps/web/src/composables/usePriceHistory.ts` - 共享历史加载 composable，负责缓存、中止旧请求和分页合并。
- `apps/web/src/views/profile/ProfileView.vue` - 工作台改为通过共享 composable 加载历史。
- `apps/web/src/views/profile/components/ProfileHistorySection.vue` - 增加窗口切换和“加载更多”控件，同时保留图表/表格职责。
- `apps/web/src/views/app/AppDetailView.vue` - 详情页接入共享 composable，移除全量历史请求。

## Decisions Made

- Worker 对非法 cursor 直接返回 `400 Invalid cursor`，避免默默回退造成分页状态失真。
- `usePriceHistory()` 命中缓存前也要先 abort 旧请求，防止前一次返回覆盖当前已缓存视图。

## Deviations from Plan

### Auto-fixed Issues

**1. [Correctness] 修正分页追加后的历史顺序**
- **Found during:** Task 2（共享 composable 接入详情页）
- **Issue:** 第二页及后续页返回的是更旧事件，如果直接 append 到现有 history 末尾，会打乱图表和表格依赖的时间正序。
- **Fix:** 在 `usePriceHistory()` 中把分页结果 prepend 到现有 history 前面，保持 history 始终按时间升序排列。
- **Files modified:** `apps/web/src/composables/usePriceHistory.ts`
- **Verification:** `pnpm typecheck`、`pnpm lint`
- **Committed in:** `3cfdd6d` (part of task commit)

**2. [Correctness] 修正历史请求竞争下的 loading 状态漂移**
- **Found during:** Task 2（共享 composable 状态校验）
- **Issue:** 被 abort 的旧请求会在 finally 中提前清空 `loading` / `loadingMore`，导致视图切换时出现错误空闲状态。
- **Fix:** 仅在当前 controller 仍为 active request 时才重置 loading 标记，并在缓存命中时同步清理旧请求状态。
- **Files modified:** `apps/web/src/composables/usePriceHistory.ts`
- **Verification:** `pnpm typecheck`、`pnpm lint`
- **Committed in:** `3cfdd6d` (part of task commit)

---

**Total deviations:** 2 auto-fixed (2 correctness)
**Impact on plan:** 均为保证分页与并发状态正确性的必要修正，没有引入额外 scope。

## Issues Encountered

- `zod` query default 使 route 层 `pageSize` 推断为可选，导致 `GetPriceHistoryPayload` 类型不兼容；已把 service payload 对齐为可选并继续在 service 内做默认值收敛。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 详情页已经切到共享 history composable，`04-04` 可以直接在其上补充 metadata DTO 与分层展示组件。
- 共享分页契约已经稳定，后续 Phase 5 可以围绕 summary、缓存和公开 feed 做性能优化，而不必再兼容 `limit=3650`。

## Self-Check: PASSED

---
*Phase: 04-contract-frontend-stability*
*Completed: 2026-03-18*
---
