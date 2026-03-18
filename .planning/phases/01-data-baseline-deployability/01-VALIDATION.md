---
phase: 01
slug: data-baseline-deployability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — current worker tests use Vitest defaults |
| **Quick run command** | `pnpm --filter @appstore-price-radar/worker test -- test/schema.bootstrap.test.ts test/fresh-install.smoke.test.ts` |
| **Full suite command** | `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck && pnpm lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @appstore-price-radar/worker test -- test/schema.bootstrap.test.ts test/fresh-install.smoke.test.ts`
- **After every plan wave:** Run `pnpm --filter @appstore-price-radar/worker test && pnpm typecheck && pnpm lint`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | DATA-01 | static | `pnpm --filter @appstore-price-radar/worker test -- test/schema.bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01-01 | 1 | DATA-01 | static | `pnpm --filter @appstore-price-radar/worker test -- test/schema.bootstrap.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01-03 | 2 | DATA-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/fresh-install.smoke.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01-03 | 2 | DATA-02 | integration | `pnpm --filter @appstore-price-radar/worker test -- test/fresh-install.smoke.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01-02 | 3 | DATA-03 | docs-contract | `rg -n "db:push|test:smoke|CRON_SECRET" README.md apps/worker/.dev.vars.example` | ✅ | ⬜ pending |
| 01-02-02 | 01-02 | 3 | DATA-03 | docs-contract | `rg -n "Web only|Worker runtime vars|CRON_SECRET" .env.example apps/worker/.dev.vars.example README.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/worker/test/schema.bootstrap.test.ts` — static contract for `0000_init.sql` / `0001_price_change_events.sql`
- [ ] `apps/worker/test/fresh-install.smoke.test.ts` — deterministic request-level smoke for `/api/health`, subscriptions, jobs/check, prices
- [ ] `apps/worker/package.json` — `test:smoke` script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local fresh install follows README exactly | DATA-02, DATA-03 | 需要确认文档顺序与真实运维体验一致 | 复制 `.env.example` / `.dev.vars.example`，执行 README 官方建库命令，运行 `pnpm dev`，检查 `/api/health` 返回 200 |
| Manual job endpoint stays protected in production docs | DATA-03 | 这是运维约束，不是纯单测语义 | 检查 README 生产部署章节是否明确要求 `CRON_SECRET`，且 curl 示例使用 `x-cron-secret` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
