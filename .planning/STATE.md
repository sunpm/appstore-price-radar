# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** 用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。
**Current focus:** Phase 2 - 价格数据正确性

## Current Position

Phase: 2 of 5 (价格数据正确性)
Plan: 1 of 3 in current phase
Status: Ready to execute
Last activity: 2026-03-18 — 完成 02-01，显式区分 invalid-price 并阻断无效价格持久化

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2 min
- Total execution time: 0.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 4 min | 1.3 min |
| 2 | 1 | 4 min | 4 min |

**Recent Trend:**
- Last 5 plans: 02-01 (4 min), 01-02 (1 min), 01-03 (1 min), 01-01 (2 min)
- Trend: Stable

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2 剩余风险：`refreshSingleApp` 仍缺少 batched persistence 边界，`02-02` 需要优先补上
- Phase 2 剩余风险：订阅创建与 scheduled refresh 的共享 options contract 还未落地，`02-03` 需要收敛
- Phase 3 前置风险：巡检缺少互斥、认证入口缺少限流，仍是后续高风险区域

## Session Continuity

Last session: 2026-03-18 16:04
Stopped at: 完成 02-01，下一步执行 02-02-PLAN.md
Resume file: None
