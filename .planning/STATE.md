# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** 用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。
**Current focus:** Phase 3 - 调度与认证安全

## Current Position

Phase: 3 of 5 (调度与认证安全)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-03-18 — 完成 03-02，落地认证统一限流、失败计数与旧凭证淘汰策略，并补齐安全回归测试

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 4.9 min
- Total execution time: 0.65 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 4 min | 1.3 min |
| 2 | 3 | 11 min | 3.7 min |
| 3 | 2 | 24 min | 12.0 min |

**Recent Trend:**
- Last 5 plans: 03-02 (16 min), 03-01 (8 min), 02-03 (4 min), 02-02 (3 min), 02-01 (4 min)
- Trend: Stable（Phase 3 安全与调度任务复杂度更高，耗时增长符合预期）

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: 以 brownfield 现状作为已验证能力，路线图优先处理正确性、安全性和可运维性
- [Init]: 继续沿用 Web-first + Cloudflare Worker + Neon 的现有架构
- [2026-03-18]: 详情页 App 信息采用“核心决策信息首屏 + 长尾元数据折叠”的分层展示策略，不追求全字段默认展开
- [2026-03-18]: fresh install baseline 必须直接创建 `app_price_change_events`，legacy migration 仅负责兼容升级和条件回填
- [2026-03-18]: Phase 1 的 smoke verification 统一收敛到 `pnpm --filter @appstore-price-radar/worker test:smoke`
- [2026-03-18]: README 与 env examples 只保留一条官方 bootstrap / smoke 路径，不再混用直接 SQL 初始化说明
- [2026-03-18]: App Store lookup 现在显式返回 `found` / `invalid-price`，不再把缺失价格强行写成 `0`
- [2026-03-18]: `refreshSingleApp` 在 `invalid-price` 时会直接跳过 snapshot / event / drop-event 持久化
- [2026-03-18]: `refreshSingleApp` 现在通过 `db.batch(...)` 一次性提交 snapshot、change event 和 drop event 写入
- [2026-03-18]: request-level smoke mock 也必须兼容 batched persistence，避免验证资产与真实实现再次漂移
- [2026-03-18]: 订阅创建与 scheduled refresh 统一通过 `buildRefreshOptions(...)` 派生策略字段，只允许在 `notifyDrops`、`source` 和 `requestId` 上存在显式差异
- [2026-03-18]: 巡检任务改为通过 `runProtectedPriceCheck(...)` 统一执行，租约冲突返回结构化 `skipped`（`price-check-already-running`）
- [2026-03-18]: `CheckReport` 新增 `succeeded/skipped/failed`，并与 `price_check_runs` summary 字段保持一一对应
- [2026-03-18]: smoke in-memory DB mock 需要同步覆盖 lease/run 表交互，避免调度能力新增后测试资产失真
- [2026-03-18]: 认证入口统一采用 `auth_rate_limits(scope + subjectKey)` 作为数据库限流状态，避免 Worker 无状态带来的限流漂移
- [2026-03-18]: 新签发 login code / reset token 前必须显式作废旧的未使用凭证，保证同类凭证单活

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 剩余风险：手动巡检 route 生产门禁（03-03）与调度/认证高风险边界联测（03-04）仍待落地
- Phase 4 前置风险：前后端 DTO 与鉴权错误处理仍未统一，后续需要避免接口字段继续漂移

## Session Continuity

Last session: 2026-03-18 17:56
Stopped at: 完成 03-02 execute + verification，下一步进入 03-03（`/api/jobs/check` 生产门禁强化）
Resume file: None
