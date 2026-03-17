# App Store Price Radar

## What This Is

App Store Price Radar is a Cloudflare Worker based platform for tracking Apple App Store price movements and notifying users when prices drop. Users can authenticate, create country-specific watch subscriptions for app IDs, and review historical pricing trends. The product targets price-sensitive users who want timely, low-friction alerts instead of manually checking App Store listings.

## Core Value

Users never miss meaningful App Store price drops for the apps they care about.

## Requirements

### Validated

- [x] Email/password auth, login-code auth, and session-backed identity endpoints are implemented and reachable.
- [x] Password reset and authenticated password change flows are implemented end-to-end.
- [x] Per-user subscription CRUD exists for `(appId, country)` watches with optional target price thresholds.
- [x] Historical price querying exists per app and country, including bounded history limits.
- [x] Public "recent drops" feed exists with country filtering and optional deduplication.
- [x] Scheduled and manual price-check jobs exist, including iTunes lookup integration and DB persistence.
- [x] Price-drop email alert delivery exists through Resend.
- [x] Web UI exists for auth, profile dashboard, subscription management, history viewing, and account security.

### Active

- [ ] Improve checker reliability under upstream API instability (timeouts, retry strategy, failure visibility).
- [ ] Add stronger observability for operations (job health, alert success/failure, and anomaly diagnostics).
- [ ] Expand subscription controls (better threshold ergonomics, bulk operations, and clearer watch-state UX).
- [ ] Improve notification flexibility (user-level cadence controls and multi-channel roadmap readiness).
- [ ] Harden security and abuse controls for auth and alert-trigger endpoints.

### Out of Scope

- Android/Google Play price tracking in this milestone - keep scope tightly focused on Apple App Store value.
- Native iOS/Android apps in this milestone - web-first delivery is sufficient for current users.
- Payments/monetization in this milestone - validate product reliability and retention before billing complexity.
- Social/community features in this milestone - not required for the core monitoring and alerting loop.

## Context

The repository is a PNPM monorepo with two applications:
- `apps/worker`: Cloudflare Worker + Hono API, scheduled jobs, Drizzle ORM, Neon Postgres integration, Resend mail integration.
- `apps/web`: Vue 3 + Vite + Tailwind CSS interface for public feed, auth, dashboard, history, and security screens.

Existing documentation and code indicate this project is already past proof-of-concept and operating as a brownfield system. Current planning should preserve shipped capabilities while defining a production-hardening and growth-ready milestone. Deployment is split across Cloudflare Workers (API/jobs) and Netlify (SPA frontend), with environment-variable based runtime configuration.

## Constraints

- **Tech stack**: Keep Cloudflare Worker + Hono + Drizzle + Neon + Vue/Vite - avoids migration overhead and aligns with existing deployment.
- **Data source dependency**: iTunes/App Store lookup behavior is external and can be unstable - checker design must tolerate transient failures.
- **Notification dependency**: Email alerts depend on Resend reliability and sender configuration - monitoring must expose delivery failures.
- **Security baseline**: Auth/session/token flows already exist and must remain backward compatible - regressions here are high impact.
- **Operational simplicity**: Favor solutions that can be maintained by a small team without heavy ops burden.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Initialize as a brownfield project and preserve validated capabilities | Existing code already delivers real user-facing value; planning should extend, not restart | — Pending |
| Keep current infrastructure architecture (Cloudflare Worker + Neon + Netlify) | Matches current deployment and team familiarity; lowers delivery risk | ✓ Good |
| Commit `.planning/` docs to git | Preserves planning lineage and improves cross-session continuity | — Pending |
| Use YOLO mode with research, plan-check, and verifier enabled | Maintains velocity while reducing blind spots in roadmap and execution quality | — Pending |

---
*Last updated: 2026-03-17 after initialization*
