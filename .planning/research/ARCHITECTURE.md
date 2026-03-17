# Architecture Research

**Domain:** App Store price monitoring and alerting platform (Cloudflare Worker + Vue)
**Researched:** 2026-03-17
**Confidence:** MEDIUM-HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                Client Layer                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Vue Web App (Home/Auth/Profile/Security)                                    │
│  - Route-level views + composables + typed API client                        │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ HTTPS / JSON
┌───────────────────────────────▼──────────────────────────────────────────────┐
│                            Edge API Layer (Worker)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│  Hono routes: auth, subscriptions, prices, public feed, ops endpoints       │
│  - Auth/session middleware                                                    │
│  - Command side: create/update watch, trigger checks, admin actions          │
│  - Query side: history/feed/subscription read models                         │
└───────────────┬───────────────────────────────┬──────────────────────────────┘
                │                               │
                │ enqueue jobs                  │ cron trigger
                │                               │
┌───────────────▼───────────────┐   ┌──────────▼──────────────────────────────┐
│ Queue: price-check            │   │ Scheduler/Planner (Worker scheduled())   │
│ (at-least-once delivery)      │   │ - compute due app-country targets        │
└───────────────┬───────────────┘   │ - shard into queue messages              │
                │                   └───────────────────────────────────────────┘
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ Price Check Consumer (Worker queue handler)                                  │
│ - fetch App Store lookup                                                     │
│ - retry/backoff policy + timeout                                             │
│ - idempotent persistence (snapshot/history/drop event)                       │
│ - emit drop-detected messages                                                │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
┌───────────────▼───────────────┐
│ Queue: alert-send             │
└───────────────┬───────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ Alert Consumer + Webhook Ingest                                              │
│ - resolve subscriptions and cadence rules                                    │
│ - send email via Resend with idempotency key                                 │
│ - ingest delivery/bounce/fail events                                         │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────────────────┐
│ Data + Observability                                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Neon Postgres (system of record)                                             │
│  users, sessions, subscriptions, snapshots, history, drop_events,            │
│  check_runs, alert_attempts, alert_events, dead_letter metadata              │
│                                                                              │
│ Cloudflare observability                                                     │
│  Workers Logs + traces + metrics + DLQ queues + backlog alarms               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `Edge API Worker` | Synchronous UX-facing endpoints, validation, auth, lightweight reads | Hono routes + middleware + service modules |
| `Scheduler/Planner` | Decide what to check now, dedupe by `(appId,country)`, pace workload | `scheduled()` handler + planning query + queue producer |
| `Price Check Consumer` | External fetch + persistence + drop detection | Queue consumer + transactional DB writes + retry/backoff |
| `Alert Consumer` | Notification fan-out, cadence/threshold enforcement, idempotent send | Queue consumer + Resend client + idempotency key strategy |
| `Webhook Ingest` | Ground-truth delivery outcomes (delivered/failed/bounced) | Signed webhook endpoint + append-only events table |
| `Read Models` | Fast queries for profile dashboards and public drop feed | SQL views/materialized tables + targeted indexes |
| `Ops/Diagnostics` | Job health, failure visibility, backlog visibility | structured JSON logs + metrics + queue DLQ workflow |

## Recommended Project Structure

```text
apps/
├── worker/
│   └── src/
│       ├── api/                      # HTTP contracts and route wiring
│       │   ├── routes/
│       │   └── middleware/
│       ├── domains/                  # Business logic by bounded context
│       │   ├── auth/
│       │   ├── subscriptions/
│       │   ├── pricing/
│       │   └── alerts/
│       ├── jobs/                     # Scheduled planning and orchestration
│       │   ├── planner/
│       │   └── run-reporting/
│       ├── consumers/                # Queue handlers
│       │   ├── price-check/
│       │   └── alert-send/
│       ├── integrations/             # External APIs and adapters
│       │   ├── appstore/
│       │   ├── resend/
│       │   └── neon/
│       ├── persistence/              # DB schema, repos, read models
│       │   ├── schema/
│       │   ├── repositories/
│       │   └── projections/
│       ├── observability/            # Logging, tracing IDs, metrics wrappers
│       └── index.ts                  # Composition root
└── web/
    └── src/
        ├── app/                      # Router, layouts, global providers
        ├── features/                 # Domain slices (auth/home/profile/security)
        ├── entities/                 # Reusable typed models + formatters
        ├── shared/                   # HTTP client, ui primitives, constants
        └── stores/                   # Pinia stores only for cross-route state
```

### Structure Rationale

- **`domains/` and `features/` first:** Keep behavior grouped by domain instead of transport type so new features land in one place.
- **`jobs/` and `consumers/` separate from `api/`:** Makes async reliability work explicit and testable.
- **`integrations/` adapter boundary:** Keeps upstream instability (Apple, Resend) isolated from core business logic.
- **`persistence/projections/`:** Enables read-model optimization without polluting command logic.

## Architectural Patterns

### Pattern 1: Edge Command/Query Split with Async Processing

**What:** Keep user-facing APIs synchronous for validation/acknowledgement, but offload expensive checks and notifications to queues.
**When to use:** Always for periodic checks and fan-out notification workflows.
**Trade-offs:** Slightly higher architecture complexity, much better resilience and throughput control.

**Example:**
```typescript
// API layer: accept and enqueue quickly
await env.PRICE_CHECK_QUEUE.send({
  appId,
  country,
  reason: 'manual-trigger',
  correlationId,
})

return c.json({ accepted: true }, 202)
```

### Pattern 2: Idempotent Event Processing End-to-End

**What:** Assume at-least-once queue semantics and duplicate webhook deliveries; make writes and sends idempotent.
**When to use:** Every queue consumer and external side-effect path.
**Trade-offs:** Requires explicit keys/constraints, but prevents duplicate alerts and data corruption.

**Example:**
```typescript
// DB: upsert snapshot (idempotent)
await db.insert(appSnapshots).values(row).onConflictDoUpdate({
  target: [appSnapshots.appId, appSnapshots.country],
  set: row,
})

// Email: idempotent send key by event identity
await resend.emails.send(payload, {
  idempotencyKey: `drop/${dropEventId}/user/${userId}`,
})
```

### Pattern 3: Sharded Coordination for Upstream Rate Budgets

**What:** Use per-key coordination (optional Durable Objects) to pace calls by shard (`country` or `appId hash`), not one global lock.
**When to use:** When upstream 429/timeout rates increase or queue backlog grows.
**Trade-offs:** More moving parts, but controlled external pressure and fewer cascading retries.

**Example:**
```typescript
// One object per shard, not one global singleton
const id = env.RATE_BUDGET.idFromName(`country:${country}`)
const limiter = env.RATE_BUDGET.get(id)
const allowed = await limiter.allow({ tokens: 1 })
if (!allowed) await message.retry({ delaySeconds: 60 })
```

## Data Flow

### Request Flow (User Actions)

```
[Vue View]
  -> [API route (Hono + zod)]
  -> [Domain service]
  -> [Neon write/read]
  -> [JSON response]
```

### Async Price Check Flow (Core Reliability Path)

```
[Cron Trigger or Manual Job API]
  -> [Planner queries active unique (appId,country)]
  -> [PRICE_CHECK_QUEUE messages]
  -> [Price Check Consumer]
  -> [App Store Lookup API]
  -> [Persist snapshots + history + drop events]
  -> [ALERT_SEND_QUEUE when drop matches thresholds]
  -> [Alert Consumer -> Resend send]
  -> [Resend webhook -> alert_events table]
```

### Frontend State Management

```
[Route-level components]
  <-> [Feature composables]
  -> [shared HTTP client]
  -> [/api/* endpoints]
  -> [Pinia stores only for session/cross-route state]
```

### Key Data Flows

1. **Watch lifecycle:** `create watch -> optional immediate refresh -> snapshot visible in profile`.
2. **Scheduled monitoring:** `planner -> queue -> check -> drop event -> alert queue`.
3. **Notification lifecycle:** `alert attempt -> email provider status -> webhook outcome -> user-visible status`.
4. **Public feed:** `drop_events/read model -> country filter + dedupe -> anonymous home feed`.

## Suggested Build Order and Dependencies

### Dependency Graph

```text
Typed API contracts
  -> Queue-backed price check pipeline
    -> Idempotent alert pipeline + webhook ingestion
      -> Observability + DLQ runbook
        -> Data partition/retention + projection optimization
          -> Optional multi-worker split via Service Bindings
```

### Build Sequence

1. **Stabilize boundaries (no behavior change)**
   - Extract `api`, `domains`, `integrations`, `jobs`, `consumers` modules.
   - Dependency: none.
   - Why first: lowers risk before introducing async complexity.

2. **Introduce `PRICE_CHECK_QUEUE` pipeline**
   - Convert `runPriceCheck` from inline loop to `planner -> queue -> consumer`.
   - Dependency: Step 1 module boundaries.
   - Why second: biggest reliability gain under upstream instability.

3. **Introduce `ALERT_SEND_QUEUE` + idempotent send keys**
   - Separate drop detection from email side effects.
   - Dependency: Step 2 event emission.
   - Why third: isolates provider failures from check throughput.

4. **Add delivery telemetry via Resend webhooks**
   - Persist `sent/delivered/failed/bounced` outcomes; expose ops/admin query.
   - Dependency: Step 3 notification IDs and correlation IDs.
   - Why fourth: closes reliability feedback loop.

5. **Operational hardening**
   - Enable Workers Logs/traces, queue backlog alerts, DLQ replay scripts.
   - Dependency: Steps 2-4 async components.
   - Why fifth: needed for safe scaling and incident response.

6. **Data growth optimization**
   - Partition large time-series tables (`app_price_history`, `app_drop_events`) by time, with retention policy.
   - Dependency: stable write/query patterns from previous steps.
   - Why sixth: defer until data volume justifies complexity.

7. **Optional split into multiple Workers with Service Bindings**
   - Separate API Worker and background Worker(s) when deploy cadence diverges.
   - Dependency: mature module boundaries + ops visibility.
   - Why last: avoid premature microservice overhead.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k active watched pairs | Single Worker script can host API + queue handlers; keep 1 queue for checks, 1 for alerts. |
| 1k-50k active watched pairs | Enable queue concurrency autoscaling, adaptive scheduling intervals, and DLQ + replay workflow. |
| 50k-300k active watched pairs | Shard check queues by region/hash, partition historical tables, add read projections and cache hot feed queries. |
| 300k+ active watched pairs | Split workers by bounded context (API, checker, notifier) with Service Bindings; consider dedicated read replicas and stricter per-shard budgets. |

### Scaling Priorities

1. **First bottleneck:** upstream App Store instability and rate pressure.
   - Fix: dedupe targets, queue backoff/delay, optional per-shard coordination.
2. **Second bottleneck:** historical table growth and dashboard query latency.
   - Fix: partitioning + retention + projection tables.
3. **Third bottleneck:** notification side effects slowing checks.
   - Fix: separate alert queue, idempotent retries, webhook-based status.

## Anti-Patterns

### Anti-Pattern 1: Monolithic Inline Cron Loop

**What people do:** fetch, persist, detect, and email in one synchronous loop.
**Why it's wrong:** one flaky dependency (App Store or email) can degrade the whole run.
**Do this instead:** planner + queue consumers with per-stage retries and DLQ.

### Anti-Pattern 2: Assuming Exactly-Once Queue Processing

**What people do:** treat each queue message as unique and side-effect-safe by default.
**Why it's wrong:** queue delivery is at-least-once and order is not guaranteed.
**Do this instead:** design idempotent DB writes and provider calls (idempotency keys, unique constraints).

### Anti-Pattern 3: Global Singleton Durable Object for All Coordination

**What people do:** route all rate limiting / lock logic through one object.
**Why it's wrong:** creates avoidable hotspot and throughput ceiling.
**Do this instead:** shard by natural key (`country`, `appId hash`, tenant).

### Anti-Pattern 4: Using KV as Mutable Source of Truth

**What people do:** store authoritative subscription/check state in KV.
**Why it's wrong:** KV is eventually consistent and not suited for transactional updates.
**Do this instead:** keep authoritative writes in Postgres; use KV only as read-through cache where staleness is acceptable.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Apple iTunes Search/Lookup API | Outbound HTTP from check consumer with timeout + retry + cache/dedupe | Apple documents approximate 20 calls/min limit and recommends caching for large sites; treat as strict external budget. |
| Neon Postgres | Drizzle + Neon serverless driver, pooled connection strings, autoscaling compute | Use pooled connection for concurrent serverless loads; scale compute and set retention/index strategy early. |
| Resend Email | Async alert queue + idempotency key + webhook status ingestion | Use idempotency keys for retry safety and webhook events for delivery truth. |
| Cloudflare Queues | Decouple planner/check/notify with batching, retries, delays, DLQ | At-least-once + unordered delivery means idempotency is mandatory. |
| Cloudflare Observability | Structured logs, traces, metrics, log export | Enable observability in Wrangler and include correlation IDs across queue hops. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `api -> domains` | function calls | Keep transport concerns out of business logic. |
| `jobs/planner -> consumers/checker` | queue message contract | Version message schema; include correlation ID and attempt metadata. |
| `checker -> notifier` | queue message contract | Only emit normalized drop events, not raw upstream payloads. |
| `notifier -> webhook-ingest` | provider webhook event | Store append-only event history for audits/replay. |
| `web -> api` | typed REST client | Centralize HTTP/error parsing; avoid feature-level fetch duplication. |

## Sources

- Cloudflare Workers Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Queues overview and semantics: https://developers.cloudflare.com/queues/
- Cloudflare Queues “How Queues works”: https://developers.cloudflare.com/queues/reference/how-queues-works/
- Cloudflare Queues batching/retries/delays: https://developers.cloudflare.com/queues/configuration/batching-retries/
- Cloudflare Queues dead letter queues: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
- Cloudflare Queues consumer concurrency: https://developers.cloudflare.com/queues/configuration/consumer-concurrency/
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Workers observability: https://developers.cloudflare.com/workers/observability/
- Cloudflare Workers logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- Cloudflare Service Bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- Cloudflare Durable Objects rules: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- Cloudflare KV consistency model: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Apple iTunes Search API (includes lookup guidance and rate/caching notes): https://performance-partners.apple.com/search-api
- Resend idempotency keys: https://resend.com/docs/dashboard/emails/idempotency-keys
- Resend usage limits: https://resend.com/docs/api-reference/rate-limit
- Resend webhook event types: https://resend.com/docs/webhooks/event-types
- Neon + Cloudflare integration: https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/
- Neon connection guidance: https://neon.com/docs/get-started/connect-neon
- Neon compute/autoscaling management: https://neon.com/docs/manage/computes
- PostgreSQL table partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Vue composables guidance: https://vuejs.org/guide/reusability/composables
- Vue Router lazy loading routes: https://router.vuejs.org/guide/advanced/lazy-loading.html
- Pinia introduction: https://pinia.vuejs.org/introduction.html

---
*Architecture research for: App Store price monitoring and alerting platform*
*Researched: 2026-03-17*
