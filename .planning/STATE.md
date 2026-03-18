---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to start
stopped_at: Completed 03-04-PLAN.md
last_updated: "2026-03-18T10:24:37.916Z"
last_activity: 2026-03-18 — 完成 03-04，高风险调度/认证边界测试已补齐并闭环 Phase 3
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 10
  percent: 59
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** 用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。
**Current focus:** Phase 4 - 契约与前端稳态

## Current Position

Phase: 4 of 5 (契约与前端稳态)
Plan: 0 of 4 in current phase
Status: Ready to start
Last activity: 2026-03-18 — 完成 03-04，高风险调度/认证边界测试已补齐并闭环 Phase 3

Progress: [██████░░░░] 59%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 5.0 min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 4 min | 1.3 min |
| 2 | 3 | 11 min | 3.7 min |
| 3 | 4 | 35 min | 8.8 min |

**Recent Trend:**
- Last 5 plans: 03-04 (5 min), 03-03 (6 min), 03-02 (16 min), 03-01 (8 min), 02-03 (4 min)
- Trend: Improving（在保持高风险门禁与测试覆盖的前提下，执行节奏更平稳）
| Phase 03 P03 | 6 min | 2 tasks | 8 files |
| Phase 03 P04 | 5 min | 2 tasks | 4 files |

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
- [Phase 03]: 手动巡检入口默认关闭（MANUAL_PRICE_CHECKS_ENABLED=false），避免 secret 漏配导致公网裸露 — 将高副作用入口从 opt-in secret 校验改为显式开关 + deny-by-default，可在配置缺失时直接不可达
- [Phase 03]: 当手动巡检显式开启但缺少 CRON_SECRET 时返回 503 并给出明确错误文本 — 通过结构化错误暴露配置问题，避免 silent fallback 到不安全默认行为
- [Phase 03]: 使用验收标准中的精确用例名称作为测试名，确保 requirement 到测试点的映射可搜索、可审计。 — 便于通过 rg 快速定位 requirement 覆盖点，降低后续回归与审计成本。
- [Phase 03]: 在不改生产逻辑的前提下增强 test doubles，以便稳定复现旧凭证淘汰场景。 — 优先用测试资产强化高风险边界，避免引入新的业务行为变更。

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3 已完成，无新增阻塞项
- Phase 4 前置风险：前后端 DTO 与鉴权错误处理仍未统一，后续需要避免接口字段继续漂移

## Session Continuity

Last session: 2026-03-18T10:24:37.914Z
Stopped at: Completed 03-04-PLAN.md
Resume file: None
