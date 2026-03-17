# Feature Research

**Domain:** App Store price monitoring and alerting platform (brownfield expansion)
**Researched:** 2026-03-17
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Watch subscriptions by `app + country + target price` | Core expectation for this category; both AppRaven and AppWish center on per-app tracking and price alerts. | MEDIUM | Existing capability is present; expand with better threshold ergonomics and validation. |
| Price history with clear drop context | Users expect to see trend/volatility before acting; AppWish emphasizes historical charts. | MEDIUM | Keep bounded history for cost control, but show meaningful windows (7d/30d/90d/all available). |
| Configurable alerts (per-watch enable/disable, cadence, quiet windows) | Competitors expose notification settings and active-alert management; users expect control over alert noise. | MEDIUM | Immediate + digest modes are baseline by 2026 for retention without fatigue. |
| Low-friction list management (share/import from App Store, folders/tags, bulk actions) | Watchlists grow quickly; AppRaven supports share-extension adds, AppWish highlights bulk cleanup/merge. | MEDIUM | Essential for serious users with dozens/hundreds of watches. |
| Reliable check pipeline (retry/backoff + failure visibility) | Price trackers are only useful if checks run consistently despite upstream/API instability. | HIGH | Use queue retries + dead-letter handling for failed checks; expose job health to operators. |
| Reliable notification delivery (idempotency + delivery status capture) | Duplicate or silently failed alerts destroy trust; users expect alerts to be accurate and auditable. | HIGH | Idempotency keys and webhook-based delivery tracking are baseline for dependable email alerts. |
| Trust baseline: transparent privacy and data handling | App Store users now compare privacy labels and expect policy clarity. | LOW | Must keep privacy disclosures, policy links, and data-use explanations explicit in-product. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unified tracking beyond app base price (IAP sales, app updates, preorder/open events) | Turns tracker from "single-price alarm" into a complete purchase-intelligence feed. | HIGH | AppRaven highlights IAP + update tracking; this is meaningful differentiation if executed reliably. |
| Intelligent alert routing (channel fallback + priority rules) | Improves delivery confidence: if one channel fails/throttles, user still gets critical drops. | HIGH | Start with email + future-ready hooks for push/webhook/SMS adapter layer. |
| Explainable alerts ("why you got this", "last checked", source country, delta) | Increases trust and reduces support load by making alert decisions auditable for users. | MEDIUM | Pair with per-alert event timeline (detected -> queued -> delivered/failed). |
| Smart recommendations (buy-now/wait signal based on historical sale frequency) | Helps users decide, not just observe; increases stickiness versus plain trackers. | HIGH | Requires enough historical data quality and confidence thresholds to avoid misleading guidance. |
| Privacy-first mode (minimal retention/no behavioral tracking) | Trust differentiator in a category where some competitors disclose tracking-linked data. | MEDIUM | Offer clear data-minimization guarantees and optional telemetry opt-out. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Real-time" minute-level polling for all watched apps | Users want instant alerts. | Upstream constraints and platform cost make this brittle; iTunes Search API guidance includes request-rate limits, so aggressive global polling risks throttling/failures. | Tiered polling based on watch priority and historical sale windows; burst checks only when deltas detected. |
| Alert on every micro-change across all channels | Sounds comprehensive. | Creates notification fatigue, unsubscribes, and perceived spam. | Default minimum-delta + dedupe windows + digest mode with user-tunable sensitivity. |
| Early expansion to non-Apple stores in same milestone | Feels like easy TAM expansion. | Dilutes reliability work and multiplies data-source edge cases before Apple pipeline is hardened. | Keep Apple-first until SLOs and trust metrics are stable. |
| Heavy social/community feature set in reliability milestone | Can look like engagement leverage. | Pulls engineering away from checker/notification correctness, which is the retention driver for this category. | Lightweight share links and public "recent drops" feed; defer full social graph mechanics. |

## Feature Dependencies

```text
App catalog ingestion (country-aware)
    └──requires──> Normalized price snapshots
                       └──requires──> Change detection engine
                                          └──requires──> Notification dispatch
                                                             └──requires──> Delivery telemetry (webhooks/events)

Watch subscriptions (app/country/threshold)
    └──enables──> Alert personalization (cadence/quiet hours/channels)

List management (tags/folders/bulk edit)
    └──enhances──> Subscription scalability for power users

Explainable alerts
    └──requires──> Change detection metadata + delivery telemetry

Smart recommendations
    └──requires──> Sufficient clean historical data + confidence scoring

Real-time global polling ──conflicts──> Reliability/cost constraints
```

### Dependency Notes

- **Change detection requires normalized snapshots:** without stable `(appId, country, price, timestamp)` records, alerts are noisy and non-deterministic.
- **Alert personalization requires baseline subscriptions:** cadence and quiet-hour logic are irrelevant until watch entities are consistent and user-scoped.
- **Explainability requires event telemetry:** users cannot trust alerts if system cannot surface detection/delivery trail.
- **Smart recommendations require high data quality:** recommendation logic before historical depth creates false confidence and churn.
- **Real-time global polling conflicts with reliability goals:** aggressive polling increases failure rates under upstream limits and hurts operator control.

## MVP Definition

### Launch With (v1)

Minimum viable product for this subsequent milestone: reliability + control + trust.

- [x] Watch subscriptions by app/country/target price with improved threshold UX.
- [x] Price history and recent-drop context in dashboard/public feed.
- [ ] Reliable checker with retries, DLQ handling, and operator-visible failure states.
- [ ] Notification controls (immediate vs digest, per-watch toggle, quiet hours).
- [ ] Delivery trust surface (last checked + alert status timeline).

### Add After Validation (v1.x)

- [ ] Bulk watch operations (mass edit thresholds, pause/resume groups) — add once reliability telemetry stabilizes.
- [ ] Intelligent channel fallback for alerts — add after first channel SLOs are established.
- [ ] Privacy-first controls (telemetry opt-out, retention controls) — add after baseline observability is in place.

### Future Consideration (v2+)

- [ ] Smart buy/wait recommendations — defer until historical data confidence is validated.
- [ ] Expanded tracking surface (IAP depth and preorder/open event intelligence) — defer until parser quality and coverage are proven.
- [ ] Cross-store support (Google Play, etc.) — defer until Apple pipeline is operationally mature.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Reliable check pipeline with retries + visibility | HIGH | HIGH | P1 |
| Alert controls (cadence/quiet/per-watch) | HIGH | MEDIUM | P1 |
| Delivery telemetry + explainable alerts | HIGH | MEDIUM | P1 |
| Bulk subscription management | MEDIUM | MEDIUM | P2 |
| Intelligent channel fallback | MEDIUM | HIGH | P2 |
| Privacy-first mode | MEDIUM | MEDIUM | P2 |
| Smart buy/wait recommendations | MEDIUM | HIGH | P3 |
| Expanded IAP/preorder intelligence | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when feasible
- P3: Defer until core reliability/trust loop is stable

## Competitor Feature Analysis

| Feature | AppRaven | AppWish | Recommended Approach |
|---------|----------|---------|----------------------|
| App + country watch tracking | Yes (wishlist and country-specific behavior) | Yes (wishlist tracking and compare) | Keep as baseline; optimize UX and performance for large watchlists. |
| Price alerts | Yes (notification setup) | Yes (active alerts and notification controls) | Keep immediate alerts + add digest/quiet controls to reduce fatigue. |
| Price history context | Implicit via deal tracking | Explicit price chart/history emphasis | Maintain history as table-stakes and improve interpretability (delta + last checked). |
| List management ergonomics | Share extension + organization concepts | Bulk cleanup/merge improvements in recent releases | Prioritize bulk operations and grouping for retention. |
| Broader intelligence layer | Tracks app updates and IAP sales | Focused on wishlist/price compare simplicity | Differentiate with explainable, trustworthy intelligence rather than social-heavy scope. |
| Privacy posture visibility | Shows data linked/tracking labels in App Store privacy section | Shows "data not collected" label | Treat transparent data handling as a product feature, not a compliance afterthought. |

## Sources

- AppRaven (App Store listing, feature claims + privacy labels): https://apps.apple.com/us/app/appraven-apps-gone-free/id1490607195 (HIGH)
- AppWish (App Store listing, feature set + release-note ergonomics + privacy labels): https://apps.apple.com/us/app/appwish-wishlist-compare-price/id6746433242 (HIGH)
- Price Notify update article (category expectations for tracking + local notifications; secondary source): https://nextool.ai/price-notify-track-app-prices-in-app-store/ (LOW)
- Apple iTunes Search API docs (country parameter + request-rate guidance): https://performance-partners.apple.com/resources/documentation/itunes-store-web-service-search-api/ (HIGH)
- Cloudflare Queues retry docs: https://developers.cloudflare.com/queues/configuration/batching-retries/ (HIGH)
- Cloudflare Queues dead-letter queues docs: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/ (HIGH)
- Resend webhooks docs (delivery status telemetry): https://resend.com/docs/dashboard/webhooks/introduction (HIGH)
- Resend idempotency keys docs (dedupe/notification correctness): https://resend.com/docs/dashboard/emails/idempotency-keys (HIGH)
- Apple App Privacy Details requirements: https://developer.apple.com/app-store/app-privacy-details/ (HIGH)
- Apple App Review Guidelines (privacy/policy expectations): https://developer.apple.com/app-store/review/guidelines/ (HIGH)

---
*Feature research for: App Store price monitoring and alerting*
*Researched: 2026-03-17*
