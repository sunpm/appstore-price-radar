---
phase: 01-data-baseline-deployability
verified: 2026-03-18T07:24:57Z
status: passed
score: 6/6 must-haves verified
---

# Phase 1: 数据基线与可部署性 Verification Report

**Phase Goal:** 让新环境可以沿着单一路径完成数据库初始化、服务启动和核心 smoke path 验证。  
**Verified:** 2026-03-18T07:24:57Z  
**Status:** passed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fresh-install baseline SQL creates every runtime table that current worker code reads and writes, including `app_price_change_events`. | ✓ VERIFIED | `apps/worker/drizzle/0000_init.sql` now contains `app_price_change_events`, `request_id varchar(96) NOT NULL`, and the unique request index. |
| 2 | Legacy upgrade SQL no longer acts as the only way to create `app_price_change_events`. | ✓ VERIFIED | `0000_init.sql` and `0001_price_change_events.sql` both define the table, while `0001` adds `to_regclass('app_price_history') IS NOT NULL` to keep upgrade/backfill safe. |
| 3 | Maintainers can run a deterministic smoke command that proves worker bootstrap and the subscription-to-history path still work after a fresh setup. | ✓ VERIFIED | `apps/worker/package.json` exposes `test:smoke`, and `pnpm --filter @appstore-price-radar/worker test:smoke` passed on 2026-03-18. |
| 4 | Phase 1 regression tests fail fast if baseline SQL drifts away from the runtime schema again. | ✓ VERIFIED | `apps/worker/test/schema.bootstrap.test.ts` asserts the canonical SQL assets and passed in the smoke run. |
| 5 | Maintainers see one official database bootstrap path and one smoke verification command in project docs. | ✓ VERIFIED | `README.md` now points to `pnpm --filter @appstore-price-radar/worker db:push` and `pnpm --filter @appstore-price-radar/worker test:smoke` as the canonical path. |
| 6 | Production docs no longer describe `CRON_SECRET` as optional when `/api/jobs/check` is exposed. | ✓ VERIFIED | `README.md` and `apps/worker/.dev.vars.example` both mark `CRON_SECRET` as required in production when the jobs endpoint remains enabled. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/worker/drizzle/0000_init.sql` | Baseline SQL creates runtime schema | ✓ EXISTS + SUBSTANTIVE | Includes `app_price_change_events` table and indexes used by runtime code. |
| `apps/worker/drizzle/0001_price_change_events.sql` | Legacy-safe upgrade/backfill migration | ✓ EXISTS + SUBSTANTIVE | Keeps table creation for upgrades and guards the legacy backfill with `to_regclass()`. |
| `apps/worker/test/schema.bootstrap.test.ts` | SQL contract regression test | ✓ EXISTS + SUBSTANTIVE | Verifies baseline SQL and legacy migration invariants from disk. |
| `apps/worker/test/fresh-install.smoke.test.ts` | Request-level smoke test | ✓ EXISTS + SUBSTANTIVE | Exercises `worker.fetch` across health, subscription, jobs, and prices routes with deterministic mocks. |
| `apps/worker/package.json` | Smoke command exposure | ✓ EXISTS + SUBSTANTIVE | Exposes `test:smoke` for the two Phase 1 verification files. |
| `README.md` | Canonical bootstrap and deploy docs | ✓ EXISTS + SUBSTANTIVE | Documents `db:push`, `test:smoke`, and production `CRON_SECRET` requirements. |
| `.env.example` | Web-only env contract | ✓ EXISTS + SUBSTANTIVE | Keeps root `.env` scoped to `VITE_API_BASE`. |
| `apps/worker/.dev.vars.example` | Worker runtime env contract | ✓ EXISTS + SUBSTANTIVE | Documents `DATABASE_URL`, `APP_BASE_URL`, `CORS_ORIGIN`, and required production `CRON_SECRET`. |

**Artifacts:** 8/8 verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/worker/src/db/schema.ts` | `apps/worker/drizzle/0000_init.sql` | `app_price_change_events` field/index contract | ✓ WIRED | Both define `old_amount`, `new_amount`, `changed_at`, `source`, `request_id`, and the request uniqueness index. |
| `apps/worker/drizzle/0001_price_change_events.sql` | `app_price_history` legacy data | `to_regclass()` guarded backfill | ✓ WIRED | The backfill runs only when `app_price_history` exists and stays idempotent via `ON CONFLICT ... DO NOTHING`. |
| `apps/worker/package.json` | `apps/worker/test/schema.bootstrap.test.ts` + `apps/worker/test/fresh-install.smoke.test.ts` | `test:smoke` | ✓ WIRED | The command runs both Phase 1 verification tests together. |
| `apps/worker/test/fresh-install.smoke.test.ts` | `apps/worker/src/index.ts` | `worker.fetch` request path | ✓ WIRED | The smoke test hits `/api/health`, `/api/subscriptions`, `/api/jobs/check`, and `/api/prices/:appId`. |
| `README.md` | `apps/worker/package.json` | documented bootstrap/smoke commands | ✓ WIRED | The README uses the exact `db:push` and `test:smoke` commands exposed by the worker package. |
| `README.md` | `apps/worker/.dev.vars.example` | shared env wording | ✓ WIRED | Both sources describe the same `CRON_SECRET`, `APP_BASE_URL`, and `CORS_ORIGIN` contract. |

**Wiring:** 6/6 connections verified

## Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| `DATA-01`: 维护者可以通过单一官方迁移链路初始化数据库，并创建当前运行代码所需的完整 schema | ✓ SATISFIED | - |
| `DATA-02`: fresh install 环境可以完成订阅创建、价格巡检和价格历史查询的基础 smoke path，而不会因迁移漂移失败 | ✓ SATISFIED | - |
| `DATA-03`: 部署文档和环境变量说明与实际运行要求保持一致，新的生产环境不会因遗漏关键配置进入不安全或不可用状态 | ✓ SATISFIED | - |

**Coverage:** 3/3 requirements satisfied

## Anti-Patterns Found

None found.

## Human Verification Required

None — automated typecheck, smoke tests, SQL contract checks, and docs/env contract checks cover the full Phase 1 must-have set.

## Gaps Summary

**No gaps found.** Phase goal achieved. Ready to proceed.

## Verification Metadata

**Verification approach:** Goal-backward (derived from roadmap goal and plan must-haves)  
**Must-haves source:** `01-01-PLAN.md`, `01-02-PLAN.md`, `01-03-PLAN.md` frontmatter  
**Automated checks:** 4 passed, 0 failed  
**Human checks required:** 0  
**Total verification time:** 3 min

---
*Verified: 2026-03-18T07:24:57Z*  
*Verifier: Codex*
