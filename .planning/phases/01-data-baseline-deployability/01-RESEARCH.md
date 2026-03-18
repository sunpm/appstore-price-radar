# Phase 1: 数据基线与可部署性 - Research

**Researched:** 2026-03-18
**Domain:** brownfield Drizzle migration governance, Worker bootstrap verification, and deterministic smoke validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 官方建库路径以 `pnpm --filter @appstore-price-radar/worker db:push` 为准。
- `apps/worker/drizzle/0000_init.sql` 必须覆盖当前运行时代码实际需要的 schema，包括 `app_price_change_events`。
- `apps/worker/drizzle/0001_price_change_events.sql` 只承担 legacy upgrade / backfill 责任。
- Phase 1 smoke path 必须覆盖 `/api/health`、订阅创建、手动巡检入口和价格历史读取。
- smoke verification 不依赖真实 Apple App Store 和真实 Resend。
- 文档必须把 `CRON_SECRET` 标为生产必填，只要 `/api/jobs/check` 仍然对外存在。

### Claude's Discretion
- smoke verification 的具体文件拆分和脚本命名
- package script 放在根目录还是 `apps/worker/package.json`
- raw SQL 在 README 中标为“灾备参考”还是“手动兜底路径”

### Deferred Ideas (OUT OF SCOPE)
- 价格正确性和事务性修复
- 巡检互斥与运行统计
- 认证限流和凭证治理
- DTO 收敛与前端稳态

</user_constraints>

<research_summary>
## Summary

这个 phase 不需要引入新的基础设施，关键是把“schema 真相”“文档真相”“验证真相”统一起来。当前仓库已经有足够的构件支撑这件事：Drizzle schema 是运行时代码的真实模型，Vitest 已经覆盖了 DB mock、时间控制和外部依赖 mock，Worker 入口也已经允许直接通过 `worker.fetch` 做请求级 smoke。

对 brownfield Worker 项目来说，最稳妥的 Phase 1 方案通常是三件事并行推进但按依赖顺序落地：先把基线 SQL 和 runtime schema 对齐，再建立 deterministic smoke verification，最后把 README 和 env examples 改成唯一官方路径。这样能避免“文档先写了但验证命令还不存在”，也避免“验证脚本在旧 schema 基线上误通过”。

**Primary recommendation:** 先用 `schema.ts` 回写并约束 `0000_init.sql` / `0001_price_change_events.sql`，再在 `apps/worker/test` 内补 deterministic smoke tests 与 `test:smoke` 脚本，最后用 README 和 env examples 把这套路径对外固定下来。
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `0.44.x` | 当前 schema 真相来源 | 运行时代码与迁移基线必须从同一份 schema 反推 |
| `drizzle-kit` | `0.31.x` | 官方建库路径 `db:push` | 对现有项目来说比手动 SQL 更不容易再漂移 |
| `vitest` | `3.2.x` | deterministic smoke / regression tests | 仓库已有 mock pattern，最低引入成本 |
| `worker.fetch` + Hono routes | current repo runtime | 请求级 smoke 验证 | 可以不启动真实网络端口就覆盖 API 主路径 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` / `readFileSync` | built-in | 静态检查 SQL / README / env example 内容 | 适合 schema baseline 和 docs contract regression |
| `@noble/hashes` helpers via `lib/auth.ts` | current repo | 构造 deterministic session token / password fixtures | 需要在 smoke test 中走受保护 API 时使用 |
| existing `createDbMock()` pattern | current repo | 复用现有 DB mock 风格 | 需要避开真实数据库和外部网络时使用 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `db:push` 作为官方路径 | 手动执行 SQL 文件 | 容易再次让 README 和 runtime schema 漂移 |
| Vitest smoke tests | 新增 E2E / Playwright / shell harness | 对当前基础设施阶段来说过重，且不必要 |
| deterministic mocks | 真实 Apple / Resend / live Neon | 更接近生产，但 Phase 1 会变得脆弱且难复现 |

**Installation:**
```bash
pnpm install
pnpm --filter @appstore-price-radar/worker test
pnpm --filter @appstore-price-radar/worker db:push
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
apps/worker/
├── drizzle/                  # canonical SQL assets
├── src/db/schema.ts          # runtime schema source of truth
├── src/index.ts              # worker.fetch smoke entry
├── test/                     # regression + smoke tests
└── package.json              # worker-local verification scripts
```

### Pattern 1: Schema-first baseline alignment
**What:** 以 `src/db/schema.ts` 为真相，反推或校准 `drizzle/*.sql` 与 docs。
**When to use:** brownfield 项目存在 SQL 与 runtime schema 漂移时。
**Example:**
```typescript
export const appPriceChangeEvents = pgTable(
  'app_price_change_events',
  {
    requestId: varchar('request_id', { length: 96 }).notNull(),
  },
)
```

### Pattern 2: Deterministic request-level smoke tests
**What:** 通过 `worker.fetch` 调 Hono 路由，同时 mock DB / App Store / Resend。
**When to use:** 需要验证 API wiring，但不想让测试依赖真实网络和第三方服务。
**Example:**
```typescript
const response = await worker.fetch(
  new Request('http://local/api/health'),
  envBindings,
)
```

### Pattern 3: Documentation as contract, not narrative
**What:** README、`.env.example`、`.dev.vars.example` 和 deploy config 必须表达同一套要求。
**When to use:** phase 目标包含 bootstrap / deployability。
**Example:**
```text
Official database bootstrap:
pnpm --filter @appstore-price-radar/worker db:push
```

### Anti-Patterns to Avoid
- **让 0001 迁移继续承担唯一建表责任：** fresh install 会在 README 或灾备路径上继续踩坑。
- **把 smoke verification 建在真实第三方服务上：** Phase 1 会变得不可重复、不可离线、难排查。
- **文档只改 README，不同步 env examples：** 运维者会在不同文件看到互相冲突的要求。
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 迁移真相管理 | 自定义“当前 schema 文档”文件 | 现有 `src/db/schema.ts` + `drizzle/*.sql` | 少一个额外来源就少一次漂移机会 |
| API smoke harness | 一套新的 shell-only HTTP harness | 现有 `worker.fetch` + Vitest | 当前 Hono Worker 已经天然适配 |
| 外部依赖隔离 | 临时环境变量开关和 ad-hoc stubs | `vi.mock()` + 现有测试 hooks | 现有测试已经证明这种方式可维护 |

**Key insight:** Phase 1 的目标是把现有仓库的真相收拢，而不是再发明一套新的 bootstrap / verification 子系统。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Fixing docs before fixing the baseline
**What goes wrong:** README 被改成了新说法，但 SQL / schema 仍旧不一致。
**Why it happens:** 文档比代码更容易先动手。
**How to avoid:** 先落 `0000` / `0001` / `schema.ts` 的一致性，再写 README。
**Warning signs:** README 说能 fresh install，测试和 runtime 却还在 fallback 到 legacy 表。

### Pitfall 2: Smoke tests that bypass real routes
**What goes wrong:** 测试只测纯函数，无法证明 `/api/*` wiring 真正可用。
**Why it happens:** route-level test 看起来更麻烦。
**How to avoid:** 至少为 `/api/health`、`/api/subscriptions`、`/api/jobs/check`、`/api/prices/:appId` 建一条 request-level smoke 路径。
**Warning signs:** 测试绿了，但 route schema、middleware 或 env parse 变更仍能在线上出错。

### Pitfall 3: Making smoke verification depend on live vendors
**What goes wrong:** 测试偶发失败，维护者不愿意跑 smoke。
**Why it happens:** 觉得“真实系统才算验证”。
**How to avoid:** 以 deterministic mocks 验证 wiring 和 schema，一条手动 smoke check 补充真实部署感知即可。
**Warning signs:** 需要真实 Resend key、真实 Apple 响应、真实 cron 环境才能通过验证。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from repository sources:

### SQL contract test style
```typescript
const wranglerToml = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8')
expect(wranglerToml).toContain('crons = ["0 */6 * * *"]')
```
Source: `apps/worker/test/scheduler.rate-limit.test.ts`

### Worker-compatible DB mock style
```typescript
vi.mock('../src/db/client', () => ({
  getDb: () => testHooks.dbRef.current,
}))
```
Source: `apps/worker/test/checker.price-change.test.ts`

### Route/service smoke entry
```typescript
const worker: ExportedHandler<WorkerBindings> = {
  fetch: app.fetch,
}
```
Source: `apps/worker/src/index.ts`
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| README-first bootstrap | schema-first + verified command path | ongoing brownfield best practice | 文档必须跟着验证资产一起落地 |
| live service smoke checks | deterministic integration smoke | common modern CI practice | 更快、更稳、更适合本地与 CI |
| “raw SQL 就是初始化主路径” | ORM schema / migration tool 作为官方入口 | ORM-heavy TypeScript repos 普遍采用 | 文档和 schema 更容易保持同步 |

**New tools/patterns to consider:**
- `worker.fetch` request-level tests：覆盖 route wiring，不需要真实网络端口
- 静态 contract tests：对 SQL / docs / env files 做 grep 级回归保护

**Deprecated/outdated:**
- 把 `0000_init.sql` 当成唯一 fresh install 手册而不校验 runtime schema
- 依赖真实第三方服务才能完成 Phase 1 bootstrap verification
</sota_updates>

## Validation Architecture

### Test Infrastructure
- Framework: `vitest`（沿用 `apps/worker/test` 现有体系）
- Quick run command: `pnpm --filter @appstore-price-radar/worker test -- test/schema.bootstrap.test.ts test/fresh-install.smoke.test.ts`
- Full suite command: `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck && pnpm lint`
- Docs contract spot-check: `rg -n "db:push|test:smoke|CRON_SECRET" README.md apps/worker/.dev.vars.example`

### Requirement Coverage Strategy
- `DATA-01`: 用静态 SQL regression test 锁定 `0000_init.sql` 与 `0001_price_change_events.sql`
- `DATA-02`: 用 deterministic smoke test 覆盖 `/api/health`、订阅创建、手动巡检和价格历史读取
- `DATA-03`: 用 README / env example contract checks 锁定官方命令和生产安全前提

### Wave 0 Requirements
- 新增 `apps/worker/test/schema.bootstrap.test.ts`
- 新增 `apps/worker/test/fresh-install.smoke.test.ts`
- 在 `apps/worker/package.json` 暴露 `test:smoke` 脚本，避免每次手敲长命令

### Manual Verification Backstop
- 本地按 README 建库并启动 `pnpm dev`
- 访问 `GET /api/health`
- 用 smoke fixture 或文档中的固定步骤验证 `/api/subscriptions`、`/api/jobs/check`、`/api/prices/:appId`

<open_questions>
## Open Questions

1. **是否要完全重写 `0000_init.sql`，还是只最小修补到当前 schema？**
   - What we know: 当前 `0000` 缺 `app_price_change_events`
   - What's unclear: 是否还要保留 `app_price_history` 作为 legacy artifact
   - Recommendation: 以 runtime schema 为准，保留 legacy table 只在明确 backfill 仍需要时存在

2. **smoke verification 命令是放根目录还是 worker 包内？**
   - What we know: Phase 1 全部变更都集中在 worker / docs
   - What's unclear: 团队更希望 `pnpm smoke:*` 还是 `pnpm --filter worker test:smoke`
   - Recommendation: 先放 `apps/worker/package.json`，保持 phase scope 清晰
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `apps/worker/src/db/schema.ts` - current runtime schema
- `apps/worker/drizzle/0000_init.sql` - current baseline SQL
- `apps/worker/drizzle/0001_price_change_events.sql` - legacy backfill migration
- `apps/worker/src/index.ts` - worker fetch and route entry
- `apps/worker/src/services/subscriptions.ts` - subscription create path
- `apps/worker/src/services/prices.ts` - history read path and legacy fallback
- `apps/worker/test/checker.price-change.test.ts` - DB mock pattern
- `apps/worker/test/scheduler.rate-limit.test.ts` - static contract test pattern
- `README.md` / `.env.example` / `apps/worker/.dev.vars.example` - current operator contract

### Secondary (MEDIUM confidence)
- `.planning/codebase/CONCERNS.md` - phase-driving risk summary
- `.planning/codebase/TESTING.md` - current verification gap analysis

</sources>
