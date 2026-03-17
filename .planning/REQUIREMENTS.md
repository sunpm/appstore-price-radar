# Requirements: App Store Price Radar

**Defined:** 2026-03-17
**Core Value:** Users never miss meaningful App Store price drops for the apps they care about.

## v1 Requirements

Requirements for the current milestone. Each requirement is specific, testable, and maps to exactly one roadmap phase.

### Ingestion Reliability

- [ ] **ING-01**: System schedules due checks as deduplicated, shardable work items instead of a single monolithic run.
- [ ] **ING-02**: Price check workers retry transient upstream failures with bounded exponential backoff.
- [ ] **ING-03**: Failed check jobs are sent to a dead-letter queue with enough context for replay.
- [ ] **ING-04**: Operators can replay failed or missed check windows without creating duplicate downstream effects.

### Price Semantics and Detection Correctness

- [ ] **PRIC-01**: Price snapshots are stored with exact money representation (integer minor units or exact numeric) per app and storefront.
- [ ] **PRIC-02**: Drop detection uses storefront-aware confirmation logic to avoid alerting on transient propagation states.
- [ ] **PRIC-03**: Threshold comparison logic is centralized and reused by checker, API responses, and alert generation.
- [ ] **PRIC-04**: Every detected drop stores provenance (previous price, new price, storefront, observation timestamp, detection rule version).

### Alert Orchestration and User Controls

- [ ] **ALRT-01**: Notification dispatch is asynchronous and idempotent, using deterministic keys to prevent duplicate alerts.
- [ ] **ALRT-02**: Users can configure per-watch alert behavior (enable/disable, immediate vs digest cadence, quiet hours).
- [ ] **ALRT-03**: Alert lifecycle states are persisted and queryable (`detected`, `queued`, `sent`, `delivered`, `failed`).
- [ ] **ALRT-04**: Users can see why an alert fired, including storefront, price delta, and detection time.

### Observability and Operations

- [ ] **OPS-01**: System exposes freshness and coverage metrics (`% watches checked`, max staleness, failed checks by storefront).
- [ ] **OPS-02**: System raises dead-man alerts when expected check/update volume falls below baseline.
- [ ] **OPS-03**: Delivery webhooks are signature-verified and reconciled into final delivery status.
- [ ] **OPS-04**: Operators have documented and executable replay/backfill procedures for outages or queue failures.

### Security, Abuse Controls, and Scale UX

- [ ] **ABUS-01**: Auth-related endpoints enforce per-IP and per-account rate limits with cooldown behavior.
- [ ] **ABUS-02**: Watch-creation and bulk-edit actions enforce account quotas and velocity limits.
- [ ] **ABUS-03**: System detects and mitigates abnormal automation patterns (account churn, reset abuse, watch spam bursts).
- [ ] **MNG-01**: Users can perform bulk watch operations (pause/resume and threshold updates) on selected subscriptions.

## v2 Requirements

Deferred to future release after v1 reliability and trust metrics are stable.

### Intelligence and Expansion

- **INTL-01**: User receives buy-now vs wait recommendation based on historical sale frequency confidence.
- **INTL-02**: System tracks additional intelligence signals (IAP pricing, preorder/open transitions) beyond base app price.
- **CHAN-01**: User can enable secondary alert channels beyond email with fallback policies.
- **MNG-02**: User can organize subscriptions with folders/tags and advanced list workflows.
- **PRIV-01**: User can control telemetry retention and opt-in/opt-out privacy preferences.

## Out of Scope

Explicit exclusions for this milestone.

| Feature | Reason |
|---------|--------|
| Google Play / multi-store support | Keep scope focused on Apple reliability and trust loop first |
| Native mobile apps | Web experience is sufficient for this milestone's outcomes |
| Full social/community mechanics | Not required for core monitor -> alert -> action value |
| Billing and subscription monetization | Defer until retention and alert reliability are proven |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ING-01 | Phase 1 | Pending |
| ING-02 | Phase 1 | Pending |
| ING-03 | Phase 1 | Pending |
| ING-04 | Phase 1 | Pending |
| PRIC-01 | Phase 2 | Pending |
| PRIC-02 | Phase 2 | Pending |
| PRIC-03 | Phase 2 | Pending |
| PRIC-04 | Phase 2 | Pending |
| ALRT-01 | Phase 3 | Pending |
| ALRT-02 | Phase 3 | Pending |
| ALRT-03 | Phase 3 | Pending |
| ALRT-04 | Phase 3 | Pending |
| OPS-01 | Phase 4 | Pending |
| OPS-02 | Phase 4 | Pending |
| OPS-03 | Phase 4 | Pending |
| OPS-04 | Phase 4 | Pending |
| ABUS-01 | Phase 5 | Pending |
| ABUS-02 | Phase 5 | Pending |
| ABUS-03 | Phase 5 | Pending |
| MNG-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✅

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
