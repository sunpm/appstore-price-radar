# Project Research Summary

**Project:** App Store Price Radar
**Domain:** App Store price monitoring and alerting platform (brownfield hardening)
**Researched:** 2026-03-17
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a reliability-critical alerting product: users expect accurate, timely, and explainable notifications for App Store price drops by app and country. Research converges on a clear implementation pattern used by mature teams in 2026: keep synchronous API endpoints thin, move price checking and alert fan-out into queue-backed asynchronous workers, and make every side effect idempotent because upstream APIs and queues are inherently unstable or at-least-once.

The recommended approach is to harden the existing Cloudflare Worker + Hono + Neon + Drizzle + Vue stack instead of introducing new infrastructure. The highest-leverage move is a staged pipeline: `scheduler/planner -> price-check queue -> drop events -> alert queue -> webhook reconciliation`, with typed contracts, deterministic idempotency keys, and observability tied to coverage/freshness SLOs. This preserves shipped functionality while reducing the current failure modes that most directly impact user trust and retention.

Key risks are upstream Apple lookup instability, storefront-specific price propagation semantics, duplicate/non-auditable alerts, and blind spots where "job triggered" or "email accepted" is mistaken for real success. Mitigation is explicit: shard and pace ingestion, normalize money/storefront semantics before detection, verify and ingest delivery webhooks, and expose an end-to-end alert provenance trail (`detected -> queued -> sent -> delivered/failed`) to both users and operators.

## Key Findings

### Recommended Stack

Research strongly favors continuing with the current platform and upgrading within the same ecosystem. Cloudflare-native background primitives (Cron + Queues + Workflows) and Neon/Drizzle remain the best fit for edge execution constraints and operational simplicity. The stack recommendation is evolutionary, not transformational: harden runtime behavior, instrumentation, and contracts first, then scale by sharding and projection tuning.

Critical version guidance is explicit: keep Workers/Wrangler current, move to Zod 4, and treat Vite 8 + plugin-vue 6 + Vitest 4 as a coordinated upgrade set. This avoids drift while reducing future migration risk.

**Core technologies:**
- `Cloudflare Workers + Cron + Queues + Workflows` (Wrangler `4.74.x`): runtime, scheduling, durable async orchestration - lowest-ops path with proven resilience patterns.
- `Hono 4.12.x`: API routing/middleware on Workers - keeps current code model and avoids rewrite risk.
- `Neon Postgres + @neondatabase/serverless 1.0.x`: transactional source of truth - edge-compatible connectivity with mature relational guarantees.
- `Drizzle ORM 0.45.x + Drizzle Kit 0.31.x`: schema + migration discipline - reduces contract drift and improves debugging of pricing correctness.
- `Resend 6.9.x`: alert delivery + webhook telemetry - supports idempotent sends and delivery-state reconciliation.
- `Vue 3.5.x + Vite 8 + Tailwind 4.2`: web UX foundation - fast iteration and stable modern tooling.
- `Zod 4.3.x + @hono/zod-validator 0.7.x`: runtime contract enforcement - essential for safe API/job/webhook boundaries.

### Expected Features

The feature research is clear on prioritization: reliability and user control are table stakes now, while intelligence and expansion are deferrable. Competitor baselines require robust watch management, history context, and practical notification controls; differentiation should come from explainability and trust, not from broadening scope too early.

**Must have (table stakes):**
- Reliable watch subscriptions by `app + country + threshold` with strong validation and better threshold ergonomics.
- Price history and recent-drop context with meaningful windows (7d/30d/90d/all available).
- Reliable checker pipeline (retry/backoff, DLQ, failure visibility) and reliable notification delivery (idempotency + status tracking).
- Alert controls (per-watch enable/disable, cadence, quiet windows) to prevent fatigue and churn.
- Trust baseline in-product (privacy/data-handling clarity, last-checked visibility).

**Should have (competitive):**
- Explainable alerts ("why this fired", storefront, delta, observation time, lifecycle status).
- Bulk list/watch operations for power users (group pause/resume, mass threshold edits).
- Intelligent channel routing/fallback once baseline delivery SLOs are stable.
- Privacy-first controls (telemetry opt-out and retention controls) after baseline observability.

**Defer (v2+):**
- Smart buy-now/wait recommendations (requires high-confidence historical depth).
- Expanded intelligence surface (IAP depth, preorder/open intelligence) beyond base price tracking.
- Cross-store support (Google Play, etc.) until Apple pipeline reliability is operationally mature.

### Architecture Approach

The architecture recommendation is a bounded-context Worker system with strict async boundaries: synchronous APIs for commands/queries, queue consumers for external fetch and notification side effects, and append-only event telemetry for auditability. The key pattern is command/query split plus idempotent event processing across all queue and webhook paths.

**Major components:**
1. `Edge API Worker` - auth, validation, subscription commands, dashboard/public-feed reads.
2. `Scheduler/Planner` - computes due `(appId, country)` checks, dedupes/shards work, enqueues messages.
3. `Price Check Consumer` - upstream fetch, normalization, snapshot/history writes, drop-event emission.
4. `Alert Consumer + Webhook Ingest` - cadence-aware sends with idempotency keys, delivery/bounce reconciliation.
5. `Data + Observability Layer` - Postgres system of record, projections/indexes, queue backlog and freshness telemetry.

### Critical Pitfalls

1. **Unbudgeted Apple lookup usage** - treat upstream as constrained; shard, cache, rate-limit, and monitor freshness SLOs.
2. **Ignoring storefront/effective-time semantics** - model price per storefront/currency and require confirmation windows before alerting.
3. **Float money comparisons** - use integer minor units or exact numeric types and centralize threshold logic.
4. **Non-idempotent pipeline** - enforce deterministic keys and unique constraints across checks, events, and notification sends.
5. **False-success observability** - monitor coverage/staleness and delivery outcomes, not just cron triggers or send API acceptance.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Ingestion Reliability Backbone
**Rationale:** Highest dependency unlock; all downstream trust features require consistent, paced, and observable check ingestion.
**Delivers:** Queue-backed `planner -> price-check consumer` flow, retry/backoff/DLQ, deterministic sharding, and baseline freshness metrics.
**Addresses:** Reliable check pipeline (P1), foundation for failure visibility.
**Avoids:** Apple-rate-limit failures, monolithic cron partial-failure traps, silent coverage degradation.

### Phase 2: Price Semantics and Detection Correctness
**Rationale:** Detection accuracy must be fixed before adding more user-facing alert controls.
**Delivers:** Money normalization (`amount_minor`/numeric), storefront-aware snapshots, transition-state confirmation (`pending -> confirmed -> alerted`), boundary test suite.
**Addresses:** Trustworthy drop detection, reduced false positives, consistent threshold behavior.
**Uses:** Drizzle/Neon schema evolution and centralized rule module.
**Avoids:** Float precision bugs and storefront propagation false alerts.

### Phase 3: Idempotent Alert Orchestration and User Controls
**Rationale:** After accurate detection, optimize delivery trust and notification ergonomics.
**Delivers:** Alert-send queue, deterministic idempotency keys, per-watch cadence/quiet hours, explainable alert payloads, immutable alert lifecycle audit trail.
**Addresses:** P1 alert controls, explainability differentiator, reduced duplicate/spam incidents.
**Implements:** `checker -> notifier` contract + user-facing "why this alert" history.
**Avoids:** Duplicate alert storms, opaque support incidents, churn from alert fatigue.

### Phase 4: Observability and Operational Recovery
**Rationale:** Once pipelines run asynchronously, operations needs explicit completeness and recovery instrumentation.
**Delivers:** Coverage dashboards (`% watches checked`, max staleness by storefront), dead-man alerts, webhook reconciliation funnel (`sent/delivered/bounced`), replay/backfill runbooks.
**Addresses:** Failure visibility and delivery trust surfaces.
**Uses:** Cloudflare observability primitives and queue DLQ workflows.
**Avoids:** "Cron is green but users are stale" blind spots and send-vs-delivery confusion.

### Phase 5: Security, Abuse Hardening, and Power-User Scale UX
**Rationale:** Protect system economics and sender reputation after core trust loop is stable.
**Delivers:** Auth/watch endpoint quotas and velocity limits, anomaly controls, suppression remediation flows, bulk watch operations for large lists.
**Addresses:** Active security hardening requirements and P2 list-management competitiveness.
**Avoids:** Abuse-driven cost spikes, account/email abuse, operational noise from unbounded watch creation.

### Phase Ordering Rationale

- The order follows hard dependencies: ingestion reliability -> detection correctness -> alert orchestration -> observability closure -> abuse/scale hardening.
- Architecture boundaries align with phase cuts, minimizing cross-phase rewrites (`jobs/consumers` first, then detection semantics, then notifier/webhooks).
- Pitfall prevention is front-loaded where blast radius is largest (upstream instability and false alerts before growth features).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Apple price effective-time behavior by storefront and optimal confirmation-window tuning need empirical validation on real run data.
- **Phase 3:** Multi-channel fallback policy and deliverability remediation strategy need additional provider/policy research before implementation.
- **Phase 5:** Abuse scoring thresholds and challenge strategy should be calibrated with current traffic patterns to avoid harming legitimate users.

Phases with standard patterns (skip `research-phase`):
- **Phase 1:** Queue-backed ingestion, retry/backoff, and DLQ are well-documented Cloudflare patterns.
- **Phase 4:** Coverage/freshness SLO dashboards and webhook reconciliation pipelines are established operational practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong convergence across official Cloudflare, Neon, Drizzle, Vue, and Resend documentation; aligned with existing deployed architecture. |
| Features | MEDIUM | Table-stakes signals are clear, but some differentiator prioritization relies on competitor listing analysis and product inference. |
| Architecture | MEDIUM-HIGH | Recommended patterns are standard and dependency graph is coherent; exact split timing (single vs multi-worker) remains volume-dependent. |
| Pitfalls | MEDIUM-HIGH | Failure modes are well-supported by platform semantics and domain behavior, but thresholds/SLO targets need production calibration. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Throughput baselines missing:** Current active watch counts, burst patterns, and acceptable freshness SLO targets need measurement before final capacity settings.
- **Storefront propagation variability:** Need empirical data to set confirmation windows and avoid over/under-alerting by country.
- **Deliverability baseline unknown:** Need current resend webhook funnel metrics to size fallback and remediation logic.
- **Privacy/retention policy depth:** Data retention and telemetry opt-out product decisions are not fully specified and should be finalized during phase planning.

## Sources

### Primary (HIGH confidence)
- Cloudflare Cron Triggers, Queues, Workflows, observability, limits, and Service Bindings docs - scheduling, async semantics, retries/DLQ, instrumentation, scaling boundaries.
- Apple iTunes Search/Lookup API docs - country/storefront query behavior and pacing constraints.
- Apple App Store Connect pricing docs (including country/region start-time considerations) - effective-time semantics risk.
- Neon serverless and Cloudflare integration docs - edge-compatible Postgres connectivity and compute guidance.
- Drizzle ORM + Drizzle Zod docs - schema/migration and contract consistency patterns.
- Resend docs (idempotency keys, webhook signatures/events, retries) - reliable notification and delivery reconciliation patterns.
- PostgreSQL numeric/partitioning docs - money precision and long-term history scalability patterns.

### Secondary (MEDIUM confidence)
- AppRaven App Store listing - table-stakes and differentiator signals for watchlists, alerts, and broader app intelligence.
- AppWish App Store listing and release-note signals - expectations for list management and alert ergonomics.
- Vue, Vue Router, and Pinia docs - frontend composition and state-management implementation patterns.

### Tertiary (LOW confidence)
- Nextool article on app-price trackers - supplemental category framing only; not used for critical architecture or reliability decisions.

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
