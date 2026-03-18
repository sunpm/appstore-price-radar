# Phase 1: 数据基线与可部署性 - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段只处理“让新环境可以稳定启动并验证基础闭环”这件事：统一数据库初始化基线、明确部署与环境变量约定、补出可重复执行的 smoke verification。价格正确性、任务互斥、认证限流和 DTO 收敛不在本阶段实现，它们属于后续 phase。

</domain>

<decisions>
## Implementation Decisions

### Canonical Migration Path
- 维护者文档里的官方建库路径以 `pnpm --filter @appstore-price-radar/worker db:push` 为准。
- `apps/worker/drizzle/0000_init.sql` 仍保留为可检查、可灾备的基线 SQL，但它必须与当前运行时代码一致，不能再遗漏 `app_price_change_events`。
- `apps/worker/drizzle/0001_price_change_events.sql` 应该降级为 legacy upgrade / backfill 角色，而不是 fresh install 唯一会创建 change-events 表的地方。

### Smoke Verification Scope
- Phase 1 必须覆盖从“配置正确”到“服务可启动”再到“基础数据路径可验证”的最小闭环。
- smoke path 必须包含 `GET /api/health`、订阅创建路径、手动巡检入口和价格历史读取路径。
- smoke verification 不应依赖真实 Apple App Store 或真实 Resend 发送；外部边界应通过 mock 或 deterministic stub 固定下来。

### Documentation Contract
- 根目录 `.env.example` 只描述 Web 端变量，`apps/worker/.dev.vars.example` 只描述 Worker 运行时变量。
- 文档必须把 `CRON_SECRET` 标成生产必填前提，只要 `/api/jobs/check` 还存在就不能再写成“可选但推荐”。
- README 中的本地启动、数据库初始化、Cloudflare 部署和 Netlify 部署段落必须共享同一套环境变量说法，避免不同章节互相矛盾。

### Claude's Discretion
- smoke verification 最终使用单个 Vitest 文件、多个 Vitest 文件，还是额外的脚本命令
- Phase 1 验证命令是放在根 `package.json` 还是 `apps/worker/package.json`
- 文档中对 raw SQL 的措辞是“仅灾备参考”还是“手动兜底路径”，只要主路径保持唯一即可

</decisions>

<specifics>
## Specific Ideas

- 优先复用 `apps/worker/test/checker.price-change.test.ts` 和 `apps/worker/test/scheduler.rate-limit.test.ts` 里的 mock / deterministic pattern，不引入新的测试框架。
- 利用当前 `worker.fetch`、route/service 分层和 auth helper，让 smoke verification 尽量贴近真实 API 路径，而不是只测纯函数。
- Phase 1 文档修订应明确说明“fresh install 的官方路径”和“legacy upgrade / manual recovery 的补充路径”分别是什么。

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope
- `.planning/PROJECT.md` — 项目核心价值、当前约束和 brownfield 现状
- `.planning/REQUIREMENTS.md` — Phase 1 对应的 `DATA-01`、`DATA-02`、`DATA-03`
- `.planning/ROADMAP.md` — 第 1 阶段目标、成功标准和原始计划拆分
- `.planning/STATE.md` — 当前 focus 与已知 blocker

### Database baseline
- `apps/worker/src/db/schema.ts` — 当前运行时代码真正依赖的表结构
- `apps/worker/drizzle/0000_init.sql` — 现有 fresh install SQL 基线
- `apps/worker/drizzle/0001_price_change_events.sql` — legacy change-events backfill 迁移
- `apps/worker/drizzle.config.ts` — 当前 drizzle-kit 的 schema / output / env 加载约定

### Runtime paths for smoke verification
- `apps/worker/src/index.ts` — `/api/health`、`/api/jobs/check` 和 router 挂载入口
- `apps/worker/src/routes/auth.ts` — 认证 API 入口与约束
- `apps/worker/src/routes/subscriptions.ts` — 订阅创建与列表接口
- `apps/worker/src/routes/prices.ts` — 价格历史接口
- `apps/worker/src/services/subscriptions.ts` — 创建订阅后立即触发 `refreshSingleApp`
- `apps/worker/src/services/prices.ts` — 价格历史读取与 legacy fallback
- `apps/worker/src/lib/checker.ts` — 手动/定时巡检共用主链路
- `apps/worker/src/lib/appstore.ts` — 价格抓取边界，smoke 中应 mock
- `apps/worker/src/lib/auth.ts` — session token / hash helper，可用于 deterministic auth setup

### Existing verification patterns
- `apps/worker/test/auth.test.ts` — Worker-compatible auth helper test style
- `apps/worker/test/checker.price-change.test.ts` — DB mock、时间冻结和外部依赖 mock 模式
- `apps/worker/test/scheduler.rate-limit.test.ts` — route-adjacent orchestration and config assertion style

### Documentation and deployment
- `README.md` — 当前本地启动与部署手册
- `.env.example` — Web env contract
- `apps/worker/.dev.vars.example` — Worker env contract
- `apps/worker/wrangler.toml` — cron cadence 和 `keep_vars` 约定
- `netlify.toml` — 前端构建与发布约定

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/worker/test/checker.price-change.test.ts`: 已经提供可扩展的 in-memory DB mock 和外部依赖 mock 模式
- `apps/worker/src/lib/auth.ts`: 可以生成 session token 和 token hash，适合构造受保护 API 的 deterministic smoke path
- `apps/worker/src/index.ts`: 直接导出 `worker.fetch`，适合不启动真实 dev server 的请求级测试

### Established Patterns
- Worker route 层统一返回 `{ status, body }`，计划中的 smoke verification 应优先走 route / service 边界，而不是重写一套自定义 harness
- 配置统一通过 `parseEnv()` 进入服务；文档和测试都应以这里的约束为源头
- 现有测试都使用 Vitest，且通过 `vi.mock()` 替换 DB / App Store / 邮件边界；本阶段不应引入第二套测试工具

### Integration Points
- 数据库基线修订必须同时影响 `schema.ts`、`drizzle/*.sql`、README 初始化说明
- smoke verification 至少要连接 `subscriptions -> refreshSingleApp -> prices` 这条链路，证明建库后基础闭环能跑通
- 部署文档更新必须与 `.env.example`、`.dev.vars.example`、`wrangler.toml` 同步

</code_context>

<deferred>
## Deferred Ideas

- `refreshSingleApp` 的事务性与幂等治理 — Phase 2
- 缺失价格写成 `0` 的修复 — Phase 2
- `/api/jobs/check` 的运行互斥和统计上报 — Phase 3
- 认证限流、验证码生命周期治理 — Phase 3
- 前后端 DTO 收敛和前端鉴权稳态 — Phase 4

</deferred>

---

*Phase: 01-data-baseline-deployability*
*Context gathered: 2026-03-18*
