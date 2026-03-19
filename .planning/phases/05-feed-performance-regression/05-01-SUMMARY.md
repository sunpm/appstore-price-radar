---
phase: 05-feed-performance-regression
plan: '01'
subsystem: api
tags:
  - worker
  - public-feed
  - drizzle
  - hono
  - vitest
  - regression
requires:
  - phase: 04-contracts-frontend-stability
    provides: 首页固定消费 `/api/public/drops?limit=120&dedupe=1` 的字段契约与 DTO 稳态
provides:
  - 公开降价流改为在数据库查询边界完成 `(appId, country)` 最新事件去重
  - `submissionCount` 只统计活跃订阅并随公开 feed 响应一起返回
  - `/api/public/drops` 的默认 query、limit clamp 与响应结构拥有 request 级回归
affects:
  - 05-02-worker-regression
  - 05-03-release-verify
  - home-feed
tech-stack:
  added: []
  patterns:
    - 使用 `selectDistinctOn + 外层排序/limit` 收敛公开 feed 去重语义
    - 使用 Hono `app.request(...)` 锁住路由 query 默认值与响应 shape
key-files:
  created:
    - apps/worker/test/public.drops.test.ts
    - apps/worker/test/public.route.test.ts
  modified:
    - apps/worker/src/services/public.ts
    - apps/worker/src/services/public.types.ts
    - apps/worker/src/routes/public.ts
    - apps/worker/src/index.ts
key-decisions:
  - 公开降价流在数据库边界完成 `(appId, country)` 去重，并用确定性的 `detectedAt DESC, id DESC` 作为最新记录判定
  - 活跃订阅数通过查询内 `submissionCount` 聚合字段返回，避免再次拼接随结果集增长的 `or(...)` 条件
  - `/api/public/drops` route 对缺省 query 显式补齐 `dedupe=true` 和默认 `limit`，对超限值做 clamp 而不是返回 400
patterns-established:
  - Pattern 1: 公开 feed 需要先在 DB 中得出最终去重集合，再对最终结果做排序和 limit
  - Pattern 2: Worker 路由回归优先用 `app.request(...)` 锁 query 解析、状态码和 JSON 结构
requirements-completed:
  - API-03
  - QA-01
duration: 11min
completed: 2026-03-19
---

# Phase 05 Plan 01: 公开降价流查询优化 Summary

**公开降价流现在在数据库边界返回最新去重降价项、活跃订阅人数和稳定的 `/api/public/drops` 路由语义**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-19T02:32:30Z
- **Completed:** 2026-03-19T02:43:38Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `getPublicDrops(...)` 不再依赖 `PUBLIC_DROPS_FETCH_MULTIPLIER` 先超量抓取再内存去重，而是先在数据库选出每个 `(appId, country)` 的最新降价事件，再做全局排序和 `limit`
- `submissionCount` 改为查询内只统计 `subscriptions.isActive = true` 的活跃订阅数，首页消费字段保持不变
- 公开 feed 的 service 与 route 都有回归测试，覆盖去重、排序、活跃订阅聚合、country filter、默认 query、limit clamp 和响应结构

## Task Commits

每个 task 都已原子提交：

1. **Task 1: 把公开 feed 的 dedupe 和关注人数聚合收敛到数据库查询边界** - `2903575` (`feat`)
2. **Task 2: 为公开 feed 建立 service + route 双层回归，锁住 dedupe、query 默认值和响应结构** - `2858878` (`fix`)

## Files Created/Modified

- `apps/worker/src/services/public.ts` - 用 `selectDistinctOn` + 查询内 `submissionCount` 取代超量抓取与内存去重
- `apps/worker/src/services/public.types.ts` - 将公开 feed item 收敛为显式 DTO shape
- `apps/worker/src/routes/public.ts` - 为 `/api/public/drops` 明确默认 query 和 limit clamp 语义
- `apps/worker/src/index.ts` - 导出 `app` 供 route request 级测试复用
- `apps/worker/test/public.drops.test.ts` - 锁住去重、排序、活跃订阅聚合与 country filter
- `apps/worker/test/public.route.test.ts` - 锁住默认 query、limit clamp、HTTP 200 和响应字段

## Decisions Made

- 公开 feed 的正确性边界必须落在数据库查询层，而不是依赖“多抓一些再裁剪”的窗口假设
- 公开 feed 的关注人数统计以最终返回集合为准，只计算活跃订阅，避免 SQL 条件随中间结果线性膨胀
- `/api/public/drops` 的 query 省略值与超限值都属于路由契约，需要由 route 显式收敛并通过 request 级测试锁住

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 修正公开 feed route 的默认 query 与 limit 上限语义**

- **Found during:** Task 2（为公开 feed 建立 service + route 双层回归，锁住 dedupe、query 默认值和响应结构）
- **Issue:** 现有 `querySchema` 在 query key 缺省时没有把 `dedupe` / `limit` 的默认值真正落到 `c.req.valid('query')`，且 `limit > max` 时会直接 400，和计划要求的默认值与 clamp 行为不一致
- **Fix:** 在 `apps/worker/src/routes/public.ts` 中改为 route 级预处理：显式补齐 `dedupe=true`、默认 `limit`，并将超限 `limit` clamp 到 `PUBLIC_DROPS_MAX_LIMIT`
- **Files modified:** `apps/worker/src/routes/public.ts`, `apps/worker/test/public.route.test.ts`
- **Verification:** `pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts test/public.route.test.ts`
- **Committed in:** `2858878`

---

**Total deviations:** 1 auto-fixed（1 个 Rule 1 bug）
**Impact on plan:** 该修正直接影响 `/api/public/drops` 的既定契约，属于保证计划正确完成所必需的最小增量修复，没有扩大范围。

## Issues Encountered

- `createOptionalBooleanWithDefault` / `createOptionalIntWithDefault` 在 query key 缺省场景下不会把默认值落到 `c.req.valid('query')`，因此公开 feed route 不能直接复用这两个 helper 的现状语义

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-02 可以直接基于这组 service/route 基线继续补 Worker 其他高风险路由与 service 的回归测试
- 首页公开 feed 的字段契约保持稳定，后续只需要在更多入口上扩展同样的 request-level 回归模式

## Self-Check: PASSED

- 已确认 `.planning/phases/05-feed-performance-regression/05-01-SUMMARY.md` 存在
- 已确认 Task 1 commit `2903575` 存在
- 已确认 Task 2 commit `2858878` 存在

---
*Phase: 05-feed-performance-regression*
*Completed: 2026-03-19*
