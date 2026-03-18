# Phase 3: 调度与认证安全 - Research

**Researched:** 2026-03-18
**Domain:** 价格巡检互斥、任务级统计、手动巡检鉴权、认证限流与凭证生命周期
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md / REQUIREMENTS.md / STATE.md)

### Locked Decisions
- Phase 3 必须满足 `PRICE-03`、`PRICE-04`、`AUTH-01`、`AUTH-02`、`AUTH-03`。
- 同一时间最多只能有一个价格巡检任务处理同一批 active subscriptions，重复触发不能制造重复价格事件或重复邮件。
- 一轮巡检必须输出成功、跳过、失败统计，并能定位失败原因，而不只是返回一个泛化的 `errors: string[]`。
- 登录、验证码发送/验证、密码重置链路必须具备可验证的失败次数或频率限制。
- 用户同一时刻只能保留符合策略的有效 login code / reset token，新发放凭证必须显式淘汰旧凭证。
- 生产暴露的 `POST /api/jobs/check` 不能在缺失 `CRON_SECRET` 时继续对公网开放。

### Missing Direct Context
- 当前 phase 还没有 `03-CONTEXT.md`；本次规划默认只使用 `ROADMAP.md`、`REQUIREMENTS.md`、`STATE.md` 和现有源码。

### Claude's Discretion
- 巡检互斥是用数据库租约表还是单表状态行实现
- 任务级统计是扩展 `CheckReport` 还是新增单独的持久化 run summary 结构
- 认证限流是按 email 聚合、按 token 聚合，还是拆成多 scope 的通用 helper
- 手动巡检入口是默认关闭还是默认开启但强制 secret

### Deferred Ideas (OUT OF SCOPE)
- 引入 Cloudflare Queues / Durable Objects 做分布式编排
- 前端展示巡检运行历史页面
- 全量认证 DTO 收敛与前端 401 统一处理（Phase 4）
- 公开降价流性能优化与更大规模测试矩阵（Phase 5）

</user_constraints>

<research_summary>
## Summary

Phase 3 的风险集中在两个“高副作用入口”上：一是 `runPriceCheck()` 同时会写 snapshot / events / drop email，当前没有任何互斥保护，手动触发和定时触发叠在一起时只能依赖 `requestId` 的部分去重；二是 `auth.ts` 已经支持密码、验证码、重置密码，但除了发送验证码的 resend cooldown 外，没有统一的失败计数、窗口限流和“新凭证淘汰旧凭证”策略。

当前仓库最稳妥的推进方式，是把 Phase 3 拆成四个顺序 plan：

1. 先给价格巡检增加数据库级租约和 run summary，把“同一时刻只跑一个巡检”和“本轮到底成功/跳过/失败了多少”变成明确契约。
2. 再给认证链路补基于数据库的 rate-limit state 和凭证淘汰逻辑，避免 Worker 无状态环境下的限流失效。
3. 随后强化 `POST /api/jobs/check` 的配置门禁，让手动巡检只在显式启用且 secret 正确时可用。
4. 最后用专门的高风险边界测试锁住重复巡检、secret 缺失、验证码/重置凭证淘汰和失败限流。

**Primary recommendation:** 以“数据库租约 + 运行摘要 + 通用 auth rate-limit helper + 默认关闭手动巡检入口”为主线，不引入新的云组件，只沿用现有 Worker + Hono + Drizzle + Neon 栈完成本阶段。
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `0.44.5` | schema、查询、upsert、migration 协调 | 现有 worker 数据访问层，适合继续承载锁表、run summary、auth rate-limit state |
| `@neondatabase/serverless` | `0.10.4` | Neon HTTP driver | 现有运行时已验证，可承载基于 `INSERT ... ON CONFLICT` / `UPDATE ... WHERE` 的租约写入 |
| `hono` | repo-installed | API route 与 middleware 组合 | `POST /api/jobs/check` 和 `/api/auth/*` 都已基于 Hono，适合继续抽 guard / middleware |
| `vitest` | `3.2.4` | 单元/集成回归测试 | 现有 worker test 已有可复用的 DB mock、`worker.fetch` smoke、route-adjacent 测试样板 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `3.24.4` | 新 env vars 与 route response contract 校验 | 新增 `MANUAL_PRICE_CHECKS_ENABLED`、rate-limit / lock TTL 配置时 |
| existing mock DB patterns | current repo | 模拟 Drizzle 查询链和 batch/write 副作用 | scheduler/auth 安全测试补齐时 |
| `wrangler dev` + `worker.fetch` smoke | current repo runtime | 验证 `POST /api/jobs/check` route guard 和 auth 边界 | route/integration backstop 时 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Postgres 租约表 + run summary | Durable Objects / external queue | 更强但引入新基础设施，超出当前 phase 范围 |
| 数据库通用 rate-limit state | 内存 Map / per-instance state | Cloudflare Worker 实例无状态，无法跨实例/跨请求稳定限流 |
| 默认关闭手动巡检入口 | 继续允许空 `CRON_SECRET` 时公开调用 | 与 `AUTH-03` 直接冲突，线上风险过高 |

**Installation / verification baseline:**
```bash
pnpm install
pnpm --filter @appstore-price-radar/worker test
pnpm typecheck
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Database lease before side-effect-heavy job execution
**What:** 在真正调用 `runPriceCheck()` 前，先通过数据库租约表获取 `price-check` 独占锁；拿不到锁时返回一个结构化的“skipped because already running”结果，而不是继续执行。
**When to use:** 单个任务会写多张表并触发邮件，且 Worker 可能被手动/定时同时触发时。
**Example:**
```typescript
const lease = await acquireJobLease(config, {
  lockKey: 'price-check',
  lockTtlSeconds: 900,
});

if (!lease.acquired) {
  return {
    kind: 'skipped',
    reason: 'price-check-already-running',
  };
}
```

### Pattern 2: Separate job orchestration from per-app refresh logic
**What:** 保持 `refreshSingleApp()` 继续负责单个 `(appId, country)` 刷新，把“获取锁、创建 run 记录、更新统计、释放锁”抽到新的 `jobs` service。
**When to use:** 需要新增互斥和统计，但不想把 `checker.ts` 进一步膨胀成路由/调度/持久化混合层时。
**Example:**
```typescript
const run = await runProtectedPriceCheck(config, {
  trigger: 'manual',
  requestedBy: 'api',
});
```

### Pattern 3: Scope-based auth rate limiting with DB-backed state
**What:** 用一张 `auth_rate_limits` 表，按 `scope + subjectKey` 记录窗口起点、失败次数、封禁截止时间；每个 auth flow 在进入核心逻辑前先读取并判断是否被 block，失败时递增，成功时重置。
**When to use:** Worker 无法依赖单实例内存状态，但又要对 `login`、`send-login-code`、`verify-login-code`、`forgot-password`、`reset-password` 统一限流时。
**Example:**
```typescript
await assertRateLimit(config, {
  scope: 'login-password',
  subjectKey: normalizeEmail(payload.email),
});
```

### Pattern 4: Issue-new-credential, revoke-old-credential
**What:** 在签发新的 login code 或 reset token 前，先把当前用户未使用且未过期的同类凭证显式作废；验证码/重置成功消费后也要标记 `usedAt`。
**When to use:** 要满足 “同一时刻只保留符合策略的有效凭证” 时。
**Example:**
```typescript
await db
  .update(loginCodes)
  .set({ usedAt: now })
  .where(and(eq(loginCodes.userId, user.id), isNull(loginCodes.usedAt), gt(loginCodes.expiresAt, now)));
```

### Anti-Patterns to Avoid
- **继续直接在 `index.ts` 里调用 `runPriceCheck()`：** 无法复用互斥、summary persistence 和 route guard。
- **只扩展 `errors: string[]` 而不增加成功/跳过/失败计数：** 仍然不能满足 `PRICE-04` 的运维统计需求。
- **把限流只做在 `send-login-code` 的 cooldown 上：** 不能覆盖密码登录失败、验证码爆破、重置 token 猜测等风险。
- **新凭证签发后保留旧 token/code 继续有效：** 与 `AUTH-02` 直接冲突。
- **将手动巡检默认暴露给所有部署环境：** 一旦 secret 漏配，就会把高副作用入口暴露到公网。
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 巡检互斥 | 依赖 `requestId` 去重或 in-memory flag | 数据库租约表 + 显式 lease TTL | `requestId` 只能减少重复事件，不能阻止重复邮件和并发运行 |
| 任务统计 | route 层临时拼字符串日志 | `CheckReport` 扩展 + `price_check_runs` 持久化 | 便于测试，也满足运维定位失败原因 |
| auth 限流 | 每个接口各自写 if/else 计数 | 通用 `auth-rate-limit` helper | 减少 `auth.ts` 重复逻辑，策略更可审计 |
| secretless 手动巡检保护 | README 提示“线上请配置 secret” | 代码级 `MANUAL_PRICE_CHECKS_ENABLED=false` 默认关闭 + secret guard | 安全需求必须由运行时代码强制，而不是文档约定 |

**Key insight:** Phase 3 的本质是“把副作用入口从 best effort 变成 policy-driven”。无论是 scheduler 还是 auth，都需要把“能不能执行”和“为什么拒绝/跳过”变成数据库和 API 都能观察到的显式状态。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Treating `requestId` uniqueness as enough mutual exclusion
**What goes wrong:** `app_price_change_events` 虽然按 `(appId, country, requestId)` 去重，但两个并发巡检仍可能分别命中邮件发送分支和 `lastNotifiedPrice` 更新。
**Why it happens:** 把“事件去重”误认为“任务互斥”。
**How to avoid:** 在 run 级别先拿到租约，再执行整轮巡检。
**Warning signs:** 同一时间窗口里出现两个不同 `startedAt` 的 scheduled run，同一 app 被重复发邮件。

### Pitfall 2: Extending `CheckReport` without persisting run context
**What goes wrong:** route 返回值能看到统计，但 scheduled handler 的日志和后续排障没有稳定 run id / persisted summary。
**Why it happens:** 只想着 API 响应，忽略 cron 触发没有直接响应面的场景。
**How to avoid:** 新增 `price_check_runs` 表，保存 `runId`、trigger、status、统计字段和失败摘要。
**Warning signs:** 线上日志里只有字符串错误，没有 run id、没有本轮 totals。

### Pitfall 3: Counting only successful auth requests for rate limiting
**What goes wrong:** 成功请求少，但攻击者可以无限次尝试错误密码/错误验证码。
**Why it happens:** 只在 send/reset 成功后更新 cooldown，不统计失败分支。
**How to avoid:** 对 `login-password`、`verify-login-code`、`reset-password` 的失败分支也记入 rate-limit state。
**Warning signs:** `401 Invalid credentials` / `401 Invalid code` 没有任何 side effect。

### Pitfall 4: Issuing a new login code / reset token without revoking old ones
**What goes wrong:** 同一个用户同时持有多个未过期凭证，`AUTH-02` 无法成立，也放大撞库/转发风险。
**Why it happens:** 当前代码只 insert 新凭证，没有淘汰旧凭证。
**How to avoid:** 在 insert 前显式 `update ... set usedAt = now` 标记同类旧凭证失效。
**Warning signs:** `login_codes` / `password_reset_tokens` 表里同一用户存在多条 `usedAt IS NULL AND expiresAt > now()`。

### Pitfall 5: Route guard only校验 header，不校验配置状态
**What goes wrong:** `CRON_SECRET` 缺失时，`/api/jobs/check` 仍然对公网可调用。
**Why it happens:** 当前实现只在有 secret 时才比较 header，没有 secret 时直接放行。
**How to avoid:** 增加 `MANUAL_PRICE_CHECKS_ENABLED` 开关，并在 route 层对 `CRON_SECRET` 缺失返回 `503` / `404`。
**Warning signs:** `.dev.vars` 里 secret 为空时，任意 curl 都能拿到巡检结果。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from repository sources:

### Current unguarded manual route
```typescript
app.post('/api/jobs/check', async (c) => {
  const config = c.get('config');

  if (config.CRON_SECRET) {
    const token = c.req.header('x-cron-secret');
    if (token !== config.CRON_SECRET) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const report = await runPriceCheck(config);
  return c.json(report);
});
```
Source: `apps/worker/src/index.ts`

### Current scheduler report lacks skip/fail counters
```typescript
const report: CheckReport = {
  startedAt: startedAt.toISOString(),
  finishedAt: startedAt.toISOString(),
  scanned: watchedPairs.length,
  updated: 0,
  drops: 0,
  emailsSent: 0,
  errors: [],
};
```
Source: `apps/worker/src/lib/checker.ts`

### Current login-code cooldown is the only auth throttle
```typescript
if (retryAfterSeconds > 0) {
  return buildServiceResponse(429, {
    error: `Please wait ${retryAfterSeconds}s before requesting another code`,
    retryAfterSeconds,
  });
}
```
Source: `apps/worker/src/services/auth.ts`

### Current credential issuance does not revoke previous tokens/codes
```typescript
await db.insert(passwordResetTokens).values({
  userId: user.id,
  tokenHash,
  expiresAt,
});
```
Source: `apps/worker/src/services/auth.ts`
</code_examples>

<repo_specific_findings>
## Repository-Specific Findings

### Scheduler / jobs entry points
- `apps/worker/src/index.ts` 同时暴露 `POST /api/jobs/check` 和 `scheduled()`，两者目前都直接调用 `runPriceCheck(config)`。
- `apps/worker/src/lib/checker.ts` 已经有 per-app retry / pacing / requestId 规则，但没有 run-level 互斥，也没有持久化 run summary。
- `apps/worker/src/lib/checker.types.ts` 的 `CheckReport` 只有 `scanned / updated / drops / emailsSent / errors`，缺少 `succeeded / skipped / failed` 等统计字段。

### Existing scheduler safety foundation
- `apps/worker/src/lib/checker.ts` 已经使用 `requestId = scheduled:${startedAt}:${index}:${appId}:${country}`，并对 `app_price_change_events` 做 `(appId, country, requestId)` 唯一约束。
- `apps/worker/test/scheduler.rate-limit.test.ts` 已经覆盖 pacing 和 retry 行为，适合继续补锁语义、run summary 和 duplicate-run 分支。
- `apps/worker/test/fresh-install.smoke.test.ts` 已经通过 `worker.fetch()` 走手动巡检入口，可作为 route guard 的 smoke backstop。

### Existing auth surface area
- `apps/worker/src/services/auth.ts` 已包含 `registerWithLoginCode`、`loginWithPassword`、`requestPasswordReset`、`resetPassword`、`changePassword`、`sendLoginCode`、`verifyLoginCode`、`revokeSession`。
- 除了 `LOGIN_CODE_RESEND_COOLDOWN_SECONDS` 之外，没有通用 rate-limit state，也没有失败次数落库。
- `login_codes` 与 `password_reset_tokens` 只有 `expiresAt` / `usedAt`，当前不会在签发新凭证时主动废弃旧凭证。
- `apps/worker/src/middleware/auth.ts` 会在会话通过校验后更新 `lastUsedAt`，说明 session 仍然是独立能力，不在 `AUTH-02` 的主要约束范围内。

### Config / docs surface
- `apps/worker/src/env.ts` 已经用 `createOptionalIntWithDefault(...)` 和 `createOptionalBooleanWithDefault(...)` 解析 Worker 配置，适合继续补 `PRICE_CHECK_LOCK_TTL_SECONDS`、`AUTH_RATE_LIMIT_*`、`MANUAL_PRICE_CHECKS_ENABLED`。
- `apps/worker/src/types.ts` 目前没有声明所有 worker bindings，后续新增 env vars 时需要同步补齐。
- `README.md` 和 `apps/worker/.dev.vars.example` 已经把 `CRON_SECRET` 解释成生产需要的 secret，但安全要求还停留在文档层。
</repo_specific_findings>

<recommended_plan_split>
## Recommended Plan Split

### Wave 1 — 03-01 为巡检增加互斥机制和任务级统计
- 新增数据库租约表和 run summary 表。
- 扩展 `CheckReport` 为 `scanned / succeeded / skipped / failed / updated / drops / emailsSent / errors`。
- 抽出 `apps/worker/src/services/jobs.ts` 之类的 orchestration service，把获取租约、创建 run 记录、执行 `runPriceCheck()`、更新 summary、释放租约放在一个地方。
- 先让 `scheduled()` 入口使用新 service；manual route 在 03-03 再切过去。

### Wave 2 — 03-02 为认证链路增加限流、失败次数和凭证淘汰策略
- 新增 `auth_rate_limits` 表与 helper。
- 对 `login` / `send-login-code` / `verify-login-code` / `forgot-password` / `reset-password` 加入统一窗口限流。
- 新发 login code / reset token 时显式淘汰同用户旧凭证。
- 补 service 级安全回归测试。

### Wave 3 — 03-03 强化 `/api/jobs/check` 的生产鉴权与配置保护
- 新增 `MANUAL_PRICE_CHECKS_ENABLED` 配置，默认 `false`。
- route 只有在显式开启且 `CRON_SECRET` 存在时才允许访问；secret 缺失或错误时返回结构化错误。
- 手动 route 也切到 03-01 的 protected job service，确保 manual / scheduled 共用互斥与 summary 逻辑。
- 更新 README、`.dev.vars.example` 和 smoke / route tests。

### Wave 4 — 03-04 补调度与认证高风险边界测试
- 增加 duplicate-run、lock-held、secretless manual route、rate-limit block、credential invalidation、password reset session cleanup 等高风险回归测试。
- 验证 Phase 3 的 5 个 requirement IDs 都被自动化用例覆盖。

**Wave recommendation:** 按 1 → 2 → 3 → 4 顺序执行。虽然 03-02 和 03-03 业务上近乎独立，但两者都要改 `env.ts` / docs / test harness，放同一 wave 并行会制造不必要的冲突。
</recommended_plan_split>

<key_files>
## Key Files / Modules

### Scheduler / jobs
- `apps/worker/src/index.ts` — route 与 scheduled 入口
- `apps/worker/src/lib/checker.ts` — 当前巡检主逻辑与 report 构建
- `apps/worker/src/lib/checker.types.ts` — `CheckReport` / `RunPriceCheckOptions`
- `apps/worker/src/db/schema.ts` — 新增 job lease / run summary schema
- `apps/worker/drizzle/0002_job_locks_price_check_runs.sql` — 推荐的 Phase 3 第一条 migration
- `apps/worker/test/scheduler.rate-limit.test.ts` — 现有调度安全测试基线
- `apps/worker/test/fresh-install.smoke.test.ts` — manual route smoke backstop

### Auth
- `apps/worker/src/services/auth.ts` — 所有 auth flows 的主要入口
- `apps/worker/src/services/auth.types.ts` — 429 / retryAfterSeconds 等 response 结构
- `apps/worker/src/routes/auth.ts` — auth route surface
- `apps/worker/src/middleware/auth.ts` — session 校验
- `apps/worker/src/env.ts` / `apps/worker/src/constants/env.ts` — 新限流与开关配置
- `apps/worker/src/db/schema.ts` — 新增 `auth_rate_limits` 表和必要索引
- `apps/worker/drizzle/0003_auth_security_limits.sql` — 推荐的 Phase 3 第二条 migration
- `apps/worker/test/auth.security.test.ts` — 建议新增的 auth 边界测试文件

### Config / docs
- `apps/worker/src/types.ts` — Worker bindings 类型补齐
- `apps/worker/.dev.vars.example` — 新 env vars 示例
- `README.md` — 手动巡检与 auth 安全策略说明
</key_files>

<database_and_config_impact>
## Database and Config Impact

### Recommended database additions
- `job_leases`
  - `lock_key varchar(64) primary key`
  - `run_id uuid not null`
  - `locked_until timestamptz not null`
  - `updated_at timestamptz not null default now()`
- `price_check_runs`
  - `id uuid primary key`
  - `trigger varchar(16) not null` (`scheduled` / `manual`)
  - `status varchar(16) not null` (`running` / `completed` / `skipped` / `failed`)
  - `started_at`, `finished_at`
  - `scanned`, `succeeded`, `skipped`, `failed`, `updated`, `drops`, `emails_sent`
  - `error_summary text`
- `auth_rate_limits`
  - `id uuid primary key`
  - `scope varchar(32) not null`
  - `subject_key varchar(320) not null`
  - `attempt_count integer not null default 0`
  - `window_started_at timestamptz not null`
  - `blocked_until timestamptz`
  - `updated_at timestamptz not null default now()`
  - unique index on `(scope, subject_key)`

### Recommended new env vars
- `PRICE_CHECK_LOCK_TTL_SECONDS=900`
- `AUTH_RATE_LIMIT_WINDOW_MINUTES=15`
- `AUTH_RATE_LIMIT_MAX_ATTEMPTS=5`
- `AUTH_RATE_LIMIT_BLOCK_MINUTES=15`
- `MANUAL_PRICE_CHECKS_ENABLED=false`

### No new external service requirement
- 当前 phase 不需要引入 Redis、KV、Durable Objects 或外部队列。
- 关键是把 state 存进 Postgres，并让 Worker 入口都走统一 service。
</database_and_config_impact>

<validation_architecture>
## Validation Architecture

### Test Infrastructure
- Framework: `vitest`
- Quick run command: `pnpm --filter @appstore-price-radar/worker test -- test/scheduler.rate-limit.test.ts test/jobs.check-route.test.ts test/auth.security.test.ts`
- Full suite command: `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck`
- Estimated runtime: ~120 seconds

### Requirement Coverage Strategy
- `PRICE-03`: `scheduler.rate-limit.test.ts` + `scheduler.job-lock.test.ts` 锁定 duplicate-run skip、租约获取和 manual/scheduled 共用 orchestration
- `PRICE-04`: `scheduler.job-lock.test.ts` + `jobs.check-route.test.ts` 锁定 run summary 字段和失败原因可见性
- `AUTH-01`: `auth.security.test.ts` 锁定登录/验证码/重置流程的窗口限流与失败计数
- `AUTH-02`: `auth.security.test.ts` 锁定新 login code / reset token 会废弃旧凭证
- `AUTH-03`: `jobs.check-route.test.ts` + `fresh-install.smoke.test.ts` 锁定 `MANUAL_PRICE_CHECKS_ENABLED` / `CRON_SECRET` 门禁

### Wave 0 Requirements
- 新增 `apps/worker/test/jobs.check-route.test.ts`
- 新增 `apps/worker/test/scheduler.job-lock.test.ts`
- 新增 `apps/worker/test/auth.security.test.ts`

### Manual Verification Backstop
- 本地用空 `CRON_SECRET` + `MANUAL_PRICE_CHECKS_ENABLED=true` 启动 worker，确认 `POST /api/jobs/check` 返回配置错误而不是执行巡检
- 构造同一用户两次发送 login code，确认旧 code 被作废；第一次 code 再验证时返回 `401` / `429`，不会登录成功
- 同时触发 manual + scheduled 巡检 mock，确认其中一个 run 被标记为 skipped，而不是双重发邮件
</validation_architecture>

<open_questions>
## Open Questions

1. **run summary 只保留聚合计数，还是也要保留结构化 failure rows？**
   - What we know: requirement 只要求“定位失败原因”
   - Recommendation: Phase 3 先保留 `errors: string[]` + `error_summary text`，不新建失败明细表；如果后续需要 UI 化，再在 Phase 5 之后扩展

2. **manual route 在 disabled 时返回 `404` 还是 `403`？**
   - What we know: `AUTH-03` 的目标是“不对公网可用”
   - Recommendation: `MANUAL_PRICE_CHECKS_ENABLED=false` 时返回 `404`，显式开启但 secret 缺失时返回 `503`，secret 错误时返回 `401`

3. **是否需要限制 `registerWithLoginCode()` 本身的失败次数？**
   - What we know: 它本质上消费 login code，与 `verify-login-code` 风险类似
   - Recommendation: 在实现上把 `registerWithLoginCode()` 和 `verifyLoginCode()` 共用同一个 `verify-login-code` rate-limit scope
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` - Phase 3 goal、success criteria、plan titles
- `.planning/REQUIREMENTS.md` - `PRICE-03`、`PRICE-04`、`AUTH-01`、`AUTH-02`、`AUTH-03`
- `.planning/STATE.md` - 当前阶段与 blocker 记录
- `apps/worker/src/index.ts` - manual route 与 scheduled 入口
- `apps/worker/src/lib/checker.ts` - scheduler 主逻辑、retry、report
- `apps/worker/src/lib/checker.types.ts` - `CheckReport` / refresh 相关类型
- `apps/worker/src/services/auth.ts` - auth flows
- `apps/worker/src/services/auth.types.ts` - auth response contract
- `apps/worker/src/routes/auth.ts` - auth route surface
- `apps/worker/src/middleware/auth.ts` - session auth middleware
- `apps/worker/src/env.ts` - env parsing
- `apps/worker/src/constants/env.ts` - defaults
- `apps/worker/src/db/schema.ts` - login/reset/session/event tables
- `apps/worker/test/scheduler.rate-limit.test.ts` - scheduler regression baseline
- `apps/worker/test/fresh-install.smoke.test.ts` - route smoke baseline
- `apps/worker/.dev.vars.example` - current runtime vars
- `apps/worker/wrangler.toml` - cron cadence
- `README.md` - current operator guidance

### Secondary (MEDIUM confidence)
- `apps/worker/src/services/subscriptions.ts` - subscription-create refresh path，说明 scheduled/manual semantics 已被显式区分
- `apps/worker/src/types.ts` - WorkerBindings 当前声明范围
</sources>
