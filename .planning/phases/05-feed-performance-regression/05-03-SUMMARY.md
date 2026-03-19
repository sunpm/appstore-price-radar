---
phase: 05-feed-performance-regression
plan: "03"
subsystem: testing
tags: [vue, vitest, vue-test-utils, jsdom, pnpm, smoke]
requires:
  - phase: 05-02
    provides: Worker 路由与服务回归测试，以及可复用的 smoke verification 入口
  - phase: 04
    provides: 前端共享鉴权会话、受保护请求与价格历史 composable，作为页面级黑盒测试边界
provides:
  - Web 关键路径 Vitest 基建与 3 个页面级回归测试文件
  - 根级 `test` / `verify` / `verify:full` 官方验证入口
  - 适配 Vue Router memory history 的前端关键路径测试方式
affects: [phase-05, web-testing, release-validation, qa]
tech-stack:
  added: [vitest, "@vue/test-utils", jsdom]
  patterns: [route-view black-box testing, unified release verification pipeline]
key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/test/setup.ts
    - apps/web/test/auth-session.test.ts
    - apps/web/test/profile-subscription.test.ts
    - apps/web/test/app-history.test.ts
  modified:
    - apps/web/package.json
    - apps/web/src/router.ts
    - package.json
    - README.md
    - pnpm-lock.yaml
key-decisions:
  - "Web 自动化优先覆盖 route view + composable 的真实关键路径，而不是拆成零散 util 测试。"
  - "根级 `verify` 成为唯一官方发布前入口，`verify:full` 仅作为等价别名保留。"
patterns-established:
  - "Pattern 1: 使用 `App.vue` + memory history 挂载真实路由，黑盒验证登录态恢复、订阅流和详情页历史加载。"
  - "Pattern 2: 发布前验证固定按 `typecheck -> lint -> test -> worker smoke` 顺序执行。"
requirements-completed: [QA-02, QA-03]
duration: 9 min
completed: 2026-03-19
---

# Phase 05 Plan 03: 前端关键路径测试与统一验证命令 Summary

**Vue 关键路径集成测试基线结合根级 `verify` 发布前入口，把登录态、订阅流与价格历史查看正式纳入自动化验证。**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-19T11:04:00+08:00
- **Completed:** 2026-03-19T11:12:59+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- 为 `apps/web` 接入 `Vitest + @vue/test-utils + jsdom`，建立可挂载真实路由的前端测试基建。
- 新增 3 个关键路径测试文件，覆盖登录态恢复/未登录重定向、订阅创建/失败反馈/401 回收、价格历史初始加载/缓存复用/loadMore 错误分支。
- 在仓库根目录新增官方 `test` / `verify` / `verify:full` 脚本，并在 README 明确部署前必须执行 `pnpm verify`。

## Task Commits

每个 task 都已原子提交：

1. **Task 1: 为 Web 建立关键路径测试基建，并覆盖登录态、订阅流和价格历史查看** - `d1791fa` (`test`)
2. **Task 2: 在根脚本定义统一验证入口，并把 Web/Worker/Smoke path 串成官方发布前命令** - `67d9034` (`docs`)

## Files Created/Modified

- `apps/web/vitest.config.ts` - 定义 jsdom 测试环境与 setup 入口。
- `apps/web/test/setup.ts` - 统一前端测试的 fetch mock、storage 清理、router 挂载与异步等待辅助。
- `apps/web/test/auth-session.test.ts` - 覆盖登录态恢复和受保护路由重定向。
- `apps/web/test/profile-subscription.test.ts` - 覆盖 ProfileView 订阅创建、错误反馈和 401 回收。
- `apps/web/test/app-history.test.ts` - 覆盖详情页历史初始加载、缓存复用和 `loadMore` 错误路径。
- `apps/web/src/router.ts` - 抽出可复用的 router factory 与 auth guard，支持 memory history 黑盒测试。
- `apps/web/package.json` - 增加 Web `test` 脚本并声明前端测试依赖。
- `package.json` - 增加根级 `test` / `verify` / `verify:full` 官方验证命令。
- `README.md` - 文档化发布前统一验证命令与执行顺序。
- `pnpm-lock.yaml` - 锁定新增的前端测试依赖。

## Decisions Made

- 关键路径测试直接挂载 `App.vue` 与真实 router，而不是仅测试 composable 内部函数，以保证登录态、副作用和路由跳转都落在同一份行为边界里。
- `router.ts` 暴露 `createAppRouter()` / `authGuard()`，让生产路由与测试路由共享同一套鉴权规则，避免测试专用分叉。
- 根级 `verify` 明确收敛为发布前唯一官方入口，避免 README 与脚本出现多条隐式验证路径。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 新增测试后前端 lint 规则阻塞 `pnpm verify`**
- **Found during:** Task 2（统一验证入口验证）
- **Issue:** 新增测试文件的 `describe` 标题大小写与 import 排序不符合仓库 ESLint 规则，导致根级 `pnpm verify` 在 lint 阶段失败。
- **Fix:** 调整测试标题为小写，修正 `setup.ts` 与测试文件的 type-only import / import 排序。
- **Files modified:** `apps/web/test/setup.ts`, `apps/web/test/auth-session.test.ts`, `apps/web/test/profile-subscription.test.ts`, `apps/web/test/app-history.test.ts`
- **Verification:** `pnpm verify`
- **Committed in:** `67d9034`

---

**Total deviations:** 1 auto-fixed（1 个 Rule 3 阻塞问题）
**Impact on plan:** 仅为让统一验证入口真正可执行的静态规则修复，没有引入额外范围扩张。

## Issues Encountered

- 根级 `verify` 首次运行时暴露了前端测试文件的 lint 约束问题；问题定位明确，修复后统一验证链路恢复为全绿。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 5 的 Web 关键路径自动化与统一发布前验证入口已经补齐，路线图所述 `QA-02` 与 `QA-03` 可进入完成态。
- 后续如果继续扩展前端页面行为，建议沿用当前 `App.vue + memory history + fetch mock` 的黑盒测试模式，避免重新退回 util 级碎测。

## Self-Check

PASSED

---
*Phase: 05-feed-performance-regression*
*Completed: 2026-03-19*
