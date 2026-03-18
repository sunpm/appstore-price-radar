# Phase 4: 契约与前端稳态 - Research

**Researched:** 2026-03-18
**Domain:** 共享 DTO、前端鉴权请求收敛、历史查询降载、详情页信息分层
**Confidence:** HIGH

<user_constraints>
## User Constraints (from ROADMAP.md / REQUIREMENTS.md / STATE.md)

### Locked Decisions
- Phase 4 必须满足 `AUTH-04`、`API-01`、`API-02`、`API-04`、`API-05`。
- 认证和订阅相关接口必须有统一契约来源，前端不能继续依赖各自手写、可能漂移的类型定义。
- 会话失效或过期时，前端要能前置识别并稳定引导重新登录，而不是等页面报错后再被动清理。
- 工作台和详情页的历史查询不能继续通过 `limit=3650` 一次性拉全量数据。
- 详情页首屏要优先展示影响“买不买/继续关注”的核心信息，长尾元数据改成折叠展示。

### Missing Direct Context
- 当前 phase 没有 `04-CONTEXT.md`，本次规划默认使用 `ROADMAP.md`、`REQUIREMENTS.md`、`STATE.md`、通用项目研究和现有代码。
- 当前 phase 没有 `04-UI-SPEC.md`，本次规划默认沿用现有站点的视觉语言，不额外引入新的视觉规范文档。

### Claude's Discretion
- 共享契约采用独立 workspace package，还是继续放在某个 app 内部并跨 app 引用。
- 前端共享请求逻辑采用通用 `api-client` + session composable，还是更轻的单文件 helper。
- 历史接口采用 cursor + window 还是单纯 limit 缩小；只要能消除全量拉取和切换抖动即可。
- 详情页 metadata 新增字段的最小集合，以及哪些字段属于首屏核心信息。

### Deferred Ideas (OUT OF SCOPE)
- Phase 5 的公开 feed 性能优化与前端自动化测试基线
- 更安全的 cookie/session 方案替代当前 localStorage token
- 多商店支持、原生移动端、复杂推荐分析

</user_constraints>

<research_summary>
## Summary

Phase 4 当前最明显的系统性问题，不是某一个接口“偶尔不对”，而是前后端已经形成了三类结构性漂移：

1. `apps/web/src/views/auth/AuthView.vue`、`apps/web/src/views/profile/ProfileView.vue`、`apps/web/src/views/security/SecurityView.vue` 各自内嵌了 `apiRequest()`、token 注入和 `401` 清理逻辑，导致同一个会话失效场景在不同页面表现不同。
2. Worker 的 auth / subscription / history 返回结构散落在 `services/*.types.ts`，Web 又在 `views/*/types.ts` 和 `src/types/prices.ts` 里复制 DTO，`API-01` 没有真正的单一来源。
3. 工作台和详情页都把历史数据请求写死为 `limit=3650`，页面切换或订阅较多时，会同时放大请求体积、前端 chart 计算和重复请求成本。

最稳妥的推进方式，是把 Phase 4 拆成 4 个顺序清晰的 plan：

1. 先建立共享 contracts package，把 auth / subscription / history / app-detail DTO 变成真实单一来源。
2. 再把 Web 里的鉴权请求、会话恢复、`401` 清理和错误文案收敛为共享逻辑，让 `AUTH-04` 和 `API-04` 成为一条链。
3. 随后改造价格历史接口为窗口化/分页化契约，并在前端引入缓存、取消和渐进加载，解决 `API-02`。
4. 最后扩展 App Store metadata 采集与详情页展示层次，用“首屏核心信息 + 折叠扩展信息”的方式落地 `API-05`。

**Primary recommendation:** Phase 4 以 “共享 contracts package + 共享 authed api client + paged history DTO + decision-first detail layout” 为主线，在现有 `Vue 3 + Worker + Drizzle` 架构上演进，不引入新的运行时框架。
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 + Vue Router | repo-installed | 鉴权页面、工作台、详情页状态与路由行为 | 现有前端路由和页面结构已稳定，Phase 4 只需做共享逻辑与组件边界收敛 |
| TypeScript strict mode | repo-installed | contracts package、DTO 与前端/Worker 编译期约束 | `API-01` 的核心就是把字段漂移前移到编译期 |
| Hono + Zod | repo-installed | Worker route query / response contract 收敛 | 历史接口分页参数和统一返回体需要稳定校验入口 |
| Drizzle ORM | `0.44.5` | metadata schema 扩展和历史查询边界控制 | 适合新增 metadata 字段、history 查询条件和测试 fixture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@antfu/eslint-config` | repo-installed | Phase 4 前端改造后的统一风格保障 | 抽共享 composable / helper / 组件时 |
| Vitest (worker) | `3.2.4` | 历史接口、metadata mapper、contract response 回归 | Worker contract 或 query 语义有变化时 |
| `vue-tsc` | repo-installed | web 对共享 DTO / composable 收敛后的类型回归 | API/页面字段统一后必须通过 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 独立 `packages/contracts` | 继续在 `apps/web` / `apps/worker` 各维护一份 DTO | 会继续重复定义，无法真正满足 `API-01` |
| 共享 authed api client | 每个页面保留本地 `apiRequest()` | 修一个页面漏多个页面，`401` 行为持续分叉 |
| history cursor/window | 继续把 `limit` 从 3650 调小 | 只能减轻一点负担，仍然没有缓存、取消和“继续加载”能力 |
| metadata 分层展示 | 详情页全字段平铺 | 继续放大认知负担，也不能满足“核心决策信息首屏可见” |

**Verification baseline:**
```bash
pnpm typecheck
pnpm lint
pnpm --filter @appstore-price-radar/worker test
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Workspace-shared contracts as the only DTO source
**What:** 新增 `packages/contracts`，集中定义 auth、subscriptions、price-history 和 app-detail DTO；Worker 用 mapper 输出这些 DTO，Web 直接 import 同一份类型。
**When to use:** 任何需要同时被 Web 与 Worker 使用、并且字段变更必须在编译期暴露的返回结构。
**Example:**
```ts
import type { AuthSessionDto, SubscriptionListResponseDto } from '@appstore-price-radar/contracts';
```

### Pattern 2: Shared authed request layer with centralized unauthorized handling
**What:** 把 token 读取、`authorization` header 注入、`401` 清理、错误消息解析和登录跳转收敛到 `api-client` / `session` composable，而不是留在各个 view 里。
**When to use:** `AuthView`、`ProfileView`、`SecurityView` 以及后续任何需要登录态的页面。
**Example:**
```ts
const { request, handleUnauthorized, session } = useAuthedApi();
await request('/api/subscriptions', { auth: true });
```

### Pattern 3: Windowed history query + client-side progressive loading
**What:** 后端 history 接口接受 `window`、`cursor`、`pageSize`，返回 `history + page + summary`；前端用缓存、请求取消和“加载更多”替代一次性全量拉取。
**When to use:** 详情页和工作台历史图表，尤其在频繁切换 app / country 时。
**Example:**
```ts
GET /api/prices/:appId?country=CN&window=90d&pageSize=60&cursor=2026-03-01T00:00:00.000Z__123
```

### Pattern 4: Decision-first detail layout
**What:** 把详情页拆成“核心决策卡片 + 价格趋势 + 扩展元数据折叠区”，首屏优先放当前价格、距高点跌幅、评分、厂商/分类、更新时间和 App Store 跳转。
**When to use:** 详情页字段开始超出一个扁平卡片能承载的范围时。
**Example:**
- Hero：App 名称、国家、当前价格、最近更新时间、CTA
- Decision strip：距高点跌幅、最低价、评分、评价数、分类
- Folded metadata：bundle id、版本、最低系统版本、描述、发行说明

### Anti-Patterns to Avoid
- **在 Worker 和 Web 各复制一份 DTO：** 这只是“看起来对齐”，不是单一来源。
- **继续在 route view 里保留大段共享 session/request 代码：** 不符合 Vue 组件/组合式职责边界，也不利于统一修复。
- **仅把 history limit 从 3650 改成 500：** payload 仍会膨胀，也无法解决频繁切换和重算问题。
- **把所有 metadata 一股脑堆到详情页首屏：** 会直接稀释用户真正需要的决策信息。
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DTO 收敛 | 在 README 里写“字段要保持一致” | 真正的共享 TypeScript contracts package | 规范文字无法替代编译期约束 |
| 401 处理 | 每个页面各自 `if (res.status === 401)` | 共享 `api-client` + session store/composable | 才能保证行为一致且易扩展 |
| 历史性能 | 页面进入时直接请求全量历史 | history window + cursor + abort/cache | 这是 API-02 的核心控制点 |
| 详情页信息丰富 | 继续只展示 `appName/icon/storeUrl` | 扩展 lookup + snapshot metadata schema | 没有数据源，前端无法做决策分层 |

**Key insight:** Phase 4 的本质不是“给前端补几个字段”，而是把当前分散在两端的契约、请求行为和历史数据读取方式，收敛成可以复用、可以验证、不会再悄悄漂移的 shared surfaces。
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Shared contracts package created, but Worker still returns raw DB rows
**What goes wrong:** Web 虽然 import 了共享类型，但 Worker 仍把 `Date`、nullable 字段和 raw schema 直接回出去，运行时结构仍可能与 DTO 不一致。
**How to avoid:** 在 Worker service / route 层显式增加 `toXxxDto()` mapper，并对 response body 使用共享 DTO 命名。

### Pitfall 2: Centralized request helper exists, but route views still own redirect logic
**What goes wrong:** `401` 时有的页面 toast 后跳转，有的页面直接清 session，有的页面静默失败。
**How to avoid:** 把 unauthorized side effect 收口为同一个 helper/composable，并让 view 只声明“当前操作失败时展示什么”。

### Pitfall 3: History interface paginated, but chart code still assumes full history in memory
**What goes wrong:** 前端接口虽然变轻了，但切换 app/window 仍会重新拼装超大数组或重复计算。
**How to avoid:** 引入缓存键、请求取消、增量拼接与 window 切换时的显式重置。

### Pitfall 4: Metadata 增加过多，却没有信息层级
**What goes wrong:** 详情页字段是变多了，但用户仍找不到“当前值不值得买/继续盯”的关键信息。
**How to avoid:** 先定义首屏决策字段，再把剩余字段放入折叠区，并明确 UI 文案。
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from repository sources:

### Current duplicated `apiRequest()` lives in multiple route views
```ts
async function apiRequest<T>(path: string, init: RequestInit = {}, options: { auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {})
  if (options.auth && res.status === 401) {
    clearSession()
  }
}
```
Sources:
- `apps/web/src/views/auth/AuthView.vue`
- `apps/web/src/views/profile/ProfileView.vue`
- `apps/web/src/views/security/SecurityView.vue`

### Current history fetch hardcodes a very large limit
```ts
buildApiUrl(`/api/prices/${encodeURIComponent(appId.value)}?country=${country.value}&limit=3650`)
```
Sources:
- `apps/web/src/views/profile/ProfileView.vue`
- `apps/web/src/views/app/AppDetailView.vue`

### Current history payload only exposes snapshot + full history
```ts
export type PriceHistorySuccessResponse = {
  snapshot: AppSnapshot | null;
  history: AppPriceChangeEvent[];
};
```
Source: `apps/worker/src/services/prices.types.ts`

### Current App Store lookup discards most decision metadata
```ts
z.object({
  trackId: z.number().optional(),
  trackName: z.string().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().optional(),
  trackViewUrl: z.string().url().optional(),
  artworkUrl100: z.string().url().optional(),
  formattedPrice: z.string().optional(),
})
```
Source: `apps/worker/src/lib/appstore.ts`
</code_examples>

<repo_specific_findings>
## Repository-Specific Findings

### Web findings
- `AuthView.vue`、`ProfileView.vue`、`SecurityView.vue` 都在 view 文件内部维护 token、当前用户、session restore 和请求逻辑，route view 过厚。
- `ProfileView.vue` 同时承担订阅列表、创建表单、历史查看、修改目标价等多重职责；Phase 4 适合继续把共享逻辑抽离到 composable / helper，而不是继续增加 view 内复杂度。
- `AppDetailView.vue` 目前只有 `snapshot/history` 两块数据源，适合在本 phase 引入新的 `detail metadata` DTO 与折叠组件。

### Worker findings
- `services/auth.types.ts`、`services/subscriptions.types.ts`、`services/prices.types.ts` 各自维护 response body 类型，但这些类型并没有成为 Web 的 source of truth。
- `routes/auth.ts` 的 `/me` 直接返回内联对象，`routes/subscriptions.ts` / `routes/prices.ts` 也都返回 service body，缺少统一的 contract naming 和 mapper 层。
- `appSnapshots` 目前只有 `appName/storeUrl/iconUrl/currency/lastPrice/updatedAt`，无法支撑详情页的决策信息层级。

### Validation Architecture
- 自动化验证主轴应是 `pnpm typecheck`、`pnpm lint` 和 Worker 侧回归测试，因为 Phase 4 既涉及共享类型又涉及 API/query 行为。
- Phase 4 没有现成的前端测试基础设施，因此 UI 行为校验需要通过“类型检查 + lint + Worker tests + 关键手动验证”组合覆盖。
- Wave 0 不需要先安装新测试框架；如果执行中发现某个高风险点只能靠手动验证，可在 plan 内用 `acceptance_criteria + manual verify` 显式标注。
</repo_specific_findings>

## Recommendations for Planning

1. `04-01` 只解决“单一契约来源”和 response mapper，不掺入前端行为重构。
2. `04-02` 只解决 Web 请求层和会话失效处理，让 `AuthView` / `ProfileView` / `SecurityView` 共享同一条 unauthorized 路径。
3. `04-03` 把接口分页和前端渐进加载一起规划，避免只改一端导致中间态不可用。
4. `04-04` 以 metadata schema + AppDetail 分层 UI 为主，依赖 `04-03` 的 detail history 能力，但不把 feed 优化或测试基建混进来。

---
*Research completed: 2026-03-18*
*Ready for planning: yes*
