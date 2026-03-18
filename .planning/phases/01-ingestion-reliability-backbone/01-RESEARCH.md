# Phase 1: Ingestion Reliability Backbone - Research

**Researched:** 2026-03-18  
**Domain:** Cloudflare Worker ingestion reliability (queueing, retries, DLQ replay, event-based history)  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add per-app detail route in web app (`/apps/:appId`) with:
  - latest observed price
  - one-year low summary
  - chronological price change events (up/down + date)
- Persist price history as change events only. No new history row when observed
  price is unchanged for same app + storefront + currency.
- Price change event schema must keep provenance:
  `app_id`, `storefront`, `currency`, `old_amount`, `new_amount`,
  `changed_at`, `source`, `request_id`.
- Scheduler must support configurable interval and jitter, with conservative
  defaults (target >= 6h base interval) instead of very frequent polling.
- Worker must enforce upstream safety controls:
  - bounded retries/backoff for transient failures
  - explicit handling for 429/rate-limited responses
  - per-storefront/app throttling to avoid burst patterns
- If upstream policy risk is uncertain, default to lower-frequency checks and
  document trade-off (`freshness` vs `ban-risk`) in ops docs.

### Claude's Discretion
- Decide exact queueing model (single queue with dedupe key vs multi-queue by
  shard/storefront), as long as ING-01..ING-04 remain satisfied.
- Choose exact jitter algorithm and retry coefficients; keep them configurable
  via environment variables.
- Choose whether app detail UI lands fully in this phase or with a minimal
  vertical slice gated behind feature flag, provided data model/API support is
  completed now.

### Deferred Ideas (OUT OF SCOPE)
- Multi-store expansion beyond Apple storefronts.
- Recommendation features ("buy now vs wait").
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ING-01 | System schedules due checks as deduplicated, shardable work items instead of a single monolithic run. | Queue-based enqueue-only scheduler, deterministic dedupe key, and DB uniqueness constraints on work windows/shards. |
| ING-02 | Price check workers retry transient upstream failures with bounded exponential backoff. | Cloudflare Queue `retry()` with bounded delay cap + explicit transient error classification (429/5xx/network). |
| ING-03 | Failed check jobs are sent to a dead-letter queue with enough context for replay. | Queue `dead_letter_queue` + `max_retries` configuration and message schema including replay context (`request_id`, window, storefront, app IDs). |
| ING-04 | Operators can replay failed or missed check windows without creating duplicate downstream effects. | Replay endpoint + idempotency via DB unique constraints (`request_id` scoped keys), event-only writes, and no-op on duplicates. |
</phase_requirements>

## Summary

Current Phase 1 baseline is not yet aligned with ING-01..ING-04: `runPriceCheck()` in [`apps/worker/src/lib/checker.ts`](/Users/sunpm/i/appstore-price-radar/apps/worker/src/lib/checker.ts) still loops monolithically through active subscriptions, scheduled every 30 minutes from [`wrangler.toml`](/Users/sunpm/i/appstore-price-radar/apps/worker/wrangler.toml), and writes price history on every run (including unchanged prices). This violates both reliability and user constraints (event-only history, safer schedule, replay-safe ingestion).

Cloudflare Queues are the standard fit for this phase in this stack: they provide at-least-once delivery, consumer-side `ack()` / `retry()` controls, bounded retries, and DLQ routing. The key planning implication is that at-least-once means duplicates are expected; idempotency must be enforced in Postgres (not assumed from queue semantics). Replay architecture should be built around deterministic job identity (`request_id` + scope key), not around implicit queue behavior.

Apple's Search API guidance still indicates roughly 20 calls/minute and recommends caching. A conservative plan should move to an enqueue-only cron at >=6h base cadence with jitter and throttle budget below that limit. This fits user constraints and reduces anti-abuse risk while preserving coverage through shardable queue workers.

**Primary recommendation:** Implement a single Cloudflare Queue ingestion pipeline (scheduler -> worker consumer -> DLQ) with DB-enforced idempotency and event-only price history writes, defaulting to a >=6h jittered schedule and capped retry backoff.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cloudflare Queues | Platform feature (Workers) | Shardable ingestion work transport with retries + DLQ | Native fit for Worker runtime; supports explicit `ack/retry`, DLQ, and bounded retries. |
| Wrangler | Repo: `4.9.1`; latest: `4.75.0` (published 2026-03-17) | Configure queue bindings, consumer settings, cron triggers | Required deploy/config surface for Workers + Queues. |
| Hono | Repo: `4.9.10`; latest: `4.12.8` (published 2026-03-14) | Replay/admin/public API routes in worker | Already adopted in codebase; low-friction extension for replay/detail endpoints. |
| drizzle-orm | Repo: `0.44.5`; latest: `0.45.1` (published 2025-12-10) | Transactional idempotency, dedupe inserts, event writes | Typed conflict-handling (`onConflict...`) is key for replay safety. |
| PostgreSQL (Neon) | Existing infra | Durable source of truth for job state, event history, replay status | Needed to guarantee idempotent downstream effects across retries/replays. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @cloudflare/vitest-pool-workers | Latest `0.13.2` (published 2026-03-17) | Test queue/scheduled handlers in Worker-like runtime | Use for Phase 1 integration tests of queue consumers and scheduled producer behavior. |
| Vitest | Repo: `3.2.4`; latest: `4.1.0` | Test runner for worker code | Keep repo version for now; Cloudflare integration docs currently describe compatibility with Vitest `2.0.x || 3.2.x`. |
| Vue Router | Repo: `4.5.1`; latest: `5.0.3` (published 2026-02-19) | `/apps/:appId` detail route requirement | Required to satisfy "every app has a detail page" in web app. |
| Zod | Repo: `3.24.4`; latest: `4.3.6` (published 2026-01-22) | Validate queue payload and replay request schema | Prevent poison messages and malformed replay requests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloudflare Queues | Durable Objects + alarms | More custom scheduling/state logic; higher implementation and ops complexity for this phase. |
| Single queue + shard key in payload | Multiple queues by storefront/shard | Multi-queue can isolate hot regions but increases config and operational overhead in Phase 1. |
| DB idempotency constraints | In-memory dedupe cache | In-memory dedupe fails across retries/restarts/replay windows; unsafe for ING-04. |

**Installation:**
```bash
# Core phase implementation needs no new runtime dependency.
# Optional but recommended for Worker integration tests:
pnpm --filter @appstore-price-radar/worker add -D @cloudflare/vitest-pool-workers
```

**Version verification:** verified via `npm view <package> version time --json` on 2026-03-18.
- `wrangler` `4.75.0` (published 2026-03-17)
- `hono` `4.12.8` (published 2026-03-14)
- `drizzle-orm` `0.45.1` (published 2025-12-10)
- `drizzle-kit` `0.31.10` (published 2026-03-17)
- `@cloudflare/vitest-pool-workers` `0.13.2` (published 2026-03-17)
- `vitest` `4.1.0` (published 2026-03-12)
- `zod` `4.3.6` (published 2026-01-22)
- `vue` `3.5.30` (published 2026-03-09)
- `vue-router` `5.0.3` (published 2026-02-19)

## Architecture Patterns

### Recommended Project Structure
```text
apps/worker/src/
├── ingestion/
│   ├── scheduler.ts          # due-window selection + shard enqueue
│   ├── consumer.ts           # queue consumer, retry/backoff classification
│   ├── replay.ts             # replay enqueue path + idempotency checks
│   └── types.ts              # message schema including request_id/source/window
├── services/
│   ├── app-detail.ts         # app detail payload (snapshot + event timeline + one-year low)
│   └── prices.ts             # keep existing route behavior compatible
└── db/
    ├── schema.ts             # add ingestion jobs + price change events
    └── migrations/           # indexes + unique constraints for idempotency

apps/web/src/
├── views/apps/AppDetailView.vue   # /apps/:appId detail page
└── router.ts                       # add detail route + list-page linking
```

### Pattern 1: Enqueue-Only Scheduler with Deterministic Dedupe
**What:** Scheduled cron creates shardable queue work items for due checks, not direct App Store fetch loops.  
**When to use:** ING-01 baseline; every scheduled pass should only enqueue deduped tasks.

**Example:**
```typescript
// Source: Cloudflare Queues producer APIs + Drizzle conflict handling
const requestId = `${windowStartIso}:${windowEndIso}:${storefront}:${shard}`;
const inserted = await db
  .insert(ingestionJobs)
  .values({ requestId, storefront, shard, windowStart: windowStartIso, windowEnd: windowEndIso })
  .onConflictDoNothing({ target: ingestionJobs.requestId })
  .returning({ requestId: ingestionJobs.requestId });

if (inserted.length > 0) {
  await env.PRICE_CHECK_QUEUE.send(
    { requestId, storefront, shard, windowStart: windowStartIso, windowEnd: windowEndIso, source: 'cron' },
    { delaySeconds: jitterSeconds } // bounded jitter
  );
}
```

### Pattern 2: Explicit Retry Classification in Queue Consumer
**What:** Consumer uses `msg.retry({ delaySeconds })` only for transient failures (429/5xx/network), and `msg.ack()` for terminal/no-op outcomes.  
**When to use:** ING-02 and ING-03; avoid uncaught exceptions that retry whole batch unexpectedly.

**Example:**
```typescript
// Source: Cloudflare Queues ack/retry semantics and retry-delay guidance
for (const msg of batch.messages) {
  try {
    const outcome = await processCheck(msg.body);
    if (outcome.type === 'transient_error') {
      const delay = Math.min(2 ** msg.attempts * 30, 43_200); // <= 12h cap
      msg.retry({ delaySeconds: delay });
      continue;
    }
    msg.ack(); // success, duplicate/no-op, or terminal validation error
  } catch {
    const delay = Math.min(2 ** msg.attempts * 30, 43_200);
    msg.retry({ delaySeconds: delay });
  }
}
```

### Pattern 3: Event-Only History + Replay-Safe Idempotency
**What:** Write price history only when value changes; enforce idempotency via DB unique keys using `request_id` provenance.  
**When to use:** Every consumer write path and replay path (ING-04 + user constraint #2).

**Example:**
```typescript
await db.transaction(async (tx) => {
  const current = await tx.query.appSnapshots.findFirst({ where: eq(appSnapshots.appId, appId) });
  const changed = !current || current.lastPrice !== newAmount;

  if (changed) {
    await tx.insert(appPriceEvents).values({
      appId, storefront, currency, oldAmount: current?.lastPrice ?? null, newAmount,
      changedAt, source, requestId,
    }).onConflictDoNothing({ target: [appPriceEvents.requestId, appPriceEvents.appId, appPriceEvents.storefront] });
  }

  await tx.insert(appSnapshots).values({ appId, storefront, lastPrice: newAmount })
    .onConflictDoUpdate({ target: [appSnapshots.appId, appSnapshots.storefront], set: { lastPrice: newAmount } });
});
```

### Anti-Patterns to Avoid
- **Monolithic scheduled loop:** Calling App Store directly in a single cron run is not shardable or replay-safe.
- **Unconditional history insert:** Writing every observation creates noise and violates event-only requirement.
- **Relying on queue delivery for idempotency:** Queues are at-least-once; duplicates must be absorbed by DB constraints.
- **Throwing after partial `ack/retry` decisions:** Uncaught exceptions trigger full-batch retry semantics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed work queue | Custom DB polling loop with ad hoc locks | Cloudflare Queues + consumer config | Native retries, DLQ, batching, and scaling behaviors already provided. |
| Retry framework | Custom backoff scheduler table | Queue `retry()` + `max_retries` + `retry_delay` | Lower bug surface and directly tied to delivery semantics. |
| Replay dedupe | In-memory replay guards | Postgres unique constraints + `onConflictDoNothing` | Survives restarts and multi-attempt delivery. |
| Route param parsing | Manual string parsing in web routes | Vue Router dynamic routes (`/apps/:appId`) | Less brittle route behavior for required detail page. |

**Key insight:** In this domain, reliability comes from combining platform queue semantics with database idempotency. Either part alone is insufficient for ING-04.

## Common Pitfalls

### Pitfall 1: Full-Batch Retries from Uncaught Exceptions
**What goes wrong:** One thrown error can cause already-processed messages in the same batch to retry.  
**Why it happens:** Queue consumers default to retrying unacknowledged messages when exceptions escape handler.  
**How to avoid:** Handle errors per message and call `ack()` / `retry()` explicitly; avoid uncaught exceptions after partial processing.  
**Warning signs:** Duplicate writes from same batch and unexpectedly high retry counts.

### Pitfall 2: Missing Idempotency Keys in Replay Path
**What goes wrong:** Replaying a window duplicates snapshots/events/alerts.  
**Why it happens:** Replay is implemented as "enqueue again" without stable request identity and DB uniqueness constraints.  
**How to avoid:** Include `request_id` in message schema and enforce uniqueness in write tables and ingestion job ledger.  
**Warning signs:** Duplicate `changed_at` events for same app/storefront and repeated downstream side effects.

### Pitfall 3: Aggressive Polling Bursts Triggering Upstream Throttling
**What goes wrong:** 429 bursts, elevated error rates, and growing queue backlog.  
**Why it happens:** Cron cadence too frequent and insufficient jitter/throttling.  
**How to avoid:** Base schedule >=6h, jitter enqueue times, and keep effective call rate safely below Apple guidance (~20 calls/min).  
**Warning signs:** Rising 429 ratio, retry amplification, and staleness drift despite frequent scheduling.

### Pitfall 4: Cron Trigger Debug Confusion
**What goes wrong:** Teams expect immediate schedule updates and local-time semantics.  
**Why it happens:** Cron updates can take up to 15 minutes to propagate and run in UTC.  
**How to avoid:** Document UTC schedules and rollout delay; validate in logs before incident response decisions.  
**Warning signs:** "Missing" runs right after deploy and timezone mismatch reports.

### Pitfall 5: Queue Retention Assumptions
**What goes wrong:** Old failures disappear before replay.  
**Why it happens:** Queue retention is bounded (default 4 days, max 14 days).  
**How to avoid:** Persist replay-critical metadata in Postgres and monitor DLQ age/backlog.  
**Warning signs:** Operators cannot replay older incidents from queue alone.

## Code Examples

Verified patterns from official sources:

### Queue Consumer Skeleton with Explicit Ack/Retry
```typescript
// Source: https://developers.cloudflare.com/queues/configuration/javascript-apis/
export default {
  async queue(batch, env) {
    for (const msg of batch.messages) {
      try {
        await handleCheck(env, msg.body);
        msg.ack();
      } catch {
        const delaySeconds = Math.min(2 ** msg.attempts * 30, 43_200);
        msg.retry({ delaySeconds });
      }
    }
  },
};
```

### Replay Endpoint Contract
```typescript
// Source: Cloudflare Queues producer API + idempotency pattern
type ReplayRequest = {
  windowStart: string;
  windowEnd: string;
  storefront?: string;
  appIds?: string[];
  reason: string;
};

// POST /api/jobs/replay
// 1) validate payload
// 2) derive deterministic request_id set
// 3) enqueue only missing jobs (onConflictDoNothing)
// 4) return accepted/skipped counts
```

### Vue Router Detail Route
```typescript
// Source: https://router.vuejs.org/guide/essentials/dynamic-matching.html
{
  path: '/apps/:appId',
  name: 'app-detail',
  component: AppDetailView,
  props: true,
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic cron loops that fetch directly | Queue-backed shardable ingestion with enqueue-only scheduler | Modern Worker queue architecture (current Cloudflare Queues guidance) | Better isolation, retries, and replay control for ING-01..04 |
| Snapshot-on-every-check history | Event-only change log with provenance keys | User-locked decision for Phase 1 (2026-03-18) | Lower storage/noise and more trustworthy timeline |
| Best-effort re-run scripts | DLQ + deterministic replay API | Reliability-first requirement in roadmap/requirements | Operators can replay safely without duplicate downstream effects |

**Deprecated/outdated:**
- Monolithic `runPriceCheck` as primary ingestion backbone (keep only as temporary fallback until queue pipeline is cut over).
- 30-minute global polling cadence in [`wrangler.toml`](/Users/sunpm/i/appstore-price-radar/apps/worker/wrangler.toml:7) for this product context.

## Open Questions

1. **Single queue vs multi-queue split**
   - What we know: Both satisfy constraints if dedupe/idempotency is correct.
   - What's unclear: Expected app/storefront scale in next 90 days.
   - Recommendation: Start with one queue + shard key + `max_concurrency`; split only after observed hotspot metrics.

2. **Replay UX scope in Phase 1**
   - What we know: ING-04 requires executable replay without duplicate effects.
   - What's unclear: CLI-only operator replay vs API endpoint + minimal web admin.
   - Recommendation: Deliver authenticated API replay endpoint in Phase 1; defer richer operator UI unless plan capacity allows.

3. **Detail-page depth in this phase**
   - What we know: User requires every app detail page and event timeline support now.
   - What's unclear: Full polished UI vs feature-flagged vertical slice.
   - Recommendation: Ship API + router + minimal functional detail page in Phase 1; polish can iterate later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `3.2.4` (repo current); optional `@cloudflare/vitest-pool-workers@0.13.2` for Worker integration |
| Config file | none currently (add `apps/worker/vitest.config.ts` in Wave 0 if worker pool is adopted) |
| Quick run command | `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/*.test.ts` |
| Full suite command | `pnpm --filter @appstore-price-radar/worker test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ING-01 | Scheduler enqueues deduplicated shardable work items (no monolithic direct fetch loop) | integration | `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/scheduler.test.ts -t "ING-01"` | ❌ Wave 0 |
| ING-02 | Consumer retries transient failures with bounded exponential backoff and 429 handling | integration | `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/retry-policy.test.ts -t "ING-02"` | ❌ Wave 0 |
| ING-03 | Exhausted failures land in DLQ with replay context payload | integration | `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/dlq-routing.test.ts -t "ING-03"` | ❌ Wave 0 |
| ING-04 | Replaying failed/missed windows is idempotent (no duplicate downstream side effects) | integration | `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/replay-idempotency.test.ts -t "ING-04"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @appstore-price-radar/worker test -- test/ingestion/*.test.ts`
- **Per wave merge:** `pnpm --filter @appstore-price-radar/worker test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/worker/test/ingestion/scheduler.test.ts` — covers REQ-ING-01
- [ ] `apps/worker/test/ingestion/retry-policy.test.ts` — covers REQ-ING-02
- [ ] `apps/worker/test/ingestion/dlq-routing.test.ts` — covers REQ-ING-03
- [ ] `apps/worker/test/ingestion/replay-idempotency.test.ts` — covers REQ-ING-04
- [ ] `apps/worker/test/ingestion/fixtures.ts` — shared queue payload + DB fixtures
- [ ] Framework install: `pnpm --filter @appstore-price-radar/worker add -D @cloudflare/vitest-pool-workers` — if Worker runtime integration tests are needed

## Sources

### Primary (HIGH confidence)
- https://developers.cloudflare.com/queues/reference/delivery-guarantees/ - at-least-once semantics and duplicate-delivery expectation.
- https://developers.cloudflare.com/queues/configuration/javascript-apis/ - producer/consumer APIs (`send`, `ack`, `retry`, delay bounds, attempts/id metadata).
- https://developers.cloudflare.com/queues/configuration/configure-queues/ - `max_batch_*`, `max_retries`, `dead_letter_queue`, `max_concurrency` configuration.
- https://developers.cloudflare.com/queues/configuration/batching-retries/ - per-message retry semantics and exponential backoff examples.
- https://developers.cloudflare.com/queues/configuration/dead-letter-queues/ - DLQ behavior and retry exhaustion flow.
- https://developers.cloudflare.com/queues/configuration/consumer-concurrency/ - autoscaling and concurrency tuning behavior.
- https://developers.cloudflare.com/queues/platform/limits/ - queue retention and retry limits (including max retries).
- https://developers.cloudflare.com/workers/configuration/cron-triggers/ - UTC scheduling and propagation delay behavior.
- https://performance-partners.apple.com/search-api - Apple Search API guidance (including approximate request rate limit and caching guidance).
- https://orm.drizzle.team/docs/insert - conflict-handling patterns (`onConflictDoNothing`, `onConflictDoUpdate`) for idempotent writes.
- https://router.vuejs.org/guide/essentials/dynamic-matching.html - dynamic route pattern for `/apps/:appId`.
- https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/write-your-first-test/ - Worker testing guidance and version compatibility note.
- npm registry metadata via `npm view <package> version time --json` (run 2026-03-18) - current package versions and publish dates.

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - established by official platform/library docs and existing repo baseline.
- Architecture: **MEDIUM** - solid technical fit, but queue topology choice (single vs multi) depends on near-term scale assumptions.
- Pitfalls: **HIGH** - directly supported by Cloudflare queue semantics and observed current code gaps.

**Research date:** 2026-03-18  
**Valid until:** 2026-04-01 (14 days; queue/runtime/package docs are fast-moving)
