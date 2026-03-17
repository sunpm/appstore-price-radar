# Roadmap: App Store Price Radar

## Overview

This milestone hardens the existing monitor-to-alert loop so users can trust that drops are detected accurately, delivered reliably, and operated safely at growing scale. Phase order follows the system dependency chain: resilient ingestion first, then detection correctness, then alert orchestration, then operational closure, and finally abuse/scale UX hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Ingestion Reliability Backbone** - Replace monolithic checks with shardable, replay-safe ingestion.
- [ ] **Phase 2: Price Semantics and Detection Correctness** - Make price storage and drop detection storefront-correct and auditable.
- [ ] **Phase 3: Idempotent Alert Orchestration and User Controls** - Deliver explainable, configurable alerts without duplicates.
- [ ] **Phase 4: Observability and Operational Recovery** - Expose health truth and make outage recovery executable.
- [ ] **Phase 5: Security, Abuse Hardening, and Scale UX** - Protect auth and watch operations while enabling bulk workflows.

## Phase Details

### Phase 1: Ingestion Reliability Backbone
**Goal**: Price checks run through a deduplicated, shardable, replayable ingestion pipeline that remains reliable under upstream instability.
**Depends on**: Nothing (first phase)
**Requirements**: ING-01, ING-02, ING-03, ING-04
**Success Criteria** (what must be TRUE):
  1. Operators can schedule due checks as deduplicated shardable work units instead of one monolithic run.
  2. Transient upstream lookup failures are retried automatically with bounded backoff before being marked failed.
  3. Failed check jobs are visible in a dead-letter flow with enough context to replay specific failures.
  4. Operators can replay missed or failed check windows and verify no duplicate downstream side effects.
**Plans**: TBD

### Phase 2: Price Semantics and Detection Correctness
**Goal**: Drop detection is money-accurate, storefront-aware, and consistent across checker, API, and alert generation paths.
**Depends on**: Phase 1
**Requirements**: PRIC-01, PRIC-02, PRIC-03, PRIC-04
**Success Criteria** (what must be TRUE):
  1. Users and operators see exact, non-drifting price values per app and storefront across history and alerts.
  2. Drop alerts are emitted only after storefront-aware confirmation, preventing transient propagation false positives.
  3. Threshold decisions are consistent across checker outcomes, API responses, and generated alerts.
  4. Every detected drop exposes provenance: previous price, new price, storefront, observation time, and rule version.
**Plans**: TBD

### Phase 3: Idempotent Alert Orchestration and User Controls
**Goal**: Alerts are delivered asynchronously with deterministic idempotency and user-level control over alert behavior and cadence.
**Depends on**: Phase 2
**Requirements**: ALRT-01, ALRT-02, ALRT-03, ALRT-04
**Success Criteria** (what must be TRUE):
  1. Users receive at most one alert per qualifying drop event even when queue retries or duplicate dispatch attempts happen.
  2. Users can configure per-watch alert behavior: enable/disable, immediate vs digest cadence, and quiet hours.
  3. Users and operators can query each alert lifecycle from `detected` through `failed`/`delivered`.
  4. Users can open an alert and see why it fired, including storefront, price delta, and detection timestamp.
**Plans**: TBD

### Phase 4: Observability and Operational Recovery
**Goal**: Operators can see true end-to-end system health and execute repeatable recovery for ingestion or delivery incidents.
**Depends on**: Phase 3
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Operators can observe coverage/freshness metrics including `% watches checked`, max staleness, and failed checks by storefront.
  2. The system emits dead-man alerts when expected check/update volume drops below baseline.
  3. Delivery status transitions to final outcomes using signature-verified webhook reconciliation.
  4. Operators can follow documented replay/backfill procedures and restore expected freshness after outage scenarios.
**Plans**: TBD

### Phase 5: Security, Abuse Hardening, and Scale UX
**Goal**: High-risk endpoints are abuse-resilient while legitimate power users can manage large watch lists efficiently.
**Depends on**: Phase 4
**Requirements**: ABUS-01, ABUS-02, ABUS-03, MNG-01
**Success Criteria** (what must be TRUE):
  1. Auth abuse attempts trigger rate limits and cooldown behavior without breaking normal account flows.
  2. Excessive watch creation and bulk-edit bursts are constrained by quotas and velocity limits with clear user feedback.
  3. Abnormal automation patterns are detected and mitigated before they create sustained spam or cost spikes.
  4. Users can bulk pause/resume selected watches and apply threshold updates in one operation.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ingestion Reliability Backbone | 0/TBD | Not started | - |
| 2. Price Semantics and Detection Correctness | 0/TBD | Not started | - |
| 3. Idempotent Alert Orchestration and User Controls | 0/TBD | Not started | - |
| 4. Observability and Operational Recovery | 0/TBD | Not started | - |
| 5. Security, Abuse Hardening, and Scale UX | 0/TBD | Not started | - |
