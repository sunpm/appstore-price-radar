# Phase 5: Feed 性能与回归保障 - Research

**Researched:** 2026-03-19
**Domain:** 公开降价流性能、Worker 回归测试、前端关键路径自动化、统一验证命令
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md / REQUIREMENTS.md / STATE.md)

### Locked Decisions
- Phase 5 必须满足 `API-03`、`QA-01`、`QA-02`、`QA-03`。
- 首页公开降价流在数据增长后仍需稳定返回“按 `(appId, country)` 去重后的结果”和正确关注人数。
- Worker 关键路由与服务需要补足能覆盖核心风险的回归测试，而不是只依赖人工联调。
- 前端至少要覆盖登录态恢复、订阅路径和价格历史查看这三条关键用户路径。
- 发布前必须有一个统一命令，串起类型检查、lint、自动化测试和关键 smoke path。

### Missing Direct Context
- 当前 Phase 5 没有 `05-CONTEXT.md`，本次规划默认使用 `ROADMAP.md`、`REQUIREMENTS.md`、`STATE.md` 与代码现状。
- 当前 Phase 5 没有 `05-UI-SPEC.md`，但本阶段重点是测试与稳定性，不需要额外的视觉规范文档。

### Claude's Discretion
- 公开 feed 的优化是采用单查询聚合、两段查询收敛，还是物化/预聚合策略；只要能在现有 Worker + Drizzle + Neon 架构内稳定满足 `API-03` 即可。
- 前端测试采用 `Vitest + Vue Test Utils` 的页面级集成测试，还是额外引入更重的浏览器 E2E；本阶段以“基础自动化保护”为主，优先轻量方案。
- 统一验证命令是落在根 `package.json` 的 `verify` / `test` 脚本，还是拆成 `verify:quick` / `verify:full`；只要部署前路径可复制执行即可。

### Deferred Ideas (OUT OF SCOPE)
- 为公开 feed 引入专门缓存层、队列或搜索索引
- 覆盖整站所有页面的端到端测试矩阵
- 生产级性能压测平台和长期趋势监控面板
- 更换前端框架或 Worker/数据库基础设施

</user_constraints>

<research_summary>
## Summary

Phase 5 的问题不是单点 bug，而是三条“发布基线缺口”同时存在：

1. `apps/worker/src/services/public.ts` 当前通过“先取最近 N 条 drop event -> 在内存里按 `(appId, country)` 去重 -> 再拼第二个订阅数聚合查询”来组装公开 feed。数据量一旦变大，`fetchLimit = finalLimit * multiplier` 的放大策略和 `or(...)` 组合条件都会让 `API-03` 的成本快速上升，而且结果正确性高度依赖“最近抓到的前几批数据里刚好覆盖每个去重键”。
2. Worker 测试虽然已经覆盖了价格检查和部分安全边界，但 `public` 路由/服务、认证路由、订阅路由、手动巡检入口等高风险 HTTP surface 仍缺少请求/响应级回归。`QA-01` 目前远未收口。
3. 前端 `apps/web` 还没有任何自动化测试脚本，根目录也没有统一验证命令。即便 Worker 代码继续补稳，`QA-02` 和 `QA-03` 仍然不成立。

本阶段最稳妥的推进方式，是严格按路线图里的三条 plan 边界执行，而不是把性能、Worker 测试、前端测试和脚本杂糅在一起：

1. `05-01` 先把公开 feed 的查询/聚合策略收敛为可解释、可测试、可扩展的实现，直接满足 `API-03`。
2. `05-02` 再补 Worker 关键路由/服务回归测试，把公开 feed、认证、订阅、手动巡检鉴权这些“高副作用 + 高状态复杂度”的入口锁住，满足 `QA-01`。
3. `05-03` 最后为前端补最小可行自动化保护，并在根脚本建立统一验证命令，把 `QA-02` 和 `QA-03` 一并落地。

**Primary recommendation:** 以“公开 feed 查询收敛 + Worker 路由级回归 + Web 关键路径集成测试 + 根验证脚本”为主线，不引入新的后端基础设施，也不把 Phase 5 扩成完整 E2E 平台建设。
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cloudflare Worker + Hono | repo-installed | 公开 feed、认证、订阅与手动巡检的 HTTP surface | 所有 `QA-01` 回归都围绕现有 Worker 路由与 service 展开 |
| Drizzle ORM | `0.44.5` | feed 读取、聚合和关注人数统计 | `API-03` 的关键在查询边界与聚合方式，不在更换 ORM |
| Vue 3 + Vue Router | repo-installed | 登录态恢复、订阅流、价格历史查看页面行为 | `QA-02` 要覆盖的是现有 SPA 的关键路径 |
| TypeScript strict mode | repo-installed | DTO、测试 mock 和脚本收敛时的类型约束 | Phase 5 会同时新增脚本、测试资产和 service 断言，必须保持编译期反馈 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest (worker) | `3.2.4` | Worker 路由/服务回归 | 已有测试栈，适合继续补 `public`、`auth`、`subscriptions`、`jobs` 边界 |
| `vue-tsc` + ESLint | repo-installed | 前端测试接入后的类型和静态规则回归 | 建立统一验证命令时必须纳入 |
| `Vitest + @vue/test-utils + jsdom` | new in Phase 5 | Web 关键路径页面级集成测试 | 比 Playwright 更轻，更符合“基础自动化保护”的阶段目标 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 在 `public.ts` 中继续“超量抓取 + 内存去重” | 用 SQL `row_number` / 子查询先挑每组最新 event，再按结果聚合订阅数 | 更能从根上控制扫描量和去重正确性 |
| 只补 service 级测试 | 补 Hono 路由级请求/响应回归 | `QA-01` 明确要求关键路由与服务，两者缺一不可 |
| 直接上 Playwright 全链路 E2E | 先用 `Vitest + Vue Test Utils` 做页面级关键路径测试 | 本阶段目标是“基础保护”，先用更轻、更快、更稳定的方案达标 |
| 继续靠人手串命令 | 根 `package.json` 新增统一 `verify` 入口 | `QA-03` 要求部署前路径统一，不是把命令藏在 README |

**Verification baseline:**
```bash
pnpm typecheck
pnpm lint
pnpm --filter @appstore-price-radar/worker test
pnpm --filter @appstore-price-radar/web test
pnpm --filter @appstore-price-radar/worker test:smoke
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Public feed should dedupe in the query boundary, not after fetch amplification
**What:** 把“每个 `(appId, country)` 只取最近一条 drop event”的语义放到查询边界里完成，再对这一批去重后的结果补关注人数聚合，而不是先用放大倍率拉回更多 event 再在内存中裁剪。
**When to use:** `apps/worker/src/services/public.ts` 中任何需要同时满足“最近优先 + 去重 + limit”的 feed 查询。
**Example:**
```ts
// 示例方向：先得到每个 (appId, country) 的最新 drop，再按 detectedAt 倒序 limit
// 可以用子查询、grouping 或 row_number 风格 SQL；关键是 dedupe 语义必须在 DB 边界完成
```

### Pattern 2: Route-level tests should lock request parsing and response shape, not only pure logic
**What:** 除了 service 单元测试，还要对 `/api/public/drops`、认证相关路由、订阅相关路由、`/api/jobs/check` 做请求/响应级回归，覆盖 query 默认值、401/403/429、错误文案和 DTO shape。
**When to use:** 所有会被前端直接调用、或一旦回归会影响线上行为的 Worker 路由。
**Example:**
```ts
const res = await app.request('/api/public/drops?country=US&limit=20')
expect(res.status).toBe(200)
expect(body.items[0]).toHaveProperty('submissionCount')
```

### Pattern 3: Frontend critical path tests should target route views + composables, not isolated micro-components
**What:** Phase 5 前端测试不需要从视觉原子组件开始，而应围绕登录态恢复、订阅流程和价格历史查看这些真实业务路径，结合 router、mock fetch 和 session storage 做页面级集成测试。
**When to use:** `AuthView`、`ProfileView`、`AppDetailView` 及其共享组合式逻辑。
**Example:**
```ts
// 方向：mount route view with router + mocked fetch
// 验证会话恢复、未授权重定向、创建订阅成功提示、历史数据加载与错误状态
```

### Pattern 4: Verification command should encode release policy, not just developer convenience
**What:** 根脚本需要明确“发布前必须跑哪些命令”，至少区分快速验证和完整验证，并把 Web/Worker 各自已有脚本串成一个官方入口。
**When to use:** 根 `package.json`、README/部署说明与后续 PR 验证步骤。
**Example:**
```json
{
  "scripts": {
    "verify": "pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @appstore-price-radar/worker test:smoke"
  }
}
```
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| feed 去重 | 继续靠 `Set` + fetch multiplier 在内存中碰运气裁剪 | 让数据库先得出每组最新 drop，再做 limit | 才能同时控制正确性与扫描成本 |
| Worker 回归 | 只给 service 补 happy path 单测 | service + route 双层回归 | 高风险入口的 query/default/error 行为只在 HTTP 层可见 |
| 前端自动化 | 从最小展示组件开始堆很多碎测试 | 直接围绕登录态、订阅流、价格历史做页面级集成测试 | 更贴近 `QA-02`，投入产出更高 |
| 统一验证 | 继续让维护者记住四五条手工命令 | 在根脚本定义 `verify` / `verify:full` 之类入口 | 才能把 `QA-03` 变成稳定流程，而不是口头约定 |

**Key insight:** Phase 5 要解决的不是“再多写几条测试”，而是把 feed 的性能边界、关键入口的回归边界和部署前验证边界同时固定下来。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Public feed still fetches too many rows before dedupe
**What goes wrong:** 即便代码结构看起来更整洁，如果核心策略仍是 `finalLimit * multiplier` 抓取后再去重，数据增长后还是会在 DB 扫描量和 Worker 内存处理上持续放大。
**How to avoid:** 把“每组最新 event”移动到查询边界完成，并对 limit / country filter / count aggregation 一起写回归测试。

### Pitfall 2: Only the public service gets tests, but route parsing still drifts
**What goes wrong:** service 逻辑是对的，但 `dedupe`、`limit`、`country` 默认值、非法 query、响应码和 JSON shape 仍可能回归。
**How to avoid:** 至少给 `/api/public/drops` 补 route-level 测试，并覆盖默认 query 和错误边界。

### Pitfall 3: Frontend tests exist, but they only cover utility functions
**What goes wrong:** 代码覆盖率看起来变高了，但登录态恢复、订阅提交、价格历史加载这些真正影响用户流程的路径仍未被保护。
**How to avoid:** 测试目标优先选 route view + composable + router + mocked network 的组合。

### Pitfall 4: Unified verify command omits smoke path or web tests
**What goes wrong:** CI/发布前虽然执行了 `typecheck` 和 worker tests，但真正会暴露环境回归的 smoke path、以及前端关键流程测试没有被纳入官方门槛。
**How to avoid:** 明确快速验证与完整验证的边界，并把 smoke path 作为完整验证的一部分。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from repository sources:

### Current public feed dedupes after over-fetching
```ts
const fetchLimit = useDedupe
  ? Math.min(finalLimit * PUBLIC_DROPS_FETCH_MULTIPLIER, PUBLIC_DROPS_FETCH_MAX_LIMIT)
  : finalLimit
```
Source: `apps/worker/src/services/public.ts`

### Current public feed counts subscriptions in a second grouped query
```ts
countRows = await db
  .select({
    appId: subscriptions.appId,
    country: subscriptions.country,
    submissionCount: sql<number>`count(*)::int`,
  })
```
Source: `apps/worker/src/services/public.ts`

### Current home page always fetches 120 items and filters keyword in memory
```ts
const params = new URLSearchParams({ limit: '120', dedupe: '1' })
const res = await fetch(buildApiUrl(`/api/public/drops?${params.toString()}`))
```
Source: `apps/web/src/views/home/HomeView.vue`

### Current root scripts have no unified verify/test entry
```json
{
  "scripts": {
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm --filter @appstore-price-radar/web lint"
  }
}
```
Source: `package.json`
</code_examples>

<repo_specific_findings>
## Repository-Specific Findings

### Public feed / API-03
- `apps/worker/src/services/public.ts` 目前把公开 feed 设计成“两段式”：
  - 第一步从 `appDropEvents` 取最近事件，并按 `detectedAt desc` 排序；
  - 第二步在 Node/Worker 内存里按 `(appId, country)` 去重；
  - 第三步再按结果集拼一个 `subscriptions` 聚合查询拿 `submissionCount`。
- 这种实现的优点是直观、易改，但存在三个 Phase 5 风险：
  - `fetchLimit` 依赖常量倍率放大，不是真正的数据边界；
  - 结果正确性与“最近窗口内是否覆盖足够多去重键”耦合；
  - `pairCondition = or(...)` 随结果数量增长会让 SQL 条件持续膨胀。
- `apps/web/src/views/home/HomeView.vue` 在 mounted 时固定请求 `limit=120&dedupe=1`，随后只在前端做 keyword filter。这意味着 feed 返回成本会直接反映到首页首屏等待时间。

### Worker tests / QA-01
- 当前 `apps/worker/test` 已经有价格检查、schema bootstrap、scheduler rate limit 等测试样板，说明 mock DB、mock env、冻结时间这些高价值模式已经存在。
- 但 `public` 路由/服务、认证路由、订阅创建/删除路由、`/api/jobs/check` 的 HTTP 层回归仍明显空白，正好对应 `QA-01` 的补测方向。
- 现有测试风格更适合继续沿用 Vitest 和 request-level/route-level 断言，而不是为 Worker 再单独引入第二套测试框架。

### Frontend tests / QA-02
- `apps/web/package.json` 目前没有 `test` 脚本，也没有 `vitest`、`@vue/test-utils`、`jsdom` 或 Playwright 依赖。
- 因为前端还没有任何测试基础设施，Phase 5 更适合把目标限制在“关键路径自动化保护”：
  - 登录态恢复 / 失效跳转
  - 工作台订阅创建或删除路径
  - App 详情页价格历史加载与错误状态
- 这类场景可以通过 `Vitest + Vue Test Utils + mocked fetch/router/storage` 完成，不必一上来就建设全链路浏览器测试。

### Verify command / QA-03
- 根 `package.json` 只有 `build`、`typecheck`、`lint`，缺少统一 `test`/`verify` 入口。
- Worker 已有 `test` 与 `test:smoke`，Web 只有 `typecheck` / `lint` / `build`。Phase 5 非常适合在根脚本层建立统一命令，并把 smoke path 明确纳入完整验证。

### Recommended plan split
- `05-01: 优化公开降价流查询与聚合策略`
  - 聚焦 `apps/worker/src/services/public.ts`、`apps/worker/src/routes/public.ts` 以及相关 DTO / tests
  - 输出应包含正确的 dedupe、关注人数聚合、route 回归与性能边界验证
- `05-02: 补 Worker 关键路由/服务回归测试`
  - 聚焦认证、订阅、公开 feed、手动巡检鉴权和错误边界
  - 优先补 route-level regression，再补 service-level 高风险状态机
- `05-03: 建立前端关键路径测试与统一验证命令`
  - 建立 Web 测试基建、关键路径测试、根 `verify` 命令
  - 让 QA-02 和 QA-03 在同一个 plan 里闭环
</repo_specific_findings>

<validation_architecture>
## Validation Architecture

### Phase validation posture
- **Quick feedback path:** `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test -- test/public.drops.test.ts test/public.route.test.ts`
- **Full feedback path:** `pnpm typecheck && pnpm lint && pnpm --filter @appstore-price-radar/worker test && pnpm --filter @appstore-price-radar/web test && pnpm --filter @appstore-price-radar/worker test:smoke`
- **Why this split:** `05-01` 主要改公开 feed，最快回归应该直击 public service/route；完整路径再纳入 Worker 全量测试、前端关键路径测试和 smoke。

### Expected Wave 0 additions
- `apps/worker/test/public.drops.test.ts` 或同等文件，用来锁住 dedupe、排序、submissionCount 聚合
- `apps/worker/test/public.route.test.ts`，用来锁住 `/api/public/drops` 的 query 默认值与响应 shape
- `apps/web/vitest.config.ts`、`apps/web/test/setup.ts`、`apps/web/test/*.test.ts`，建立最小前端测试基建
- 根 `package.json` 的 `test` / `verify` / `verify:full`（命名可由 planner 定稿）

### Manual checks that still matter
- 本地 `pnpm dev` 下打开首页，确认 feed 响应时间、列表去重结果和关注人数没有明显异常
- 模拟过期/失效 session 后访问工作台或安全相关入口，确认会话恢复与未授权跳转表现一致
- 部署前执行统一验证命令，确认 smoke path 仍能通过 fresh install 基线
</validation_architecture>

---
*Phase: 05-feed-performance-regression*
*Research completed: 2026-03-19 for planning workflow*
