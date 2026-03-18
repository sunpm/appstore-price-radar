---
phase: 04-contract-frontend-stability
plan: '02'
subsystem: web-auth
tags: [vue, auth, session, unauthorized, router, composables]
requires:
  - phase: 04-contract-frontend-stability
    provides: 04-01 共享 contracts DTO，可供前端 session / auth 页面直接消费
provides:
  - 共享 `api-client`、`useAuthSession`、`useAuthedApi`，统一 token 注入与 unauthorized side effect
  - AuthView / ProfileView / SecurityView 不再各自维护独立 `apiRequest()` 和 session restore 流程
  - router / MainLayout 与共享 session source 对齐，401 清理、toast 与跳转行为更加一致
affects: [phase-04-contract-frontend-stability, phase-05-feed-performance-regression]
tech-stack:
  added: []
  patterns:
    - shared auth session composable
    - centralized authed request helper
    - route-level unauthorized redirect
key-files:
  created:
    - .planning/phases/04-contract-frontend-stability/04-02-SUMMARY.md
  modified:
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/auth-session.ts
    - apps/web/src/composables/useAuthSession.ts
    - apps/web/src/composables/useAuthedApi.ts
    - apps/web/src/router.ts
    - apps/web/src/layouts/MainLayout.vue
    - apps/web/src/views/auth/AuthView.vue
    - apps/web/src/views/profile/ProfileView.vue
    - apps/web/src/views/security/SecurityView.vue
    - apps/web/src/views/auth/composables/useAuthFeedback.ts
key-decisions:
  - unauthorized message 统一收敛为 `登录状态已失效，请重新登录。`，由共享 helper 负责映射和页面跳转
  - session token / user / expiresAt 一起持久化在 `auth-session.ts`，页面只通过 `useAuthSession()` 消费共享状态
patterns-established:
  - "需要登录的页面先走 `restoreSession()`，再用 `useAuthedApi()` 处理后续受保护请求。"
  - "route view 不再保留本地 `apiRequest()`，而是把请求和 unauthorized 侧效应收敛到共享 composable。"
requirements-completed: [AUTH-04, API-04]
duration: 13 min
completed: 2026-03-18
---

# Phase 4 Plan 02: 提取共享前端鉴权请求与错误处理逻辑 Summary

**前端登录态恢复、401 清理和重新登录引导已经收敛为共享链路，认证页、工作台和安全页不再各自维护一套 session/request 逻辑。**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-18T12:04:34Z
- **Completed:** 2026-03-18T12:17:27Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- 新增 `api-client.ts`，统一 JSON request、token 注入、`AbortSignal` 透传和 unauthorized 回调入口。
- 新增 `useAuthSession()`，把 token / currentUser / sessionExpiresAt / restoreSession / clearSession / applySession 收拢成共享状态源。
- 新增 `useAuthedApi()`，统一 `onUnauthorized` 清 session、跳转 `/auth`，并集中输出 `登录状态已失效，请重新登录。`。
- `AuthView.vue` 改为消费共享 session / auth helper，不再内嵌本地 session 存储逻辑。
- `ProfileView.vue`、`SecurityView.vue` 改为复用共享 authed request 和 restoreSession，清理重复 `apiRequest()`。
- `router.ts` 和 `MainLayout.vue` 对齐共享 session 语义，导航与登录弹窗状态不再依赖各页面自维护 token 逻辑。

## Task Commits

Each task was committed atomically:

1. **Task 1: 建立共享 session / authed request 基础设施** - `20f23f2` (feat)
2. **Task 2: 重构认证页、工作台和安全页，统一 401 清理、toast 和跳转行为** - `c702a90` (feat)

**Plan metadata:** to be committed with this summary/state/roadmap update.

## Files Created/Modified

- `apps/web/src/lib/api-client.ts` - 统一 auth request、错误解析与 unauthorized callback 协议。
- `apps/web/src/lib/auth-session.ts` - 扩展 session user / expiresAt 持久化与 shared storage helpers。
- `apps/web/src/composables/useAuthSession.ts` - 共享 session source of truth。
- `apps/web/src/composables/useAuthedApi.ts` - 共享 authed request + unauthorized redirect/message。
- `apps/web/src/router.ts` - `requiresAuth` guard 改为走共享 stored session 语义。
- `apps/web/src/layouts/MainLayout.vue` - 导航与登录弹窗改为消费共享 token 状态。
- `apps/web/src/views/auth/AuthView.vue` - 认证页切换到共享 session/auth helper。
- `apps/web/src/views/profile/ProfileView.vue` - 工作台移除 view-local `apiRequest()`，统一 401 行为。
- `apps/web/src/views/security/SecurityView.vue` - 安全页切换到共享 authed request，同时保留密码错误的特殊文案。
- `apps/web/src/views/auth/composables/useAuthFeedback.ts` - 增加统一错误映射，兼容 unauthorized copy。

## Decisions Made

- unauthorized 路径不再只清 token，而是统一清理完整 session 并由 `useAuthedApi()` 负责跳回 `/auth`。
- `MainLayout` 继续复用既有 auth 状态事件机制，但状态源从页面局部 token 迁移为共享 `useAuthSession()`。

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed (0 bug, 0 missing critical, 0 blocking)
**Impact on plan:** None.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 前端鉴权请求链路已经统一，`04-03` 可以直接在 `useAuthedApi()` 之上接 history window / cursor / cache 逻辑。
- `ProfileView.vue` 已经完成 session/request 收敛，下一步可以专注移除 `limit=3650` 和接入共享 history composable。

## Self-Check: PASSED

---
*Phase: 04-contract-frontend-stability*
*Completed: 2026-03-18*
---
