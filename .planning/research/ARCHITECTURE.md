# Architecture Research

**Domain:** App Store 价格监听与降价提醒平台（brownfield）
**Researched:** 2026-03-18
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Web SPA                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Public Feed  │  │ User Console │  │ App Detail View  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │             │
├─────────┴─────────────────┴───────────────────┴─────────────┤
│                 Cloudflare Worker + Hono                    │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ API Routes │  │ Auth / Jobs  │  │ Price Check Engine │   │
│  └─────┬──────┘  └──────┬───────┘  └─────────┬──────────┘   │
│        │                │                    │              │
├────────┴────────────────┴────────────────────┴──────────────┤
│                 Data + External Integrations                │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Neon PG     │  │ Apple Lookup API │  │ Resend Email   │  │
│  └─────────────┘  └──────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `apps/web` | 展示公开 feed、工作台、认证与 App 详情 | Vue 3 页面目录 + 轻量共享 `lib` |
| `apps/worker/src/routes` | 暴露 HTTP 接口、验参、转发到 service | Hono route + Zod validator |
| `apps/worker/src/services` | 封装业务动作与响应结构 | route-service 分层，返回 `{ status, body }` |
| `apps/worker/src/lib/checker.ts` | 编排巡检、重试、事件写入与通知触发 | 任务编排原语，后续应继续解耦 |
| `apps/worker/src/db` | 管理 schema、迁移与数据库访问 | Drizzle schema + Neon HTTP driver |
| 外部集成层 | App Store 抓价、邮件发送 | `lib/appstore.ts` 与 `lib/email-client.ts` |

## Recommended Project Structure

```text
.
├── apps/
│   ├── web/                  # Vue 3 SPA，保留现有页面域拆分
│   └── worker/               # API、cron、迁移与业务服务
├── .planning/                # 项目上下文、研究、需求、路线图
└── packages/                 # 暂不新增；只有在共享契约稳定后再考虑
```

### Structure Rationale

- **`apps/web/`**: 继续按页面域组织，保持视图目录 + 局部组件 + composables 的结构。
- **`apps/worker/`**: 保持 `routes -> services -> lib/db` 分层，后续重点是把高风险流程拆得更可测试。
- **`packages/` 暂缓引入**: 只有在共享 DTO / schema 已经明确值得沉淀时再增加，避免为了“规范”过早扩结构。

## Architectural Patterns

### Pattern 1: Thin Route, Explicit Service Response

**What:** route 只负责验参和 HTTP 适配，业务逻辑统一落在 service。
**When to use:** 所有 API 接口。
**Trade-offs:** 结构清晰、易测试；代价是文件数更多，但对当前仓库是值得的。

**Example:**
```typescript
const result = await createUserSubscription(config, user.id, input)
return c.json(result.body, result.status)
```

### Pattern 2: Shared Refresh Primitive

**What:** 订阅创建后的即时刷新与 cron 巡检都复用同一个单应用刷新原语。
**When to use:** 所有价格快照更新入口。
**Trade-offs:** 逻辑统一；但如果原语内部职责过重，就会把所有风险集中到一个热点函数。

**Example:**
```typescript
await refreshSingleApp(config, appId, country, {
  notifyDrops: false,
  source: 'subscription-create',
})
```

### Pattern 3: Page Container + Local Presentational Components

**What:** 页面负责请求和状态，组件负责渲染与交互。
**When to use:** 现有前端视图目录。
**Trade-offs:** 可维护性更强；但共享鉴权/请求逻辑如果不抽出来，页面之间仍会复制。

## Data Flow

### Request Flow

```text
用户操作
    ↓
Vue View / Composable
    ↓
HTTP Client (`buildApiUrl`)
    ↓
Hono Route + Zod 校验
    ↓
Service
    ↓
Drizzle / 外部集成
    ↓
JSON Response
    ↓
页面状态与 Toast 反馈
```

### State Management

```text
localStorage token
    ↓
auth-session helpers
    ↓
route guard / page-level apiRequest
    ↓
view state + child components
```

### Key Data Flows

1. **订阅创建流：** 用户在工作台提交订阅 -> Worker upsert 订阅 -> 触发单次刷新 -> 返回最新展示信息。
2. **定时巡检流：** cron / 手动入口触发 -> 去重 `(appId, country)` -> 抓价 -> 更新快照与事件 -> 命中条件则发邮件。
3. **公开 feed 流：** 从降价事件读取最近数据 -> 去重和统计关注人数 -> 前端首页展示。

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 个监控 pair | 现有 Worker + Neon 架构足够，重点是保证正确性和可观测性 |
| 500-5k 个监控 pair | 需要引入任务互斥、批次进度、查询优化和更明确的运行统计 |
| 5k+ 个监控 pair | 需要考虑分片调度、队列化、预聚合 feed 和更严格的限流治理 |

### Scaling Priorities

1. **First bottleneck:** 巡检严格串行且无互斥 — 先补租约/锁与任务统计。
2. **Second bottleneck:** 公开 feed 与历史查询 payload 过大 — 先做查询优化、分页或预聚合。

## Anti-Patterns

### Anti-Pattern 1: 把采集、持久化、通知塞进一个无一致性边界的函数

**What people do:** 在单个函数里连续写快照、事件、通知状态，但没有事务或幂等保护。
**Why it's wrong:** 一旦中途失败，就会留下半完成状态，直接污染历史与提醒。
**Do this instead:** 先定义明确的一致性边界，再拆出抓取、持久化、通知与任务编排职责。

### Anti-Pattern 2: 让前后端各自猜测接口字段

**What people do:** route 返回结构和页面消费结构分别手写，靠人工保持同步。
**Why it's wrong:** 类型系统无法兜底，字段漂移会在运行时才暴露。
**Do this instead:** 共享 schema/类型来源，或至少统一 DTO 定义和测试。

### Anti-Pattern 3: 用“先全量拉回来再前端算”处理所有历史数据

**What people do:** 详情页和工作台直接请求超长历史，再在浏览器做大量计算。
**Why it's wrong:** 数据增长后网络与渲染成本会快速放大。
**Do this instead:** 引入分页/时间窗口、请求取消和必要的服务端裁剪。

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Apple Lookup API | Worker 主动拉取、标准化价格结构 | 要把“无有效价格”视为异常，而不是默认值 |
| Neon Postgres | Drizzle 查询与迁移 | schema 与 SQL 基线必须统一，避免 fresh install 漂移 |
| Resend | Worker 发出降价与认证邮件 | 邮件发送失败策略需要与令牌生命周期和通知状态一致 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `web ↔ worker` | HTTP JSON API | 需要统一 DTO 契约与 401 行为 |
| `routes ↔ services` | 直接函数调用 | route 保持薄，service 返回结构化结果 |
| `services ↔ lib/db` | 直接函数调用 / query | 高风险流程要补可测试边界和一致性约束 |

## Sources

- `.planning/codebase/ARCHITECTURE.md` — 当前系统结构与数据流
- `.planning/codebase/STRUCTURE.md` — 目录组织与模块定位
- `.planning/codebase/CONCERNS.md` — 架构热点与反模式
- `README.md` — 部署与产品能力说明

---
*Architecture research for: App Store 价格监听与降价提醒平台*
*Researched: 2026-03-18*
