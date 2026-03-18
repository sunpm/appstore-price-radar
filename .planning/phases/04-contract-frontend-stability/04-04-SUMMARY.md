---
phase: 04-contract-frontend-stability
plan: '04'
subsystem: api-ui
tags: [metadata, appstore, dto, drizzle, vue, detail-page]
requires:
  - phase: 04-contract-frontend-stability
    provides: 04-01 共享 contracts DTO 基线，供 detail response 与 Web 类型同步演进
  - phase: 04-contract-frontend-stability
    provides: 04-03 共享 history composable 与分页历史接口，可直接承接详情页的趋势区域
provides:
  - App Store metadata 从 lookup、落库、DTO 到 detail route 全链路打通
  - 详情页首屏拆分为 hero / decision stats / metadata panel 的分层展示
  - 长尾元数据默认折叠，详情页不再把所有字段平铺在主内容流中
affects: [phase-04-contract-frontend-stability, phase-05-feed-performance-regression]
tech-stack:
  added: []
  patterns:
    - detail metadata DTO alongside history payload
    - snapshot metadata persistence
    - thin view plus focused child components
key-files:
  created:
    - .planning/phases/04-contract-frontend-stability/04-04-SUMMARY.md
    - apps/worker/drizzle/0004_app_snapshot_metadata.sql
    - apps/web/src/views/app/components/AppDetailHeroCard.vue
    - apps/web/src/views/app/components/AppDetailDecisionStats.vue
    - apps/web/src/views/app/components/AppDetailMetadataPanel.vue
  modified:
    - packages/contracts/src/prices.ts
    - apps/worker/src/lib/appstore.ts
    - apps/worker/src/lib/checker.ts
    - apps/worker/src/services/prices.ts
    - apps/web/src/composables/usePriceHistory.ts
    - apps/web/src/views/app/AppDetailView.vue
    - apps/web/src/views/app/types.ts
key-decisions:
  - 详情页 metadata 通过独立 `metadata` 字段返回，而不是继续把 Web 绑定到 snapshot 表字段细节
  - 共享 `usePriceHistory()` 直接扩展 metadata 状态，避免详情页再发一套重复请求
  - 详情页首屏固定为 hero + decision stats，长尾字段全部放入默认折叠的 metadata panel
patterns-established:
  - "详情页的数据获取继续复用 `usePriceHistory()`，但 UI 分层通过子组件拆开，route view 只负责编排和趋势区域。"
  - "来自 App Store 的长尾 metadata 先持久化到 `app_snapshots`，再通过 contracts DTO 暴露给 Web。"
requirements-completed: [API-05]
duration: 27 min
completed: 2026-03-18
---

# Phase 4 Plan 04: 丰富详情页 App 元数据并做分层展示 Summary

**App Store metadata 已从采集到展示全链路打通，详情页首屏现在优先呈现决策信息，并把技术性长尾字段折叠到扩展面板中。**

## Performance

- **Duration:** 27 min
- **Started:** 2026-03-18T12:57:44Z
- **Completed:** 2026-03-18T13:25:15Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- App Store lookup 现可解析并返回 `sellerName`、`primaryGenreName`、`description`、`averageUserRating`、`userRatingCount`、`bundleId`、`version`、`minimumOsVersion`、`releaseNotes`。
- `app_snapshots` 新增 metadata 列并补上 `0004_app_snapshot_metadata.sql`，刷新逻辑会把这些字段一起持久化。
- 共享 contracts 中新增 `AppDecisionMetadataDto` 与 `AppDetailResponseDto`，detail route 通过 `metadata` 字段暴露扩展信息。
- `usePriceHistory()` 扩展为可携带 `metadata`，详情页无需额外再发一次 metadata-only 请求。
- 详情页拆分为 `AppDetailHeroCard`、`AppDetailDecisionStats`、`AppDetailMetadataPanel` 三个子组件，形成“首屏决策信息 + 折叠长尾信息”的层级。
- 历史趋势区保留窗口切换与“加载更多”，与 04-03 的共享历史加载策略保持一致。

## Task Commits

Each task was committed atomically:

1. **Task 1: 扩展 App Store metadata 采集、snapshot schema 和 detail DTO** - `47807d8` (feat)
2. **Task 2: 将详情页重构为决策优先的分层展示，并折叠长尾元数据** - `3ae65f9` (feat)

**Plan metadata:** to be committed with this summary/state/roadmap update.

## Files Created/Modified

- `packages/contracts/src/prices.ts` - 新增 `AppDecisionMetadataDto` 与 `AppDetailResponseDto`。
- `apps/worker/src/lib/appstore.ts` - 从 App Store lookup 响应解析并归一化 metadata。
- `apps/worker/src/lib/appstore.types.ts` - found / invalid-price 结果现在都携带 metadata 字段。
- `apps/worker/src/db/schema.ts` - `app_snapshots` 增加 metadata 列定义。
- `apps/worker/drizzle/0004_app_snapshot_metadata.sql` - metadata 列迁移。
- `apps/worker/src/lib/checker.ts` - snapshot upsert 时持久化 metadata。
- `apps/worker/src/services/prices.ts` - detail route 返回 `metadata` section。
- `apps/worker/src/services/prices.types.ts` - service success response 对齐 `AppDetailResponseDto`。
- `apps/worker/src/routes/prices.ts` - route body 类型改为 detail DTO。
- `apps/worker/test/appstore.lookup.test.ts` - 显式断言 metadata mapping。
- `apps/worker/test/prices.history.test.ts` - 显式断言 route 返回的 `metadata` shape。
- `apps/worker/test/checker.price-change.test.ts` - 断言 metadata 能随 snapshot refresh 一起持久化。
- `apps/web/src/composables/usePriceHistory.ts` - 共享 history composable 增加 metadata state。
- `apps/web/src/views/app/types.ts` - App detail 类型改为消费 shared `AppDetailResponseDto`。
- `apps/web/src/views/app/AppDetailView.vue` - 详情页变为薄编排层，并组合 hero/stats/metadata panel。
- `apps/web/src/views/app/components/AppDetailHeroCard.vue` - 渲染应用身份、当前价格、更新时间和 App Store CTA。
- `apps/web/src/views/app/components/AppDetailDecisionStats.vue` - 渲染评分、评价数、分类、距高点跌幅、最低价等首屏决策指标。
- `apps/web/src/views/app/components/AppDetailMetadataPanel.vue` - 渲染默认折叠的长尾元数据与展开/收起动作。

## Decisions Made

- `metadata` 保持与 `snapshot` 分离，避免未来 detail-only 字段继续污染通用 snapshot DTO。
- `AppDetailMetadataPanel` 采用组件内局部折叠状态，而不是把 expand/collapse 状态抬到 route view。

## Deviations from Plan

### Auto-fixed Issues

**1. [Performance/Consistency] 扩展共享 composable 而不是额外引入 detail 专用请求**
- **Found during:** Task 2（详情页路由层重构）
- **Issue:** 如果详情页为 metadata 再单独发一次请求，会与 04-03 建立的共享 history cache / abort 语义分叉，并增加重复网络开销。
- **Fix:** 为 `usePriceHistory()` 增加 `metadata` state，让详情页继续站在共享请求与缓存路径上。
- **Files modified:** `apps/web/src/composables/usePriceHistory.ts`, `apps/web/src/views/app/AppDetailView.vue`
- **Verification:** `pnpm typecheck`、`pnpm lint`
- **Committed in:** `3ae65f9` (part of task commit)

**2. [Regression Safety] 同步补齐 worker smoke/mock 测试资产的 metadata 兼容性**
- **Found during:** Task 1（snapshot schema 扩展后）
- **Issue:** 若测试 double 仍只认识旧 snapshot shape，会导致 refresh 和 smoke 回归资产逐渐失真。
- **Fix:** 更新 checker / atomicity / fresh-install 测试里的 snapshot/mock 类型，使其兼容 metadata 列与新的 lookup 返回值。
- **Files modified:** `apps/worker/test/checker.price-change.test.ts`, `apps/worker/test/checker.atomicity.test.ts`, `apps/worker/test/fresh-install.smoke.test.ts`
- **Verification:** `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts test/prices.history.test.ts`
- **Committed in:** `47807d8` (part of task commit)

---

**Total deviations:** 2 auto-fixed (1 performance/consistency, 1 regression safety)
**Impact on plan:** 均为保证共享数据路径和测试资产持续一致性的必要修正，没有引入超出目标的功能膨胀。

## Issues Encountered

- 详情页拆分后的 import 排序需要对齐项目 ESLint 规则；已在 lint 阶段修正，未留下额外实现风险。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 已全部完成，Phase 5 可以直接围绕公开降价流性能、Worker 回归测试和前端关键路径自动化继续推进。
- 详情页 DTO 与 UI 分层已经稳定，后续回归工作可直接针对 `AppDetailResponseDto` 和子组件边界编写测试。

## Self-Check: PASSED

---
*Phase: 04-contract-frontend-stability*
*Completed: 2026-03-18*
---
