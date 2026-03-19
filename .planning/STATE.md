---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Complete
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-03-19T03:14:47.065Z"
last_activity: 2026-03-19 — 完成 05-03，Web 关键路径自动化测试与根级统一验证入口已落地，Phase 5 全部收口
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-18)

**Core value:** 用户订阅的 App 必须能被持续、准确、可解释地监控，并在真实降价时收到可信且不重复的提醒。
**Current focus:** Phase 5 - Feed 性能与回归保障（已完成，公开 feed、Worker/Web 回归测试与统一验证入口均已收口）

## Current Position

Phase: 5 of 5 (Feed 性能与回归保障)
Plan: 3 of 3 in current phase
Status: Complete
Last activity: 2026-03-19 — 完成 05-03，Web 关键路径自动化测试与根级统一验证入口已落地，Phase 5 全部收口

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 5.5 min
- Total execution time: 1.10 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3 | 4 min | 1.3 min |
| 2 | 3 | 11 min | 3.7 min |
| 3 | 4 | 35 min | 8.8 min |
| 5 | 3 | 27 min | 9.0 min |

**Recent Trend:**
- Last 5 plans: 05-03 (9 min), 05-02 (7 min), 05-01 (11 min), 03-04 (5 min), 03-03 (6 min)
- Trend: Stable（在补齐前后端回归测试与统一验证入口后，执行成本仍保持可控）
| Phase 03 P03 | 6 min | 2 tasks | 8 files |
| Phase 03 P04 | 5 min | 2 tasks | 4 files |
| Phase 05 P01 | 11 min | 2 tasks | 9 files |
| Phase 05 P02 | 7 min | 2 tasks | 8 files |
| Phase 05 P03 | 9 min | 2 tasks | 10 files |

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
- [Phase 04]: `@appstore-price-radar/contracts` 成为 auth / subscriptions / prices DTO 的唯一来源，Web 与 Worker 都必须显式声明 `workspace:*` 依赖。 — 避免“类型已抽出但 workspace link 缺失”导致的编译期漂移与隐性 any。
- [Phase 04]: Worker HTTP 返回体统一通过显式 mapper 输出 ISO string DTO，测试也必须按 DTO 结构断言，不能继续依赖 raw `Date` 或旧字段。 — 确保共享 contracts 是运行时 shape 的真实反映，而不只是类型层面的名义统一。
- [Phase 04]: 前端受保护请求统一经由 `useAuthedApi()` 处理 unauthorized，页面只负责声明业务错误文案与 UI 状态。 — 减少 401 side effect 分叉，避免每个 view 自己拼 token/clearSession/router 跳转。
- [Phase 04]: `useAuthSession()` 负责 token / user / expiresAt 的共享恢复与持久化，route guard 和布局层都直接消费这套状态语义。 — 让导航、弹窗与页面 restore 行为站在同一份 session source 上。
- [Phase 05]: 公开降价流现在在数据库边界完成 (appId, country) 最新事件去重，并以 detectedAt DESC、id DESC 作为稳定排序语义。
- [Phase 05]: `/api/public/drops` 现在显式补齐 dedupe=true 和默认 limit，并将超限 limit clamp 到 PUBLIC_DROPS_MAX_LIMIT。
- [Phase 05]: 保留已有 jobs.check-route 回归资产，只增量补齐 auth/subscriptions 缺失覆盖。
- [Phase 05]: Worker route 回归使用最小 requireAuth mock，service 回归继续沿用 in-memory DB state doubles。
- [Phase 05]: Web 自动化优先覆盖 route view + composable 的真实关键路径，而不是拆成零散 util 测试。
- [Phase 05]: 根级 verify 成为唯一官方发布前入口，verify:full 保持等价别名。

### Pending Todos

None yet.

### Blockers/Concerns

- 当前无新增阻塞项
- Phase 5 后续风险集中在公开 feed 查询性能与回归测试资产扩张，需要继续保持 shared contracts 与测试 doubles 同步演进

## Session Continuity

Last session: 2026-03-19T03:14:47.062Z
Stopped at: Completed 05-03-PLAN.md
Resume file: None
