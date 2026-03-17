# Pitfalls Research

**Domain:** App Store price monitoring and alerting platform (brownfield hardening)
**Researched:** 2026-03-17
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Treating Apple lookup data as unlimited and real-time

**What goes wrong:**
Checker jobs intermittently fail, get throttled, or return inconsistent coverage. Users see missed drops and stale data.

**Why it happens:**
Teams model upstream lookup as a stable internal dependency and skip budgeting for rate limits, caching, and transient failures.

**How to avoid:**
- Build an explicit ingest contract for Apple lookup responses (fields, nullability, fallback behavior).
- Enforce adaptive rate limiting and jittered backoff at the worker layer.
- Batch watches by storefront and app ID to reduce duplicate upstream calls.
- Add staleness SLOs (for example: "95% of active watches refreshed in <= 6h") and alert when breached.

**Warning signs:**
- Sudden spikes in lookup timeouts or 429-like behavior.
- Increasing gap between "scheduled checks executed" and "watches refreshed."
- Large day-over-day variance in updated watch counts with no traffic change.

**Phase to address:**
Phase 1 - Ingestion reliability hardening

---

### Pitfall 2: Ignoring storefront and effective-time semantics

**What goes wrong:**
The system emits false "price drop" alerts because it assumes global, immediate price changes. Users receive contradictory alerts across countries and lose trust.

**Why it happens:**
Developers normalize too early to a single global price model and ignore country-specific start times, local taxes, and App Store propagation delays.

**How to avoid:**
- Store prices per `(appId, storefront, currency)` as first-class records.
- Delay alert emission until a price is observed stable across two consecutive checks (or a configured confirmation window).
- Show storefront and observation timestamp in every alert and dashboard event.
- Build a "price transition" state machine (`pending -> confirmed -> alerted`) to absorb temporary inconsistencies.

**Warning signs:**
- Same app triggers repeated drop/rebound alerts within hours.
- Support reports: "I still see old price in my App Store."
- High variance in price state by storefront immediately after updates.

**Phase to address:**
Phase 2 - Price normalization and trustable change detection

---

### Pitfall 3: Using floating-point math for money thresholds

**What goes wrong:**
Threshold alerts fire incorrectly around boundary values (for example, 0.99 vs 1.00). History comparisons drift over time.

**Why it happens:**
Money is stored as floating-point values and compared without integer-minor-unit normalization.

**How to avoid:**
- Store `amount_minor` (integer) plus ISO currency code, or use exact `numeric` types end-to-end.
- Centralize comparison logic in one tested library/module (no ad hoc per-endpoint math).
- Add invariant tests around threshold boundaries and currency conversions.

**Warning signs:**
- Intermittent off-by-one-cent alerts.
- Manual recalculation from raw rows disagrees with emitted alerts.
- Same threshold behaves differently across code paths.

**Phase to address:**
Phase 2 - Price normalization and trustable change detection

---

### Pitfall 4: Non-idempotent check and alert pipeline

**What goes wrong:**
Retries or overlapping jobs create duplicate history rows and duplicate notifications. Users unsubscribe due to alert spam.

**Why it happens:**
No idempotency key strategy across check runs, persistence, and notification dispatch. Retries are treated as fresh events.

**How to avoid:**
- Define deterministic idempotency keys: `(appId, storefront, observed_price, observed_at_bucket)`.
- Enforce unique constraints on history and outbound alert events.
- Decouple detection from delivery using a durable queue/event table with explicit states.
- Make all webhook/event handlers idempotent by default.

**Warning signs:**
- Duplicate alerts with same app/storefront/price in short windows.
- Replayed jobs increase notification counts disproportionately.
- Manual dedupe scripts become recurring operational work.

**Phase to address:**
Phase 3 - Idempotent alert orchestration and user cadence controls

---

### Pitfall 5: Assuming scheduler execution equals successful coverage

**What goes wrong:**
Cron appears "healthy" while portions of the watch graph are never checked (silent partial failure). Reliability degrades unnoticed.

**Why it happens:**
Monitoring tracks only trigger execution, not completeness, freshness, and failure budgets per shard/storefront.

**How to avoid:**
- Track and alert on coverage metrics: `% watches checked`, `% failed`, and max staleness by storefront.
- Add dead-man switch alerts when expected result volume drops below baseline.
- Partition jobs into deterministic shards and persist per-shard checkpoints.
- Add run books for backfill and replay after outage windows.

**Warning signs:**
- "Cron fired" logs exist but refreshed row counts are far below normal.
- One storefront repeatedly lags while others remain current.
- Incidents are discovered by user complaints, not internal alerts.

**Phase to address:**
Phase 4 - Observability and operational recovery

---

### Pitfall 6: Treating "email accepted" as "alert delivered"

**What goes wrong:**
Platform reports successful alerts while users never receive messages (bounce, suppression, domain/reputation issues).

**Why it happens:**
Delivery lifecycle events are not reconciled back into product state; send API response is treated as terminal truth.

**How to avoid:**
- Ingest Resend webhook events (`delivered`, `bounced`, `complained`, etc.) with signature verification.
- Maintain per-user/channel deliverability state and suppression reason.
- Add automatic fallback behavior (digest, in-app notification, or retry policy) when primary channel is degraded.
- Expose delivery status in user-facing history to preserve trust.

**Warning signs:**
- Rising "sent" counts with flat or falling "delivered" counts.
- Repeated support tickets about missing alerts despite internal "success."
- Growing suppressed recipient list without remediation flows.

**Phase to address:**
Phase 4 - Observability and operational recovery

---

### Pitfall 7: No abuse controls on watch and auth-related endpoints

**What goes wrong:**
Attackers automate account creation, watch spam, and email-trigger abuse, causing cost spikes and sender reputation damage.

**Why it happens:**
Growth-focused teams defer rate limiting, verification, and anomaly controls until after abuse appears.

**How to avoid:**
- Enforce per-IP and per-account limits for login, signup, password reset, and watch creation.
- Add bot/friction controls on high-abuse surfaces (progressive challenges, cooldowns).
- Gate high-volume watch operations with explicit quotas and abuse scoring.
- Monitor and auto-block outlier patterns (watch churn bursts, repeated reset requests, disposable domains).

**Warning signs:**
- Sudden spikes in new accounts with low engagement and high watch counts.
- Password reset volume outpaces active user growth.
- Email bounce/complaint rates increase after traffic bursts.

**Phase to address:**
Phase 5 - Security and abuse hardening

---

### Pitfall 8: Missing alert explainability and audit trail

**What goes wrong:**
Users cannot verify why an alert fired, and the team cannot quickly root-cause false positives. Trust erodes and support load increases.

**Why it happens:**
Alert payloads omit provenance (source timestamp, prior price, storefront, detection rule version) and event lineage.

**How to avoid:**
- Persist alert decision records with full provenance: previous snapshot, current snapshot, rule version, and job run ID.
- Show "why this alert" in UI/email (old price -> new price, store, check time).
- Keep immutable audit logs for alert lifecycle (`detected`, `queued`, `sent`, `delivered/failed`).
- Include operator tooling for one-click trace from user complaint to raw source event.

**Warning signs:**
- Support must query raw DB tables manually for every complaint.
- Multiple plausible root causes exist with no definitive trace.
- Teams disable alerts "temporarily" due to low confidence in correctness.

**Phase to address:**
Phase 3 - Idempotent alert orchestration and user cadence controls

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single monolithic cron job for all watches | Fast to ship | Partial failures are hard to isolate; reruns duplicate work | MVP only, <= 1k watches, with clear deprecation date |
| Inline email send during detection | Simpler control flow | Backpressure couples detection with deliverability; incident blast radius widens | Never for production reliability |
| "Latest price only" table without immutable history | Less storage and simpler schema | No auditability, impossible to explain alerts or replay logic safely | Never for trust-critical alerts |
| Per-endpoint ad hoc threshold logic | Local speed | Drift between API/UI/email behavior and subtle false alerts | Never; centralize rule engine early |
| Store money in float columns | Easy plumbing | Boundary bugs and trust loss from inconsistent alerts | Never |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Apple iTunes Search/Lookup API | Ignoring lookup pacing/caching guidance and default-country behavior | Use storefront-explicit queries, throttle aggressively, and cache predictable reads |
| App Store pricing behavior | Assuming one global effective time for price changes | Model per-storefront propagation windows and confirm transitions before alerting |
| Cloudflare Cron Triggers | Assuming immediate schedule changes and local-time execution | Plan for propagation delay and run all schedules in UTC with explicit conversion in UI |
| Cloudflare Worker runtime | Treating CPU/memory/time limits as infinite during check spikes | Bound per-run work, shard runs, and apply queue-based fan-out for burst control |
| Resend webhooks | Not verifying signatures or handling retries idempotently | Verify every webhook, persist event IDs, and dedupe replayed events |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 upstream lookups per watch | Long runtimes, timeout spikes, high upstream error rate | Batch by app/storefront and reuse snapshots across subscribers | Typically >5k-10k active watches |
| Unbounded history scans for dashboard and feeds | Slow page/API response, DB CPU spikes | Precompute recent-drop materialized views and add bounded indexes | Usually >1M price rows |
| Sync send for each alert in hot path | Checker backlog grows during email provider slowness | Queue dispatch with worker concurrency caps and retry budget | Noticeable at >100 alerts/min burst |
| No shard checkpoints for scheduled jobs | Full reruns after failure and duplicate processing | Persist per-shard cursors and resume tokens | Any non-trivial scale; painful after first incident |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Missing quota controls on watch creation | Resource exhaustion, provider cost spikes, abuse amplification | Enforce per-plan quotas, velocity limits, and anomaly detection |
| No signature verification on email webhooks | Forged delivery events, false trust metrics, broken suppression handling | Verify webhook signatures and reject unsigned/invalid payloads |
| Weak controls on password reset/login endpoints | Credential-stuffing and account takeover pressure | Add IP/account throttles, lockouts, and suspicious activity monitoring |
| Logging raw email and sensitive event payloads broadly | Privacy and compliance exposure, incident blast radius | Minimize PII in logs, redact by default, enforce retention bounds |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Alerts without storefront/currency context | Users cannot verify whether alert applies to them | Always include country, currency, and observed time in alert copy |
| No cadence or cooldown controls | Notification fatigue and churn | Add digest/immediate options, quiet windows, and minimum resend interval |
| No explanation of price source freshness | Users interpret stale data as bug or deception | Show "last checked" and confidence state (fresh/stale/degraded) |
| Hidden suppression/delivery failures | Users think system is broken and stop trusting product | Surface channel health and remediation actions in account settings |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Scheduled checks:** Often missing coverage and staleness SLOs - verify per-storefront freshness dashboards and dead-man alerts exist.
- [ ] **Price-drop alerts:** Often missing idempotency guarantees - verify duplicate-resistant keys and unique constraints are enforced.
- [ ] **Email notifications:** Often missing delivery reconciliation - verify webhook-driven status updates are persisted and visible.
- [ ] **Threshold logic:** Often missing currency-safe comparisons - verify integer/numeric money model and boundary tests.
- [ ] **Security hardening:** Often missing abuse telemetry - verify rate-limit metrics and block actions are observable.
- [ ] **User trust loop:** Often missing explainability - verify every alert links to a provenance record in UI/support tooling.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate alert storm | MEDIUM | Pause dispatch queue, apply idempotency hotfix, dedupe pending events, send user apology/in-product notice |
| False drop detection after upstream inconsistency | MEDIUM | Mark affected events as suspect, re-run confirmation checks, invalidate incorrect alerts, publish incident note |
| Missed checks due silent scheduler degradation | HIGH | Backfill by shard with checkpoint replay, temporarily increase run frequency, validate freshness SLO recovery |
| Deliverability collapse (bounces/suppression) | HIGH | Pause new sends to affected cohort, process webhook backlog, clean recipient quality, warm sender reputation cautiously |
| Abuse-driven cost spike | HIGH | Activate emergency rate limits/quotas, challenge suspicious flows, block abusive cohorts, rotate exposed keys if needed |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Apple lookup treated as unlimited/real-time | Phase 1 - Ingestion reliability hardening | 30-day trend shows stable coverage SLO and bounded upstream error budget |
| Storefront/effective-time semantics ignored | Phase 2 - Price normalization and trustable change detection | False-positive rate drops; cross-storefront inconsistencies are tracked and explained |
| Float-based money thresholds | Phase 2 - Price normalization and trustable change detection | Boundary test suite passes; no precision-related incidents in release window |
| Non-idempotent pipeline | Phase 3 - Idempotent alert orchestration and user cadence controls | Duplicate alert rate remains below defined SLO during retries/replays |
| Scheduler "green" but low coverage | Phase 4 - Observability and operational recovery | Dashboards expose completeness; dead-man alert fires in synthetic failure test |
| Send != delivered blind spot | Phase 4 - Observability and operational recovery | Sent/delivered/bounce funnel is measurable and reconciled to user-visible history |
| Abuse on auth/watch endpoints | Phase 5 - Security and abuse hardening | Automated abuse attempts are throttled; operational cost and complaint rates stabilize |
| Missing alert explainability | Phase 3 - Idempotent alert orchestration and user cadence controls | Support can trace any alert to source event in <5 minutes |

## Sources

- Apple iTunes Search API (official): https://performance-partners.apple.com/resources/documentation/itunes-store-web-service-search-api/ (HIGH)
- Apple App Store Connect pricing start times by country/region (official): https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price-for-an-app#start-times-by-country-or-region (HIGH)
- Apple App Store Connect "Set a price for an app" (official): https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price-for-an-app (HIGH)
- Apple Developer News: pricing/tax/fx adjustments (official): https://developer.apple.com/news/?id=ef7g3c4f (HIGH)
- Cloudflare Workers Cron Triggers (official): https://developers.cloudflare.com/workers/configuration/cron-triggers/ (HIGH)
- Cloudflare Workers platform limits (official): https://developers.cloudflare.com/workers/platform/limits/ (HIGH)
- Cloudflare Durable Objects alarms semantics (official): https://developers.cloudflare.com/durable-objects/api/alarms/ (HIGH)
- Resend webhooks introduction (official): https://resend.com/docs/dashboard/webhooks/introduction (HIGH)
- Resend webhook retries/replays (official): https://resend.com/docs/dashboard/webhooks/retries-and-replays (HIGH)
- Resend webhook event types (official): https://resend.com/docs/dashboard/webhooks/event-types (HIGH)
- Resend webhook signature verification (official): https://resend.com/docs/dashboard/webhooks/verify-signatures (HIGH)
- PostgreSQL exact numeric types for money-safe storage (official): https://www.postgresql.org/docs/current/datatype-numeric.html (HIGH)

---
*Pitfalls research for: App Store price monitoring and alerting platform*
*Researched: 2026-03-17*
