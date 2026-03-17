# Stack Research

**Domain:** App Store price monitoring + alerting platform (brownfield extension)  
**Project:** App Store Price Radar  
**Researched:** 2026-03-17  
**Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Cloudflare Workers + Wrangler + Workers Types | Workers platform, `wrangler@4.74.x`, `@cloudflare/workers-types@4.20260317.x` | API runtime, scheduled jobs, and queue/workflow execution | You already run on Workers; hardening should use native platform primitives (Cron, Queues, Workflows, Observability) rather than introducing a second backend platform. This keeps ops surface small and improves reliability under upstream API instability. | HIGH |
| Hono | `4.12.x` | Worker-native HTTP framework | Keeps current routing/middleware model, has mature Worker support, and avoids rewrite risk. Upgrade in place for bug fixes and ecosystem compatibility. | HIGH |
| Cloudflare Queues + Cron Triggers + Workflows | Managed platform features (no npm semver) | Durable ingestion pipeline, fan-out checks, retry/backoff orchestration | This is the 2026 standard pattern on Cloudflare for resilient background work: Cron enqueues units, Queues decouple/absorb bursts, Workflows handle long retries/recovery paths. Better failure isolation than direct cron->API->DB writes. | HIGH |
| Neon Postgres + Neon Serverless Driver | Neon managed Postgres, `@neondatabase/serverless@1.0.x` | Primary relational storage for users, subscriptions, prices, alerts | Neon’s serverless driver is edge-friendly and supports HTTP/WebSocket access patterns. This aligns with Worker constraints and avoids introducing Redis/queue state as primary truth. | HIGH |
| Drizzle ORM + Drizzle Kit | `drizzle-orm@0.45.x`, `drizzle-kit@0.31.x` | Type-safe SQL and schema migrations | You already use Drizzle. Staying here is the lowest-risk way to tighten schema guarantees, generate migrations, and keep SQL explicit for troubleshooting price-check correctness. | HIGH |
| Resend | `6.9.x` | Transactional email alerts and event tracking | Existing integration should be expanded, not replaced. Pair sends with signed webhook events to track delivery/failure states and improve alert health observability. | HIGH |
| Vue + Vite + Tailwind | `vue@3.5.x`, `vite@8.x`, `@vitejs/plugin-vue@6.x`, `tailwindcss@4.2.x`, `@tailwindcss/vite@4.2.x` | Dashboard UX for subscriptions/history/security/ops screens | This is a standard 2026 frontend stack for fast iteration and low ops burden. Upgrade from Vite 5 to 8 for toolchain longevity and performance improvements; keep SPA deployment model. | MEDIUM-HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| Zod | `4.3.x` | Runtime validation and typed contracts | Upgrade from Zod 3 now, before adding more endpoints. Keeps request validation consistent across API, jobs, and webhook ingestion. | HIGH |
| `@hono/zod-validator` | `0.7.x` | Hono request/response validation middleware | Use on all auth, subscription, webhook, and admin/ops endpoints; package supports both Zod 3 and 4, easing migration. | HIGH |
| `drizzle-zod` | `0.8.x` | Derive validators from DB schema | Use for reducing schema drift between DB layer and API contracts (critical when adding bulk subscription operations). | HIGH |
| `@tanstack/vue-query` | `5.92.x` | Server-state caching, polling, retries in web app | Use for dashboard/history/recent-drops data fetching to standardize stale-time, retry, and background refresh behavior. | MEDIUM |
| `@sentry/cloudflare` | `10.43.x` | Error + trace capture for Worker runtime | Use for production incident visibility (failed checks, failed alerts, auth anomalies). Prefer this over ad-hoc log-only debugging. | MEDIUM-HIGH |
| `p-retry` | `7.1.x` | Explicit retry with backoff/jitter | Use in upstream iTunes/App Store fetch wrappers, not directly in route handlers. Keep retry policy centralized and instrumented. | MEDIUM-HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| Vitest + Cloudflare pool | `vitest@4.1.x`, `@cloudflare/vitest-pool-workers@0.13.x` | Unit/integration tests in Worker-like environment | Use for checker logic, retry logic, and alert trigger edge cases; this catches regressions before scheduled jobs run in production. | HIGH |
| TypeScript | `5.9.x` | Type safety across monorepo | Keep strict mode and project references; avoid relaxing types to move faster on critical auth/alert paths. | HIGH |
| PNPM workspace | `pnpm@10.x` | Fast, deterministic monorepo dependency management | Keep workspace boundaries (`apps/worker`, `apps/web`) and lockfile discipline to reduce release risk. | HIGH |

## Installation

```bash
# Worker runtime + backend core
pnpm --filter @appstore-price-radar/worker add \
  hono@^4.12.8 \
  drizzle-orm@^0.45.1 \
  @neondatabase/serverless@^1.0.2 \
  resend@^6.9.4 \
  zod@^4.3.6 \
  @hono/zod-validator@^0.7.6 \
  drizzle-zod@^0.8.3 \
  p-retry@^7.1.1 \
  @sentry/cloudflare@^10.43.0

# Worker dev dependencies
pnpm --filter @appstore-price-radar/worker add -D \
  wrangler@^4.74.0 \
  @cloudflare/workers-types@^4.20260317.1 \
  drizzle-kit@^0.31.10 \
  vitest@^4.1.0 \
  @cloudflare/vitest-pool-workers@^0.13.1 \
  typescript@^5.9.3

# Web app core
pnpm --filter @appstore-price-radar/web add \
  vue@^3.5.30 \
  vue-router@^4.5.1 \
  @tanstack/vue-query@^5.92.9

# Web app dev dependencies
pnpm --filter @appstore-price-radar/web add -D \
  vite@^8.0.0 \
  @vitejs/plugin-vue@^6.0.5 \
  tailwindcss@^4.2.1 \
  @tailwindcss/vite@^4.2.1 \
  vue-tsc@^3.2.5
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Cloudflare Queues + Workflows | BullMQ + Redis | Use BullMQ only if you move off Workers and need self-managed queue semantics. For this project, it adds infra and ops burden without product upside. |
| Neon Postgres | Cloudflare D1 | Use D1 if you want fully Cloudflare-local SQLite semantics and can accept relational feature tradeoffs. Keep Neon for mature Postgres behavior and existing schema. |
| Resend | AWS SES | Use SES if strict enterprise procurement/cost at very high volume dominates developer velocity. For current stage, Resend is faster to operate and already integrated. |
| Vue SPA on Vite | Nuxt full-stack | Use Nuxt if SSR/SEO becomes a core acquisition channel. Current product value is authenticated dashboard + alerts, where SPA is sufficient and simpler. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Direct cron job doing full fetch->transform->write->alert in one pass | A single upstream timeout can poison the whole run and hide partial failures; poor retry granularity | Cron to enqueue, Queue consumers for checks, Workflow retries for stuck segments |
| Node `pg`-style connection assumptions in Workers | TCP/session-oriented patterns are brittle in edge/serverless runtimes and increase timeout risk | `@neondatabase/serverless` with HTTP/WebSocket modes appropriate to query type |
| Scraping App Store HTML pages as primary source | Fragile to markup changes and easier to break silently | iTunes Lookup/Search endpoints as primary, with schema validation and anomaly detection |
| Unverified webhook ingestion (email/provider callbacks) | Security and data integrity risk; spoofed callbacks can corrupt alert state | Signed webhook verification (Resend signature flow) + idempotent event handling |
| Tooling freeze on Vite 5 + older dependency line | Security/compatibility debt accumulates and blocks future upgrades | Upgrade to Vite 8 toolchain line and keep majors current quarterly |

## Stack Patterns by Variant

**If reliability hardening is the top priority this milestone (recommended):**
- Keep architecture: Workers API + Neon + Vue SPA.
- Add: Queue-based checker pipeline, workflow retries, webhook-based delivery status ingestion, and structured observability.
- Because this addresses current active requirements with minimal migration risk.

**If alert volume grows rapidly (10x+) before next milestone:**
- Keep Postgres as source of truth; shard check jobs by country/app hash into queue partitions.
- Add notification channel abstraction (email now, channel plugins later) behind a single alert dispatcher interface.
- Because scaling fan-out and channel flexibility should be evolutionary, not a rewrite.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `hono@4.12.x` | `@hono/zod-validator@0.7.x` | Validator package requires Hono `>=3.9.0`; current line is compatible. |
| `@hono/zod-validator@0.7.x` | `zod@^3.25 || ^4.0` | Enables staged migration from Zod 3 to 4 without endpoint downtime. |
| `drizzle-orm@0.45.x` | `drizzle-kit@0.31.x`, `drizzle-zod@0.8.x` | Keep ORM/kit/zod adapters on current lines to avoid schema tooling drift. |
| `vite@8.x` | `@vitejs/plugin-vue@6.x`, `vitest@4.x` | Treat these as an upgrade set; do not bump independently. |
| `tailwindcss@4.2.x` | `@tailwindcss/vite@4.2.x` | Keep versions aligned for plugin compatibility. |
| `vue@3.5.x` | `vue-tsc@3.2.x` | Use matching modern tooling for type-check stability. |

## Confidence Notes

| Area | Level | Reason |
|------|-------|--------|
| Cloudflare background processing pattern | HIGH | Official docs support Cron + Queues + Workflows and this fits current architecture. |
| Data layer recommendation (Neon + Drizzle) | HIGH | Already in production and official docs support edge/serverless usage. |
| Frontend line (Vue 3.5 + Vite 8 + Tailwind 4) | MEDIUM-HIGH | Versions are current and documented; migration effort from Vite 5 should be planned and tested. |
| Observability tooling (`@sentry/cloudflare`) | MEDIUM-HIGH | Strong ecosystem fit; exact depth of tracing coverage depends on your instrumentation choices. |
| `@tanstack/vue-query` addition | MEDIUM | Widely used for server-state management, but current app may be simple enough to adopt incrementally. |

## Sources

- Cloudflare Workers Cron Triggers docs: https://developers.cloudflare.com/workers/configuration/cron-triggers/ (HIGH)
- Cloudflare Queues docs: https://developers.cloudflare.com/queues/ (HIGH)
- Cloudflare Workflows guide: https://developers.cloudflare.com/workflows/get-started/guide/ (HIGH)
- Cloudflare Workers observability docs: https://developers.cloudflare.com/workers/observability/ (HIGH)
- Neon serverless driver docs: https://neon.com/docs/serverless/serverless-driver (HIGH)
- Drizzle docs (PostgreSQL + Zod): https://orm.drizzle.team/docs/get-started-postgresql and https://orm.drizzle.team/docs/zod (HIGH)
- Hono Cloudflare Workers docs: https://hono.dev/docs/getting-started/cloudflare-workers (HIGH)
- Resend Node/email + webhook verification docs: https://resend.com/docs/send-with-nodejs and https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests (HIGH)
- Vue 3.5 announcement: https://blog.vuejs.org/posts/vue-3-5 (HIGH)
- Vite v8 migration/docs and release context: https://vite.dev/guide/migration and https://vite.dev/blog/announcing-vite8-beta (MEDIUM-HIGH)
- Tailwind CSS v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4 (HIGH)
- npm registry version checks (queried on 2026-03-17): `hono`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `wrangler`, `@cloudflare/workers-types`, `resend`, `zod`, `vue`, `vite`, `tailwindcss`, `@vitejs/plugin-vue`, `vitest`, `@tanstack/vue-query`, `@sentry/cloudflare`, `p-retry`, `vue-tsc` (HIGH for version accuracy at query time)

---
*Stack research for: App Store price monitoring + alerting platform*
*Researched: 2026-03-17*
