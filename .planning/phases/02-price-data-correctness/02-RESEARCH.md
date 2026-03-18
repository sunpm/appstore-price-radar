# Phase 2: 价格数据正确性 - Research

**Researched:** 2026-03-18
**Domain:** App Store 价格有效性判定、Neon HTTP 持久化一致性边界、即时刷新与巡检共享规则
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md / REQUIREMENTS.md / STATE.md)

### Locked Decisions
- Phase 2 必须满足 `PRICE-01`、`PRICE-02`、`PRICE-05`。
- 缺失或异常 App Store 价格不能再被当成真实 `0` 元写入快照、变化事件或降价事件。
- 单个 `(appId, country)` 刷新不能再留下“只更新了 snapshot”“只写了部分事件”“通知状态和持久化状态脱节”的半完成状态。
- 订阅创建后的即时刷新和定时巡检必须走同一套价格校验与持久化规则，只允许在“是否发送提醒”上有显式差异。

### Missing Direct Context
- 当前 phase 还没有 `02-CONTEXT.md`；本次规划默认只使用 `ROADMAP.md`、`REQUIREMENTS.md`、`STATE.md`、codebase map 和实际源码。

### Claude's Discretion
- 无效价格分支是返回 `null` 还是返回带 `reason` 的判别联合
- 单刷新一致性边界通过 `db.batch(...)` 还是额外封装底层 Neon SQL client
- 即时刷新与巡检共享规则是抽成 helper，还是收敛成显式 trigger/options contract

### Deferred Ideas (OUT OF SCOPE)
- 巡检互斥、任务级统计和去重租约
- `/api/jobs/check` 的生产强制鉴权
- 认证限流、验证码生命周期和前端 DTO 收敛

</user_constraints>

<research_summary>
## Summary

Phase 2 的核心不是“多抓几次价格”，而是把“抓到了什么”和“什么时候允许把它当作真实价格写库”说清楚。当前仓库的两个主要问题已经非常明确：一是 `fetchAppStorePrice()` 会把缺失价格直接回落到 `0`；二是 `refreshSingleApp()` 里 snapshot、change event、drop event 和提醒后状态更新是多段独立写操作，中途任何一步失败都可能留下半完成数据。

结合当前代码和已安装依赖，最稳妥的做法是把 Phase 2 拆成三步顺序落地：

1. 先修正 App Store 解析契约，让“找不到 App”和“找到 App 但价格无效”成为两个不同分支，彻底移除 `0` 元兜底。
2. 再把单次刷新内部的数据库写入改成一个显式的一致性边界，至少让 snapshot / change event / drop event 在同一次持久化提交里成功或一起失败。
3. 最后把即时刷新和定时巡检的调用选项收敛成同一个 shared contract，只保留 `notifyDrops` / `source` / `requestId` 这样的显式差异。

**Primary recommendation:** 以“判别联合 + batched persistence + shared refresh options”作为 Phase 2 的主线，不引入新基础设施，也不在本阶段提前处理巡检互斥或任务编排扩容。
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `0.44.5` | 当前 Worker 的查询构建与 schema 约束 | 继续沿用现有 ORM，避免在正确性 phase 中更换数据访问层 |
| `@neondatabase/serverless` | `0.10.4` | Neon HTTP client | 当前 driver 已安装，且支持 non-interactive transaction/batch |
| `drizzle-orm/neon-http` | repo-installed | 当前 Drizzle driver | `db.transaction()` 不可用，但 `db.batch(...)` 可以借底层 HTTP transaction 做一次性提交 |
| `vitest` | `3.2.4` | 回归测试与 mock | 仓库已有 DB mock、时间冻结和 route-adjacent 测试样板 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `3.24.4` | App Store payload schema 与 result contract | 需要把 lookup 结果拆成 “found / invalid-price / not-found” 时 |
| existing `createDbMock()` pattern | current repo | 模拟 Drizzle 查询链与写入副作用 | 需要给 atomicity / subscription refresh 补 deterministic tests 时 |
| `worker.fetch` + Hono runtime | current repo runtime | 验证 API 层仍能读取 Phase 2 产物 | 需要 smoke/backstop 验证时 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `db.batch(...)` 一次性提交写入 | 直接调用 `db.transaction(...)` | 当前 `neon-http` driver 明确不支持 `db.transaction()` |
| 保留 `price ?? 0` | 用 `formattedPrice === 'Free'` 推断免费 | 仍然会把缺失价格和真实免费混在一起，风险不可接受 |
| 让即时刷新继续直接传 `{ notifyDrops: false }` | 抽共享 options builder | 前者短期简单，但会继续把规则散落在多个入口 |

**Installation / verification baseline:**
```bash
pnpm install
pnpm --filter @appstore-price-radar/worker test
pnpm typecheck
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Lookup result must distinguish invalid price from not found
**What:** `fetchAppStorePrice()` 的返回值要能表达三种状态：找到且价格有效、找到但价格无效、根本没有该 App。
**When to use:** 外部数据源里“字段缺失”和“真实业务值”会造成完全不同后果时。
**Example:**
```typescript
type AppStoreLookupResult =
  | { kind: 'found'; price: number; ... }
  | { kind: 'invalid-price'; reason: 'missing-price'; ... }
  | null
```

### Pattern 2: Batched persistence before side effects
**What:** 先计算 refresh decision，再把 snapshot / change event / drop event 作为一个 batched write 提交，最后才处理邮件与订阅通知状态。
**When to use:** 一个业务动作会连带多张表写入，但外部副作用不能放进数据库事务时。
**Example:**
```typescript
await db.batch([
  snapshotUpsert,
  changeEventInsert,
  dropEventInsert,
])
```

### Pattern 3: Shared refresh contract per trigger
**What:** 用一个 shared helper 生成 refresh options，而不是让订阅创建和定时巡检各自拼 `{ notifyDrops, source, requestId }`。
**When to use:** 两个入口复用同一个底层流程，但只有少数 policy 差异需要显式表达时。
**Example:**
```typescript
buildRefreshOptions({ trigger: 'subscription-create', requestId })
buildRefreshOptions({ trigger: 'scheduled', requestId })
```

### Anti-Patterns to Avoid
- **继续把缺失价格降级成 `0` 元：** 会污染快照、历史事件、公开 feed 和提醒。
- **在 `refreshSingleApp()` 里继续顺序 `await` 多次独立写入：** 中途失败会留下不可解释的中间态。
- **把规则共享理解成“两个入口都调同一个函数就够了”：** 如果 options 是手写散落的，规则仍然会逐步分叉。
- **在 Phase 2 提前引入巡检锁或队列：** 这属于 Phase 3 的范围，会模糊当前目标。
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 单刷新一致性边界 | 自写字符串 SQL 事务编排器 | 现有 Drizzle query builder + `db.batch(...)` | 继续沿用 schema/types，改动面更可控 |
| 无效价格分类 | 在调用方到处写 `if (!price)` | 在 `appstore.ts` 统一返回判别联合 | 外部数据清洗应该集中在边界层 |
| 即时刷新/巡检差异 | 多处内联 `{ notifyDrops: false }` / `{ source: 'scheduled' }` | `buildRefreshOptions(...)` helper | 规则更可审计，也更容易补测试 |

**Key insight:** Phase 2 最重要的是把“允许写库的条件”和“允许发提醒的条件”集中到少数几个明确契约里，而不是继续靠隐含默认值。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Treating malformed lookup data as a valid free price
**What goes wrong:** 苹果返回缺失 `price`、空字段或 schema 漂移时，系统写入 `0` 并触发假降价。
**Why it happens:** 觉得“总要给个 number 才好继续后面的逻辑”。
**How to avoid:** 把无效价格保留在 lookup boundary，返回 `invalid-price` 并在 checker 层直接跳过写入。
**Warning signs:** `formattedPrice` 为空或有值，但 `price` 被默认成 `0`。

### Pitfall 2: Solving consistency with comments instead of a real write boundary
**What goes wrong:** 代码里虽然有“先写 snapshot 再写 events”注释，但仍然是多次独立 `await`。
**Why it happens:** 误以为当前 driver 没有事务支持就只能接受半完成写入。
**How to avoid:** 使用 `db.batch(...)` 把 Drizzle query 组装成一个一次性提交。
**Warning signs:** `app_snapshots` 已更新，但 `app_price_change_events` 或 `app_drop_events` 丢失。

### Pitfall 3: Shared function, divergent rules
**What goes wrong:** 即时刷新和巡检虽然都调 `refreshSingleApp()`，但 requestId、source、notifyDrops、错误处理策略分散在不同调用点。
**Why it happens:** 共享了函数，却没有共享 options contract。
**How to avoid:** 抽 `buildRefreshOptions(...)` 并给两个入口都补参数级测试。
**Warning signs:** 新规则只改了 `runPriceCheck()`，但 `createUserSubscription()` 仍走旧分支。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from repository sources:

### Current invalid fallback to replace
```typescript
price: typeof item.price === 'number' ? item.price : 0
```
Source: `apps/worker/src/lib/appstore.ts`

### Current sequential write chain to collapse
```typescript
await db.insert(appSnapshots)...onConflictDoUpdate(...)
await db.insert(appPriceChangeEvents)...onConflictDoNothing(...)
await db.insert(appDropEvents).values(...)
```
Source: `apps/worker/src/lib/checker.ts`

### Existing scheduler option injection pattern
```typescript
refreshSingleApp(appId, country, {
  notifyDrops: true,
  source: 'scheduled',
  requestId,
})
```
Source: `apps/worker/src/lib/checker.ts`
</code_examples>

<repo_specific_findings>
## Repository-Specific Findings

### Transaction feasibility in current stack
- `apps/worker/src/db/client.ts` 当前通过 `drizzle-orm/neon-http` 创建 DB client。
- repo-installed `node_modules/drizzle-orm/neon-http/session.js` 明确显示 `transaction()` 会抛出 `No transactions support in neon-http driver`。
- 同一个 driver 的 `batch()` 会调用底层 Neon HTTP `client.transaction(...)`，因此当前仓库最可行的一致性边界是 `db.batch([...])`，不是 `db.transaction(...)`。
- repo-installed `node_modules/@neondatabase/serverless/index.d.ts` 也证明底层 `sql.transaction([...])` 支持 non-interactive Postgres transaction。

### Existing test leverage
- `apps/worker/test/checker.price-change.test.ts` 已经有 snapshot / event / drop-event in-memory state，可直接扩展到 invalid-price 分支。
- `apps/worker/test/scheduler.rate-limit.test.ts` 已经从 `runPriceCheck()` 层断言传参和节流，适合继续补 scheduled refresh options contract。
- `apps/worker/test/fresh-install.smoke.test.ts` 证明 `worker.fetch` 路径健全，可作为 Phase 2 的人工回归 backstop。
</repo_specific_findings>

<validation_architecture>
## Validation Architecture

### Test Infrastructure
- Framework: `vitest`
- Quick run command: `pnpm --filter @appstore-price-radar/worker test -- test/appstore.lookup.test.ts test/checker.price-change.test.ts test/checker.atomicity.test.ts test/subscriptions.create.test.ts test/scheduler.rate-limit.test.ts`
- Full suite command: `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck`
- Estimated runtime: ~90 seconds

### Requirement Coverage Strategy
- `PRICE-01`: `appstore.lookup.test.ts` + `checker.price-change.test.ts` 锁定“无效价格不写库、不变成 `0`”
- `PRICE-02`: `checker.atomicity.test.ts` 锁定 batched persistence 与提醒状态更新顺序
- `PRICE-05`: `subscriptions.create.test.ts` + `scheduler.rate-limit.test.ts` 锁定 shared refresh options contract

### Wave 0 Requirements
- 新增 `apps/worker/test/appstore.lookup.test.ts`
- 新增 `apps/worker/test/checker.atomicity.test.ts`
- 新增 `apps/worker/test/subscriptions.create.test.ts`

### Manual Verification Backstop
- 人工构造一次 “App Store 返回缺失价格” 的 mock/staging 请求，确认工作台不会出现 `$0.00`
- 创建一个新订阅后，确认即时刷新会写快照但不会触发提醒；下一次 scheduled refresh 仍走同一套校验规则
</validation_architecture>

<open_questions>
## Open Questions

1. **无效价格原因是否要持久化到数据库？**
   - What we know: 当前需求只要求“不要把它写成真实价格”
   - What's unclear: 是否需要新增表字段存无效原因
   - Recommendation: Phase 2 先通过 return contract + `console.warn` 记录原因，不在本阶段扩 schema

2. **单刷新一致性边界直接用 `db.batch(...)` 还是封一层 helper？**
   - What we know: 当前 driver 不支持 `db.transaction()`，但支持 `db.batch(...)`
   - What's unclear: 是否需要为后续 Phase 3 的锁/队列扩展提前抽象
   - Recommendation: Phase 2 先在 `checker.ts` 内收敛 batched persistence；如果执行时复杂度继续上升，再在同一次 plan 内抽 helper
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md` - Phase 2 goal, success criteria, and plan titles
- `.planning/REQUIREMENTS.md` - `PRICE-01`, `PRICE-02`, `PRICE-05`
- `.planning/STATE.md` - current focus and known blockers
- `.planning/codebase/CONCERNS.md` - invalid price / half-write risks
- `apps/worker/src/lib/appstore.ts` - current lookup parsing and `0` fallback
- `apps/worker/src/lib/appstore.types.ts` - current lookup contract
- `apps/worker/src/lib/checker.ts` - refresh persistence and alert flow
- `apps/worker/src/lib/checker.types.ts` - current options / result types
- `apps/worker/src/services/subscriptions.ts` - immediate refresh entry
- `apps/worker/src/db/client.ts` - current `neon-http` driver
- `apps/worker/test/checker.price-change.test.ts` - reusable DB mock + price change assertions
- `apps/worker/test/scheduler.rate-limit.test.ts` - scheduler-level option injection and pacing tests
- `node_modules/drizzle-orm/neon-http/session.js` - driver-level `batch()` / `transaction()` behavior in installed package
- `node_modules/@neondatabase/serverless/index.d.ts` - installed package transaction API surface

### Secondary (MEDIUM confidence)
- `.planning/codebase/ARCHITECTURE.md` - refresh flow and integration path summary
- `.planning/codebase/TESTING.md` - current worker test patterns and gaps
- `apps/worker/test/fresh-install.smoke.test.ts` - request-level backstop pattern
</sources>
